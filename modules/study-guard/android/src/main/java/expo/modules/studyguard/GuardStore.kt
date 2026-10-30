package expo.modules.studyguard

import android.app.AppOpsManager
import android.app.NotificationManager
import android.app.KeyguardManager
import android.content.Context
import android.os.Build
import android.os.Process
import android.os.SystemClock
import android.os.PowerManager

internal object GuardStore {
  private var session: GuardSession? = null
  private val events = ArrayDeque<Map<String, Any>>()
  var heartbeat = 0L
  fun prefs(context: Context) = context.getSharedPreferences("study_guard_probe", Context.MODE_PRIVATE)
  fun state(context: Context): GuardSession {
    if (session == null) {
      session = GuardSession(context.packageName).also {
        it.accumulated = prefs(context).getLong("elapsed", 0)
        it.reason = prefs(context).getString("reason", "검증을 시작해 주세요")
        if (prefs(context).getBoolean("running", false)) it.reason = "감시가 종료되어 일시정지했어요. 직접 재개해 주세요."
      }
    }
    return session!!
  }
  fun now() = SystemClock.elapsedRealtime()
  fun allowed(context: Context): Set<String> = prefs(context).getStringSet("allowed", emptySet())!!.toSet()
  fun hasAccess(context: Context): Boolean {
    val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    return ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName) == AppOpsManager.MODE_ALLOWED
  }
  fun notificationsAllowed(context: Context): Boolean {
    val manager = context.getSystemService(NotificationManager::class.java)
    if (!manager.areNotificationsEnabled()) return false
    return Build.VERSION.SDK_INT < 26 || manager.getNotificationChannel("study_guard")?.importance != NotificationManager.IMPORTANCE_NONE
  }
  fun log(context: Context, message: String, persist: Boolean = true) {
    events.addFirst(mapOf("at" to System.currentTimeMillis().toDouble(), "message" to message))
    while (events.size > 40) events.removeLast()
    if (persist) save(context)
  }
  fun save(context: Context) {
    val s = state(context)
    StudyLink.checkpoint(context, s)
    prefs(context).edit().putLong("elapsed", s.elapsed(now())).putBoolean("running", s.running).putString("reason", s.reason).apply()
  }
  fun snapshot(context: Context): Map<String, Any?> {
    val s = state(context)
    // Allow the asynchronous foreground-service startup to finish before declaring a gap.
    val screenUnavailable = !context.getSystemService(PowerManager::class.java).isInteractive || context.getSystemService(KeyguardManager::class.java).isKeyguardLocked
    if (s.running && !screenUnavailable && StudyGuardService.instance?.screenUnavailable != true && now() - heartbeat > 4000) {
      s.pause(if (heartbeat > 0) heartbeat else now(), "감시 중단을 감지하여 일시정지했어요")
      log(context, s.reason)
    }
    return mapOf("running" to s.running, "elapsedMs" to s.elapsed(now()).toDouble(),
      "reason" to s.reason, "foreground" to s.foreground, "authorized" to s.authorized,
      "usageAccess" to hasAccess(context), "notificationAccess" to notificationsAllowed(context),
      "restrictedSettingsReviewed" to prefs(context).getBoolean("restricted_settings_reviewed", false),
      "serviceAlive" to (StudyGuardService.instance != null),
      "link" to StudyLink.status(context),
      "allowed" to allowed(context).toList(), "events" to events.toList(), "pollMs" to 500)
  }
}
