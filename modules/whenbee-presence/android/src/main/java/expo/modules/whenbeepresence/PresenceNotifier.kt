package expo.modules.whenbeepresence

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject

// Shared, static-callable builder for the running-timer notification.
// Called from BOTH the Expo module (foreground) AND TimerAlarmReceiver (background/killed),
// so both routes post the SAME notification id with identical styling — the receiver is what
// flips the chronometer to count-up once the honest finish passes, even when JS is frozen.
object PresenceNotifier {
  const val CHANNEL_ID = "whenbee.timer"
  const val NOTIFICATION_ID = 4711

  private const val KEY_TIMER = "timer"
  const val ALARM_REQUEST_CODE = 4711

  fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(context.packageName + ".presence", Context.MODE_PRIVATE)

  // Persist the running-timer state so a background alarm can rebuild the notification.
  fun saveTimer(context: Context, label: String, finishEpochSec: Double, isProRich: Boolean) {
    val json = JSONObject()
      .put("taskLabel", label)
      .put("finishEpoch", finishEpochSec)
      .put("isProRich", isProRich)
    prefs(context).edit().putString(KEY_TIMER, json.toString()).apply()
  }

  fun clearTimer(context: Context) {
    prefs(context).edit().remove(KEY_TIMER).apply()
  }

  fun readTimer(context: Context): TimerState? {
    val raw = prefs(context).getString(KEY_TIMER, null) ?: return null
    return try {
      val json = JSONObject(raw)
      TimerState(
        label = json.getString("taskLabel"),
        finishEpochSec = json.getDouble("finishEpoch"),
        isProRich = json.optBoolean("isProRich", false),
      )
    } catch (_: Throwable) {
      null
    }
  }

  fun ensureChannel(context: Context) {
    val mgr = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (mgr.getNotificationChannel(CHANNEL_ID) == null) {
      val channel = NotificationChannel(CHANNEL_ID, "Running timer", NotificationManager.IMPORTANCE_LOW).apply {
        description = "Shows your live timer while a task is running"
        setShowBadge(false)
      }
      mgr.createNotificationChannel(channel)
    }
  }

  fun post(context: Context, label: String, finishEpochSec: Double, isOverrun: Boolean, isProRich: Boolean) {
    ensureChannel(context)
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
        val m = NotificationCompat.Builder::class.java.getMethod("setRequestPromotedOngoing", Boolean::class.javaPrimitiveType)
        m.invoke(builder, true)
      } catch (_: Throwable) { /* not available → plain ongoing notification */ }
    }

    NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build())
  }

  fun cancel(context: Context) {
    NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
  }

  data class TimerState(val label: String, val finishEpochSec: Double, val isProRich: Boolean)
}
