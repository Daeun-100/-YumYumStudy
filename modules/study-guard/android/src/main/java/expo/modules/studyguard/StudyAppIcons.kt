package expo.modules.studyguard

import android.content.Context
import android.content.pm.ResolveInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.Uri
import java.io.File

internal object StudyAppIcons {
  // Fixed-size PNGs keep bitmap memory and the JS response small. Drawable.draw also
  // handles adaptive/vector icons, which cannot be cast directly to BitmapDrawable.
  private const val SIZE = 128

  @Synchronized
  fun uri(context: Context, app: ResolveInfo): String? {
    return try {
      val pm = context.packageManager
      val packageName = app.activityInfo.packageName
      @Suppress("DEPRECATION")
      val updated = pm.getPackageInfo(packageName, 0).lastUpdateTime
      val directory = File(context.cacheDir, "allowed-app-icons-v1")
      check(directory.isDirectory || directory.mkdirs())
      val prefix = "$packageName-"
      val file = File(directory, "$prefix${app.activityInfo.name.hashCode()}-$updated.png")
      if (!file.exists() || file.length() == 0L) {
        val drawable = app.loadIcon(pm)
        val bitmap = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888)
        val temporary = File.createTempFile("icon-", ".png", directory)
        try {
          drawable.setBounds(0, 0, SIZE, SIZE)
          drawable.draw(Canvas(bitmap))
          temporary.outputStream().use { check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) }
          check(temporary.renameTo(file))
          // Discard previous versions after an app update, without touching other apps.
          directory.listFiles()?.filter { it.name.startsWith(prefix) && it != file }?.forEach { it.delete() }
        } finally {
          bitmap.recycle()
          temporary.delete()
        }
      }
      Uri.fromFile(file).toString()
    } catch (_: Exception) {
      // A removed package, unavailable drawable or full cache must not hide the app.
      null
    }
  }
}
