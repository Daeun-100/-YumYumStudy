package expo.modules.studyguard

import android.os.Handler
import android.os.HandlerThread
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.android.asCoroutineDispatcher

/** Process-scoped queue: service callbacks, module commands and acknowledgements share one owner. */
internal object GuardWorker {
  private val thread = HandlerThread("StudyGuard").apply { start() }
  val handler = Handler(thread.looper)
  val scope = CoroutineScope(SupervisorJob() + handler.asCoroutineDispatcher("StudyGuard"))
  fun assertCurrent() = check(android.os.Looper.myLooper() == thread.looper) { "Study state requires GuardWorker" }
}
