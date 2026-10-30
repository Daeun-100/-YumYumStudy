package expo.modules.studyguard

import android.content.Intent
import android.os.Build
import android.net.Uri
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.functions.Coroutine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class StudyGuardModule : Module() {
  private fun context() = requireNotNull(appContext.reactContext)
  override fun definition() = ModuleDefinition {
    Name("StudyGuard")
    OnCreate {
      appContext.reactContext?.applicationContext?.let { ctx ->
        GuardWorker.handler.post { GuardDiagnostics.collect(ctx) }
      }
    }
    AsyncFunction("pendingDiagnostics") { GuardDiagnostics.pending(context()) }.runOnQueue(GuardWorker.scope)
    AsyncFunction("acknowledgeDiagnostics") { ids: List<String> -> GuardDiagnostics.acknowledge(context(), ids) }.runOnQueue(GuardWorker.scope)
    // Read the latest observed state; never query UsageStatsManager merely to render a screen.
    AsyncFunction("status") { GuardStore.snapshot(context()) }.runOnQueue(GuardWorker.scope)
    AsyncFunction("openUsageSettings") {
      val activity = requireNotNull(appContext.currentActivity)
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS, Uri.parse("package:${context().packageName}"))
      try { activity.startActivity(intent) }
      catch (_: android.content.ActivityNotFoundException) { activity.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)) }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("openAppSettings") {
      requireNotNull(appContext.currentActivity).startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context().packageName}")))
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("reviewRestrictedSettings") {
      // This records acknowledgement of the guide, not a system permission grant.
      GuardStore.prefs(context()).edit().putBoolean("restricted_settings_reviewed", true).apply()
    }.runOnQueue(GuardWorker.scope)
    AsyncFunction("openNotificationSettings") {
      val ctx = context()
      val intent = if (Build.VERSION.SDK_INT >= 26) Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName)
        else Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${ctx.packageName}"))
      requireNotNull(appContext.currentActivity).startActivity(intent)
    }.runOnQueue(Queues.MAIN)
    // Keep package queries and label loading off the UI thread so the launcher can appear immediately.
    AsyncFunction("apps") {
      val ctx = context(); val pm = ctx.packageManager
      val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      pm.queryIntentActivities(intent, 0).filter { it.activityInfo.packageName != ctx.packageName }
        .distinctBy { it.activityInfo.packageName }.map {
          val pkg = it.activityInfo.packageName
          mapOf("packageName" to pkg, "label" to it.loadLabel(pm).toString(), "iconUri" to StudyAppIcons.uri(ctx, it))
        }.sortedBy { it["label"] }
    }.runOnQueue(Queues.DEFAULT)
    AsyncFunction("select") { packages: List<String> ->
      check(!GuardStore.state(context()).running) { "일시정지 후 허용앱을 변경해 주세요" }
      GuardStore.prefs(context()).edit().putStringSet("allowed", packages.toSet()).apply()
    }.runOnQueue(GuardWorker.scope)
    AsyncFunction("setTransport") { url: String, key: String, token: String, owner: String, room: Int ->
      StudyLink.transport(context(), url, key, token, owner, room)
    }.runOnQueue(GuardWorker.scope)
    AsyncFunction("prepareStudy") { serverNow: String ->
      check(appContext.currentActivity != null) { "스터디앱에서 시작해 주세요" }
      val ctx = context()
      check(GuardStore.hasAccess(ctx) && GuardStore.notificationsAllowed(ctx)) { "허용앱 설정에서 사용정보 접근과 알림을 먼저 허용해 주세요" }
      if (StudyGuardService.instance == null) {
        val intent = Intent(ctx, StudyGuardService::class.java)
        if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(intent) else ctx.startService(intent)
      } else StudyGuardService.instance?.poll()
      StudyLink.prepare(ctx, serverNow); GuardStore.heartbeat = GuardStore.now()
    }.runOnQueue(GuardWorker.scope)
    AsyncFunction("bindStudy") { id: String, owner: String, room: Int, startedAt: String ->
      StudyLink.bind(context(), id, owner, room, startedAt)
    }.runOnQueue(GuardWorker.scope)
    AsyncFunction("recoverStoppedStudy") { id: String, owner: String, room: Int, startedAt: String, serverNow: String ->
      StudyLink.recoverStopped(context(), id, owner, room, startedAt, serverNow)
    }.runOnQueue(GuardWorker.scope)
    AsyncFunction("acknowledgeStop") { id: String -> StudyLink.acknowledge(context(), id); StudyLink.stopIfIdle(context()) }.runOnQueue(GuardWorker.scope)
    AsyncFunction("pause") {
      val ctx = context(); GuardStore.state(ctx).pause(GuardStore.now(), "직접 일시정지했어요"); GuardStore.log(ctx, "직접 일시정지")
    }.runOnQueue(GuardWorker.scope)
    AsyncFunction("finish") {
      val ctx = context(); GuardStore.state(ctx).pause(GuardStore.now(), "검증을 종료했어요"); GuardStore.log(ctx, "검증 종료")
      ctx.stopService(Intent(ctx, StudyGuardService::class.java))
    }.runOnQueue(GuardWorker.scope)
    AsyncFunction("reset") {
      val ctx = context(); check(!GuardStore.state(ctx).running) { "일시정지 후 초기화해 주세요" }
      GuardStore.state(ctx).reset(GuardStore.now()); GuardStore.log(ctx, "검증 시간 초기화")
    }.runOnQueue(GuardWorker.scope)
    (AsyncFunction("launch") Coroutine { pkg: String ->
      val ctx = context(); val activity = requireNotNull(appContext.currentActivity)
      StudyGuardService.instance?.poll()
      check(GuardStore.allowed(ctx).contains(pkg)) { "허용앱으로 먼저 등록해 주세요" }
      val intent = requireNotNull(ctx.packageManager.getLaunchIntentForPackage(pkg)) { "실행 가능한 앱이 아니에요" }
      val s = GuardStore.state(ctx)
      check(s.launch(pkg, GuardStore.now())) { "스터디앱에서 공부를 시작해 주세요" }
      try { withContext(Dispatchers.Main) { activity.startActivity(intent) }; GuardStore.log(ctx, "스터디앱에서 실행: $pkg") }
      catch (error: Exception) { s.pause(GuardStore.now(), "허용앱 실행 실패"); GuardStore.log(ctx, s.reason); throw error }
    }).runOnQueue(GuardWorker.scope)
  }
}
