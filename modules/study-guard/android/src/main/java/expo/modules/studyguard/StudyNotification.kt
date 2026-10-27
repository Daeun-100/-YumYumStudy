package expo.modules.studyguard

import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.graphics.Color
import android.os.Build
import android.widget.RemoteViews
import java.util.Locale

/** A single compact row in both the collapsed and expanded system notification. */
internal object StudyNotification {
  const val ID = 4107
  const val CHANNEL = "study_guard"

  fun build(context: Context, elapsedMs: Long, running: Boolean, open: PendingIntent, pause: PendingIntent): Notification {
    val seconds = elapsedMs.coerceAtLeast(0) / 1000
    val time = String.format(Locale.ROOT, "%02d:%02d:%02d", seconds / 3600, seconds / 60 % 60, seconds % 60)
    val row = RemoteViews(context.packageName, R.layout.study_guard_notification).apply {
      setTextViewText(R.id.study_guard_timer, time)
      setOnClickPendingIntent(R.id.study_guard_pause, pause)
      setBoolean(R.id.study_guard_pause, "setEnabled", running)
    }
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, CHANNEL) else Notification.Builder(context)
    return builder
      .setSmallIcon(R.drawable.study_guard_status)
      .setColor(Color.rgb(16, 131, 99))
      .setContentTitle(time)
      .setContentIntent(open)
      .setCategory(Notification.CATEGORY_SERVICE)
      .setShowWhen(false)
      .setOnlyAlertOnce(true)
      .setOngoing(true)
      .setStyle(Notification.DecoratedCustomViewStyle())
      .setCustomContentView(row)
      .setCustomBigContentView(row)
      .build()
  }
}
