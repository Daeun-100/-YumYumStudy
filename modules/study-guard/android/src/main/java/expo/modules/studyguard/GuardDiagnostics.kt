package expo.modules.studyguard

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.os.Process
import android.os.SystemClock
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/** Best-effort, bounded outbox. No traces, exception messages, tokens or other apps' usage. */
internal object GuardDiagnostics {
  private var collected = false
  private val processStartedAt = System.currentTimeMillis() - (SystemClock.elapsedRealtime() - Process.getStartElapsedRealtime())
  private fun prefs(context: Context) = context.getSharedPreferences("study_guard_diagnostics", Context.MODE_PRIVATE)
  private fun array(value: String?) = try { JSONArray(value ?: "[]") } catch (_: Exception) { JSONArray() }
  private fun rows(value: JSONArray) = (0 until value.length()).mapNotNull { value.optJSONObject(it) }

  fun collect(context: Context) {
    GuardWorker.assertCurrent()
    if (collected) return
    try {
      val prefs = prefs(context)
      val pending = rows(array(prefs.getString("pending", null))).toMutableList()
      val seen = array(prefs.getString("seen", null)).let { a -> (0 until a.length()).map { a.getString(it) }.toMutableList() }
      val previousPid = prefs.getInt("pid", -1)
      if (Build.VERSION.SDK_INT >= 30) {
        val exits = context.getSystemService(ActivityManager::class.java)
          .getHistoricalProcessExitReasons(context.packageName, 0, 16)
        for (exit in exits.sortedBy { it.timestamp }) {
          if (exit.processName != context.packageName || exit.timestamp >= processStartedAt
            || exit.timestamp < System.currentTimeMillis() - 7L * 24 * 60 * 60 * 1000) continue
          val key = "${exit.pid}:${exit.timestamp}:${exit.reason}"
          if (key in seen) continue
          val matched = exit.pid == previousPid && exit.timestamp >= prefs.getLong("process_started_at", Long.MAX_VALUE)
          val serviceAt = prefs.getLong("service_at", 0)
          pending.add(JSONObject().put("id", UUID.randomUUID().toString()).put("exitedAt", exit.timestamp)
            .put("reason", exit.reason).put("status", exit.status).put("importance", exit.importance)
            .put("pssKb", exit.pss).put("rssKb", exit.rss).put("sdk", Build.VERSION.SDK_INT)
            .put("manufacturer", Build.MANUFACTURER.take(128)).put("model", Build.MODEL.take(128))
            .put("nativeVersion", if (matched) prefs.getString("version", null) else JSONObject.NULL)
            .put("nativeBuild", if (matched) prefs.getString("build", null) else JSONObject.NULL)
            .put("serviceEvent", if (matched && serviceAt <= exit.timestamp) prefs.getString("service_event", null) else JSONObject.NULL)
            .put("serviceAt", if (matched && serviceAt > 0 && serviceAt <= exit.timestamp) serviceAt else JSONObject.NULL))
          seen.add(key)
        }
      }
      @Suppress("DEPRECATION") val info = context.packageManager.getPackageInfo(context.packageName, 0)
      @Suppress("DEPRECATION") val build = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong()
      check(prefs.edit().putString("pending", JSONArray(pending.takeLast(16)).toString())
        .putString("seen", JSONArray(seen.takeLast(64)).toString())
        .putInt("pid", Process.myPid()).putLong("process_started_at", processStartedAt)
        .putString("version", info.versionName).putString("build", build.toString())
        .remove("service_at").remove("service_event").commit())
      collected = true
    } catch (_: Exception) { /* Diagnostics must never prevent launching or studying; retry on next request. */ }
  }

  fun record(context: Context, event: String) {
    GuardWorker.assertCurrent()
    collect(context)
    if (!collected) return
    try { prefs(context).edit().putString("service_event", event).putLong("service_at", System.currentTimeMillis()).commit() }
    catch (_: Exception) { /* Best effort. */ }
  }

  fun pending(context: Context): String {
    collect(context)
    return prefs(context).getString("pending", "[]") ?: "[]"
  }

  fun acknowledge(context: Context, ids: List<String>) {
    GuardWorker.assertCurrent()
    val prefs = prefs(context)
    val remaining = rows(array(prefs.getString("pending", null))).filter { it.optString("id") !in ids }
    check(prefs.edit().putString("pending", JSONArray(remaining).toString()).commit())
  }
}
