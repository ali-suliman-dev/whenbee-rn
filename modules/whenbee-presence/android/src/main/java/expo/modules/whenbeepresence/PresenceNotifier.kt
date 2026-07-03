package expo.modules.whenbeepresence

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.text.format.DateFormat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject
import java.util.Date
import kotlin.math.ceil

// Shared, static-callable builder for the running-timer notification.
// Called from BOTH the Expo module (foreground) AND TimerAlarmReceiver (background/killed),
// so both routes post the SAME notification id with identical styling — the receiver is what
// flips the chronometer to count-up once the honest finish passes, even when JS is frozen.
//
// This is an Android 16 "Live Update": a STANDARD (system-template) promoted ongoing
// notification — status-bar chip near the clock + pinned lock-screen row — built from
// NotificationCompat.ProgressStyle + the built-in chronometer. Promotion FORBIDS a custom
// RemoteViews content view, so there is no custom layout here. On API < 36 the promoted /
// ProgressStyle calls are simply skipped and the user gets a plain ongoing chronometer
// notification (graceful fallback), since these APIs only do anything on API 36+.
object PresenceNotifier {
  const val CHANNEL_ID = "whenbee.timer"
  const val NOTIFICATION_ID = 4711

  private const val KEY_TIMER = "timer"
  const val ALARM_REQUEST_CODE = 4711

  // First API level where the promoted "Live Update" chip + ProgressStyle actually render.
  private const val PROMOTED_API = 36

  fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(context.packageName + ".presence", Context.MODE_PRIVATE)

  // Persist the running-timer state so a background alarm can rebuild the notification.
  // startEpochSec is stored so post() (and the background alarm) can compute the elapsed
  // fraction for the progress bar without JS being alive.
  fun saveTimer(context: Context, label: String, startEpochSec: Double, finishEpochSec: Double, isProRich: Boolean) {
    val json = JSONObject()
      .put("taskLabel", label)
      .put("startEpoch", startEpochSec)
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
        // Older persisted payloads may predate startEpoch — treat as unknown (NaN) so the
        // progress bar falls back to 0 rather than crashing.
        startEpochSec = if (json.has("startEpoch")) json.getDouble("startEpoch") else Double.NaN,
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

  // Builds + posts the running-timer notification. Signature is unchanged so both callers
  // (module + alarm receiver) keep working; startEpoch for the progress bar is read from the
  // persisted timer state, which every caller writes via saveTimer before posting.
  fun post(context: Context, label: String, finishEpochSec: Double, isOverrun: Boolean, isProRich: Boolean) {
    ensureChannel(context)
    val finishMs = (finishEpochSec * 1000).toLong()
    val now = System.currentTimeMillis()

    // Device-local finish clock (respects the user's 12/24h setting).
    val clock = DateFormat.getTimeFormat(context).format(Date(finishMs))

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(label) // required for promotion
      .setContentText(if (isOverrun) "Over · finish was $clock" else "Finish $clock")
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
      .setShowWhen(true)
      .setWhen(finishMs) // future while running → chronometer counts down to it; past → counts up
      .setUsesChronometer(true)
      .setChronometerCountDown(!isOverrun) // down while running, up on overrun

    // startEpoch is persisted alongside the timer; use it to compute the elapsed fraction.
    val startMs = readTimer(context)?.startEpochSec
      ?.takeIf { !it.isNaN() }
      ?.let { (it * 1000).toLong() }
    val pct = progressPct(startMs, finishMs, now, isOverrun)

    if (Build.VERSION.SDK_INT >= PROMOTED_API) {
      // Android 16 Live Update: promote to the status-bar chip + pinned lock-screen row.
      builder.setRequestPromotedOngoing(true)
      // ≤7-char glanceable chip text: remaining minutes while running, "over" past finish.
      builder.setShortCriticalText(if (isOverrun) "over" else remainingShort(finishMs, now))
      // ProgressStyle needs at least one segment to define the track length (0..100 here).
      val progressStyle = NotificationCompat.ProgressStyle()
        .addProgressSegment(NotificationCompat.ProgressStyle.Segment(100))
        .setProgress(pct)
      builder.setStyle(progressStyle)
    } else {
      // Pre-16 fallback: plain ongoing chronometer notification with a legacy determinate bar.
      builder.setProgress(100, pct, false)
    }

    NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build())
  }

  fun cancel(context: Context) {
    NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
  }

  // Elapsed-since-start as a 0..100 percent. Overrun pins to full; unknown start → 0.
  private fun progressPct(startMs: Long?, finishMs: Long, now: Long, isOverrun: Boolean): Int {
    if (isOverrun) return 100
    if (startMs == null) return 0
    val total = finishMs - startMs
    if (total <= 0L) return 0
    val elapsed = now - startMs
    return (elapsed.toDouble() / total.toDouble() * 100.0).toInt().coerceIn(0, 100)
  }

  // Whole minutes remaining, ceil'd and clamped ≥0, e.g. "5m" (≤7 chars for the chip).
  private fun remainingShort(finishMs: Long, now: Long): String {
    val remMs = finishMs - now
    val mins = if (remMs <= 0L) 0 else ceil(remMs / 60000.0).toInt()
    return "${mins.coerceAtLeast(0)}m"
  }

  data class TimerState(
    val label: String,
    val startEpochSec: Double,
    val finishEpochSec: Double,
    val isProRich: Boolean,
  )
}
