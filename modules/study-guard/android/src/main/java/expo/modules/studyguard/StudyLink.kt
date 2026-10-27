package expo.modules.studyguard

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.Executors
import javax.net.ssl.HttpsURLConnection

/** Durable stop outbox. Credentials stay in memory; a new foreground auth session supplies retries. */
internal object StudyLink {
  private var loaded = false
  private var link: JSONObject? = null
  private var prepared = false
  private var anchorServer = 0L
  private var anchorMono = 0L
  private var endpoint = ""
  private var apiKey = ""
  private var bearer = ""
  private var credentialOwner = ""
  private var credentialRoom = -1
  private var sending = false
  private fun formatter() = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC"); isLenient = false }
  private fun parse(value: String) = requireNotNull(formatter().parse(value)).time
  private fun iso(value: Long) = formatter().format(java.util.Date(value))
  private var nextAttempt = 0L
  private val executor = Executors.newSingleThreadExecutor()
  private val main = Handler(Looper.getMainLooper())
  private fun load(context: Context) {
    if (loaded) return
    loaded = true
    link = GuardStore.prefs(context).getString("study_link", null)?.let { JSONObject(it) }
    // A previous process died while observing. Never silently resume its session.
    link?.let {
      if (!it.has("endedAt")) {
        it.put("endedAt", it.getString("checkpoint")); it.put("confirmed", false); persist(context)
      }
    }
  }
  private fun persist(context: Context) { GuardStore.prefs(context).edit().putString("study_link", link?.toString()).commit() }
  fun status(context: Context): Map<String, Any?>? {
    load(context)
    return link?.let { mapOf("sessionId" to it.getString("sessionId"), "ownerId" to it.getString("ownerId"),
      "roomId" to it.getInt("roomId"), "endedAt" to if (it.has("endedAt")) it.getString("endedAt") else null,
      "confirmed" to it.optBoolean("confirmed", false)) }
  }
  fun transport(context: Context, url: String, key: String, token: String, owner: String, room: Int) {
    load(context)
    val parsed = URL(url)
    require(parsed.protocol == "https" && parsed.host.endsWith(".supabase.co") && parsed.userInfo == null && parsed.path == "/rest/v1/rpc/stop_study_on_exit")
    endpoint = url; apiKey = key; bearer = token; credentialOwner = owner; credentialRoom = room; nextAttempt = 0
    send(context)
  }
  fun prepare(context: Context, serverNow: String) {
    load(context)
    check(link == null || link!!.optBoolean("confirmed", false)) { "이전 공부의 일시정지를 먼저 동기화해 주세요" }
    prepared = true; anchorServer = parse(serverNow); anchorMono = GuardStore.now()
    val state = GuardStore.state(context); state.reset(anchorMono); state.start(anchorMono)
    GuardStore.save(context)
  }
  fun bind(context: Context, id: String, owner: String, room: Int, startedAt: String) {
    load(context); check(prepared) { "공부 감시를 먼저 준비해 주세요" }
    val initial = parse(startedAt)
    link = JSONObject().put("sessionId", id).put("ownerId", owner).put("roomId", room)
      .put("startedAt", initial).put("checkpoint", iso(maxOf(initial, anchorServer))).put("confirmed", false)
    prepared = false; persist(context); checkpoint(context, GuardStore.state(context))
  }
  fun checkpoint(context: Context, state: GuardSession) {
    load(context)
    val current = link ?: return
    if (current.optBoolean("confirmed", false)) return
    if (!current.has("endedAt")) {
      val at = if (state.running) GuardStore.now() else state.stoppedAt
      val serverAt = maxOf(current.getLong("startedAt"), anchorServer + (at - anchorMono).coerceAtLeast(0))
      current.put("checkpoint", iso(serverAt))
      if (!state.running) current.put("endedAt", current.getString("checkpoint"))
      persist(context)
    }
    send(context)
  }
  fun recoverStopped(context: Context, id: String, owner: String, room: Int, startedAt: String, serverNow: String) {
    load(context)
    check(link == null || link!!.optBoolean("confirmed", false)) { "이전 공부의 동기화가 필요해요" }
    anchorServer = parse(serverNow); anchorMono = GuardStore.now(); prepared = true
    val state = GuardStore.state(context); state.reset(anchorMono); state.start(anchorMono)
    state.pause(anchorMono, "감시되지 않은 공부를 일시정지했어요. 직접 재개해 주세요.")
    bind(context, id, owner, room, startedAt)
  }
  fun acknowledge(context: Context, id: String) {
    load(context)
    if (link?.optString("sessionId") != id) return
    link!!.put("confirmed", true)
    if (!link!!.has("endedAt")) link!!.put("endedAt", link!!.getString("checkpoint"))
    if (!prepared) GuardStore.state(context).pause(GuardStore.now(), "공부를 일시정지했어요")
    persist(context); GuardStore.save(context)
  }
  fun stopIfIdle(context: Context) {
    // A late acknowledgement of the previous session must not stop a new preparation.
    if (!prepared && !GuardStore.state(context).running) context.stopService(Intent(context, StudyGuardService::class.java))
  }
  private fun send(context: Context) {
    val current = link ?: return
    if (current.getString("ownerId") != credentialOwner || current.getInt("roomId") != credentialRoom) return
    if (!current.has("endedAt") || current.optBoolean("confirmed", false) || sending || bearer.isEmpty() || GuardStore.now() < nextAttempt) return
    val id = current.getString("sessionId")
    val payload = JSONObject().put("p_session_id", id).put("p_stopped_at", current.getString("endedAt")).toString()
    val requestUrl = endpoint; val requestKey = apiKey; val requestBearer = bearer
    sending = true; nextAttempt = GuardStore.now() + 10000
    executor.execute {
      var success = false
      try {
        val connection = URL(requestUrl).openConnection() as HttpsURLConnection
        try {
          connection.requestMethod = "POST"; connection.connectTimeout = 10000; connection.readTimeout = 10000
          connection.setRequestProperty("Authorization", "Bearer $requestBearer")
          connection.setRequestProperty("apikey", requestKey); connection.setRequestProperty("Content-Type", "application/json")
          connection.doOutput = true
          connection.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
          if (connection.responseCode in 200..299) {
            val result = connection.inputStream.bufferedReader().use { JSONObject(it.readText()).getJSONObject("data") }
            success = result.getString("id") == id && !result.isNull("endedAt")
          }
        } finally { connection.disconnect() }
      } catch (_: Exception) { /* Keep the durable outbox; never log tokens or request headers. */ }
      main.post {
        sending = false
        if (success && link?.optString("sessionId") == id) {
          link!!.put("confirmed", true); persist(context)
          GuardStore.log(context, "공부 일시정지를 서버에 반영했어요")
          stopIfIdle(context)
        }
      }
    }
  }
}
