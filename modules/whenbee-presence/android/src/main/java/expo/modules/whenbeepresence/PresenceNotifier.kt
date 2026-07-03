package expo.modules.whenbeepresence

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.SharedPreferences
import android.os.SystemClock
import android.text.format.DateFormat
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject
import java.util.Date

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

  // NOTE: `isProRich` is retained on the signature (callers still pass it) but is no longer
  // used to request the Android 16 promoted ongoing "Live Update" chip. That promoted mode is
  // INCOMPATIBLE with a custom content view — the platform rejects a promoted ongoing
  // notification that supplies its own RemoteViews — and the founder wants the timer-forward
  // custom layout to win. See the tradeoff note in post() below.
  @Suppress("UNUSED_PARAMETER")
  fun post(context: Context, label: String, finishEpochSec: Double, isOverrun: Boolean, isProRich: Boolean) {
    ensureChannel(context)
    val finishMs = (finishEpochSec * 1000).toLong()

    // Custom, timer-forward content view: small muted status line on top, big live timer below.
    val remoteViews = RemoteViews(context.packageName, R.layout.notif_running)

    // Status line uses the device-local finish clock (respects the user's 12/24h setting).
    val finishClock = DateFormat.getTimeFormat(context).format(Date(finishMs))
    val status =
      if (isOverrun) "Over · finish was $finishClock" else "Running · finish $finishClock"
    remoteViews.setTextViewText(R.id.notif_status, status)

    // Overrun tints the timer amber; running keeps it bone-white. Chronometer is a TextView,
    // so setTextColor is a valid RemoteViews remote method.
    remoteViews.setTextColor(R.id.notif_timer, if (isOverrun) 0xFFEEAE4D.toInt() else 0xFFF4F1EA.toInt())

    // Base = elapsed-realtime instant that maps to the honest finish. The SYSTEM ticks the
    // Chronometer from this base, so it keeps counting even when backgrounded/locked and JS is
    // frozen: counts DOWN to finish while running, counts UP from it once overrun.
    val base = SystemClock.elapsedRealtime() + (finishMs - System.currentTimeMillis())
    remoteViews.setChronometerCountDown(R.id.notif_timer, !isOverrun)
    remoteViews.setChronometer(R.id.notif_timer, base, null, true)

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(context.applicationInfo.icon)
      .setStyle(NotificationCompat.DecoratedCustomViewStyle())
      .setCustomContentView(remoteViews)
      .setOngoing(true)
      .setOnlyAlertOnce(true)

    // TRADEOFF: we deliberately do NOT call setRequestPromotedOngoing (Android 16 API 36 "Live
    // Update" status-bar chip) here. A promoted ongoing notification may not carry a custom
    // content view — the platform rejects the combination — and the founder wants the big
    // timer-forward custom layout. To revert to the promoted chip, drop setCustomContentView +
    // DecoratedCustomViewStyle and re-add the reflection-guarded setRequestPromotedOngoing call
    // (see git history for the previous standard-template implementation).

    NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build())
  }

  fun cancel(context: Context) {
    NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
  }

  data class TimerState(val label: String, val finishEpochSec: Double, val isProRich: Boolean)
}
