package expo.modules.studyguard

import android.app.*
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.*

class StudyGuardService : Service() {
  companion object { var instance: StudyGuardService? = null; private set }
  private val handler = GuardWorker.handler
  private var cursor = 0L
  private var lastSaved = 0L
  private var observationStart = 0L
  var screenUnavailable = false
    private set
  private lateinit var notificationOpen: PendingIntent
  private lateinit var notificationPause: PendingIntent
  private var notificationSecond = -1L
  private var notificationRunning = false
  private val seen = mutableMapOf<String, Long>()
  private val ticker = object : Runnable {
    override fun run() {
      if (instance !== this@StudyGuardService) return
      try { poll() } catch (_: Exception) {
        GuardStore.state(this@StudyGuardService).pause(GuardStore.now(), "사용정보 조회에 실패하여 일시정지했어요")
        GuardStore.log(this@StudyGuardService, "사용정보 조회 실패")
      }
      handler.postDelayed(this, 500)
    }
  }
  override fun onCreate() {
    super.onCreate()
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel(StudyNotification.CHANNEL, "공부 타이머", NotificationManager.IMPORTANCE_LOW))
    val open = packageManager.getLaunchIntentForPackage(packageName)!!
    notificationOpen = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    notificationPause = PendingIntent.getService(this, 1, Intent(this, StudyGuardService::class.java).setAction("STOP"), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    // Meet the foreground-service deadline without waiting for storage or usage queries.
    val notification = StudyNotification.build(this, 0, false, notificationOpen, notificationPause)
    if (Build.VERSION.SDK_INT >= 34) startForeground(StudyNotification.ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    else startForeground(StudyNotification.ID, notification)
    handler.post {
      instance = this
      cursor = System.currentTimeMillis(); observationStart = cursor; GuardStore.heartbeat = GuardStore.now()
      GuardDiagnostics.record(this, "service_created")
      handler.post(ticker)
    }
  }
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == "STOP") handler.post {
      GuardStore.state(this).pause(GuardStore.now(), "알림에서 공부를 일시정지했어요")
      GuardStore.log(this, "공부 일시정지"); stopSelf()
    }
    return START_NOT_STICKY
  }
  fun poll() {
    GuardWorker.assertCurrent()
    val now = GuardStore.now()
    val wallNow = System.currentTimeMillis()
    val s = GuardStore.state(this)
    val power = getSystemService(PowerManager::class.java)
    val keyguard = getSystemService(KeyguardManager::class.java)
    val unavailable = !power.isInteractive || keyguard.isKeyguardLocked
    val returningFromScreenOff = screenUnavailable
    screenUnavailable = unavailable
    if (s.running && !unavailable && !returningFromScreenOff && now - GuardStore.heartbeat > 3000) s.pause(GuardStore.heartbeat, "감시 지연으로 일시정지했어요")
    GuardStore.heartbeat = now
    val before = s.reason
    if (s.running && !GuardStore.hasAccess(this)) s.pause(now, "사용정보 접근 권한이 해제되어 일시정지했어요")
    if (s.running && !GuardStore.notificationsAllowed(this)) s.pause(now, "알림 권한이 해제되어 일시정지했어요")
    if (unavailable) {
      s.screenUnavailable()
      // Discard lock-screen activity events rather than treating them as app switches.
      cursor = wallNow; observationStart = wallNow
      if (now - lastSaved >= 2000) { GuardStore.save(this); lastSaved = now }
      updateNotification(s, now)
      return
    }
    if (wallNow < cursor || wallNow - cursor > 5000) {
      if (s.running && !returningFromScreenOff) s.pause(now, "시간 또는 감시 간격 변경으로 일시정지했어요")
      cursor = wallNow
    }
    if (GuardStore.hasAccess(this)) {
      val usage = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val events = usage.queryEvents(maxOf(observationStart, cursor - 2000), wallNow)
      if (events == null && s.running) s.pause(now, "사용정보를 확인할 수 없어 일시정지했어요")
      val event = UsageEvents.Event()
      while (events != null && events.hasNextEvent()) {
        events.getNextEvent(event)
        val key = "${event.timeStamp}:${event.eventType}:${event.packageName}:${event.className}"
        if (seen.containsKey(key)) continue
        seen[key] = event.timeStamp
        val at = (now - (wallNow - event.timeStamp)).coerceIn(0, now)
        when (event.eventType) {
          UsageEvents.Event.ACTIVITY_RESUMED -> {
            val previous = s.foreground
            s.resumed(event.packageName, at)
            if (previous != event.packageName) GuardStore.log(this, "앱 전환: ${event.packageName}", false)
          }
          UsageEvents.Event.ACTIVITY_PAUSED -> s.activityPaused(event.packageName, at)
          UsageEvents.Event.SCREEN_NON_INTERACTIVE -> s.screenUnavailable()
        }
      }
    }
    seen.entries.removeAll { it.value < wallNow - 10000 }
    cursor = wallNow
    s.check(now)
    if (!s.running) StudyLink.checkpoint(this, s)
    if (s.reason != before) GuardStore.log(this, s.reason)
    if (now - lastSaved >= 2000) { GuardStore.save(this); lastSaved = now }
    updateNotification(s, now)
  }
  private fun updateNotification(state: GuardSession, now: Long) {
    if (!::notificationOpen.isInitialized) return
    val elapsed = state.elapsed(now)
    val seconds = elapsed / 1000
    // Reuse one silent notification; freeze its timer immediately on any pause.
    if (seconds == notificationSecond && state.running == notificationRunning) return
    getSystemService(NotificationManager::class.java).notify(StudyNotification.ID,
      StudyNotification.build(this, elapsed, state.running, notificationOpen, notificationPause))
    notificationSecond = seconds; notificationRunning = state.running
  }
  override fun onTaskRemoved(rootIntent: Intent?) {
    handler.post {
      if (instance !== this) return@post
      GuardDiagnostics.record(this, "task_removed")
      GuardStore.state(this).pause(GuardStore.now(), "최근 앱에서 스터디앱을 종료하여 일시정지했어요")
      GuardStore.log(this, "앱 종료"); stopSelf()
    }
  }
  override fun onDestroy() {
    handler.post {
      handler.removeCallbacks(ticker)
      if (instance !== this) return@post
      GuardDiagnostics.record(this, "service_destroyed")
      val s = GuardStore.state(this)
      if (s.running) s.pause(GuardStore.now(), "감시 서비스가 종료되어 일시정지했어요")
      GuardStore.save(this); instance = null
    }
    super.onDestroy()
  }
  override fun onBind(intent: Intent?) = null
}
