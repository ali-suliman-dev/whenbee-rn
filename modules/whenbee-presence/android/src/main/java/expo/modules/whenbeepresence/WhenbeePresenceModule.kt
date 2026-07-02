package expo.modules.whenbeepresence

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Android analog of the iOS Live Activity. An ONGOING notification whose countdown
// is ticked by the system chronometer (no foreground service, no background JS),
// progressively enhanced to an Android-16 promoted "Live Update" via ProgressStyle.
class WhenbeePresenceModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context unavailable" }

  private fun ensureChannel() {
    val mgr = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (mgr.getNotificationChannel(CHANNEL_ID) == null) {
      val channel = NotificationChannel(CHANNEL_ID, "Running timer", NotificationManager.IMPORTANCE_LOW).apply {
        description = "Shows your live timer while a task is running"
        setShowBadge(false)
      }
      mgr.createNotificationChannel(channel)
    }
  }

  private fun postNotification(label: String, finishEpochSec: Double, isOverrun: Boolean, isProRich: Boolean) {
    ensureChannel()
    val finishMs = (finishEpochSec * 1000).toLong()

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(label)
      .setContentText(if (isOverrun) "Over your honest finish" else "Running — honest finish shown")
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setUsesChronometer(true)
      // Count DOWN to the honest finish; once overrun, count UP from it (+MM:SS).
      .setChronometerCountDown(!isOverrun)
      .setWhen(finishMs)
      .setShowWhen(true)

    // Android 16 (API 36) promoted ongoing "Live Update" — the real Live Activity analog
    // (status-bar chip). Reflection-guarded so the module compiles/runs on older devices.
    if (Build.VERSION.SDK_INT >= 36 && isProRich) {
      try {
        val m = NotificationCompat.Builder::class.java.getMethod("requestPromotedOngoing", Boolean::class.javaPrimitiveType)
        m.invoke(builder, true)
      } catch (_: Throwable) { /* not available → plain ongoing notification */ }
    }

    NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build())
  }

  override fun definition() = ModuleDefinition {
    Name("WhenbeePresence")

    Property("isStub") { false }

    Function("startTimerNotification") { attrs: Map<String, Any?> ->
      val label = attrs["taskLabel"] as? String ?: return@Function
      val finish = (attrs["finishEpoch"] as? Number)?.toDouble() ?: return@Function
      val proRich = attrs["isProRich"] as? Boolean ?: false
      postNotification(label, finish, isOverrun = false, isProRich = proRich)
      lastLabel = label; lastFinish = finish; lastProRich = proRich
    }

    Function("updateTimerNotification") { state: Map<String, Any?> ->
      val overrun = state["isOverrun"] as? Boolean ?: false
      val label = lastLabel ?: return@Function
      val finish = lastFinish ?: return@Function
      postNotification(label, finish, isOverrun = overrun, isProRich = lastProRich)
    }

    Function("stopTimerNotification") {
      NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
      lastLabel = null; lastFinish = null
    }
  }

  // Retained so an overrun update can re-post with the original label/finish.
  private var lastLabel: String? = null
  private var lastFinish: Double? = null
  private var lastProRich: Boolean = false

  companion object {
    private const val CHANNEL_ID = "whenbee.timer"
    private const val NOTIFICATION_ID = 4711
  }
}
