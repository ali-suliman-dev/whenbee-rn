package expo.modules.whenbeepresence

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import android.text.format.DateFormat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject
import java.util.Date

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
  // v2: IMPORTANCE_DEFAULT (was LOW). A LOW channel lands the timer in the lock screen's
  // SILENT bucket, which the system collapses to a bare app icon — so the promoted Live
  // Update never pins as a card there. DEFAULT keeps it out of the silent bucket (it pins
  // on the lock screen) while sound stays off (setSound(null) below), so nothing beeps.
  // A channel's importance is locked once created, so raising it needs a NEW id.
  const val CHANNEL_ID = "whenbee.timer.v2"
  private const val LEGACY_CHANNEL_ID = "whenbee.timer"
  const val NOTIFICATION_ID = 4711

  // Brand accents (mirror src/theme/tokens.ts). Indigo while running, amber on overrun —
  // tints the app-name row + small icon so the presence reads as Whenbee, not a system chip.
  private const val COLOR_INDIGO = 0xFF6B5BE6.toInt()
  private const val COLOR_AMBER = 0xFFEEAE4D.toInt()

  private const val KEY_TIMER = "timer"
  const val ALARM_REQUEST_CODE = 4711
  // Separate request code so the repeating visual progress alarm is a DISTINCT PendingIntent
  // from the one-shot overrun-flip alarm (cancelling one must never cancel the other).
  const val PROGRESS_REQUEST_CODE = 4712

  // First API level where the promoted "Live Update" chip + ProgressStyle actually render.
  private const val PROMOTED_API = 36

  fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(context.packageName + ".presence", Context.MODE_PRIVATE)

  // Persist the running-timer state so a background alarm can rebuild the notification.
  // startEpochSec is stored so post() (and the background alarm) can compute the elapsed
  // fraction for the progress bar without JS being alive.
  fun saveTimer(
    context: Context,
    label: String,
    startEpochSec: Double,
    finishEpochSec: Double,
    isProRich: Boolean,
    guessFinishEpochSec: Double = 0.0,
  ) {
    val json = JSONObject()
      .put("taskLabel", label)
      .put("startEpoch", startEpochSec)
      .put("finishEpoch", finishEpochSec)
      .put("isProRich", isProRich)
      .put("guessFinishEpoch", guessFinishEpochSec)
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
        guessFinishEpochSec = json.optDouble("guessFinishEpoch", 0.0),
      )
    } catch (_: Throwable) {
      null
    }
  }

  fun ensureChannel(context: Context) {
    val mgr = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    // Retire the old LOW channel so it doesn't linger in the user's notification settings.
    if (mgr.getNotificationChannel(LEGACY_CHANNEL_ID) != null) {
      mgr.deleteNotificationChannel(LEGACY_CHANNEL_ID)
    }
    if (mgr.getNotificationChannel(CHANNEL_ID) == null) {
      val channel = NotificationChannel(CHANNEL_ID, "Running timer", NotificationManager.IMPORTANCE_DEFAULT).apply {
        description = "Shows your live timer on the lock screen while a task is running"
        setShowBadge(false)
        // Silent: DEFAULT importance pins on the lock screen, but the timer must never beep
        // on start or on each progress re-post.
        setSound(null, null)
        enableVibration(false)
        // Show full content on the lock screen (the label + finish time), not "contents hidden".
        lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
      }
      mgr.createNotificationChannel(channel)
    }
  }

  // Deep link that opens the running-timer screen. `action=stop` tells the screen to stop +
  // log immediately (one tap from the lock screen); no action just opens it.
  private fun openTimerPendingIntent(context: Context, stop: Boolean): PendingIntent {
    val uri = "whenbee:///(modals)/timer" + if (stop) "?action=stop" else ""
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri)).apply {
      setPackage(context.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    return PendingIntent.getActivity(
      context,
      if (stop) 1 else 0,
      intent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
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
    val guessSec = readTimer(context)?.guessFinishEpochSec ?: 0.0
    val guessSuffix = if (guessSec > 0.0)
      " · guessed " + DateFormat.getTimeFormat(context).format(Date((guessSec * 1000).toLong()))
    else ""

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(label) // required for promotion
      .setContentText((if (isOverrun) "Over · honest finish was $clock" else "Finish $clock") + guessSuffix)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
      // Accent tint only. NEVER setColorized(true): a colorized notification is
      // DISQUALIFIED from promotion (Android 16 rule), which kills the status-bar chip
      // (drops to a bare icon) and the pinned lock-screen card. setColor is fine.
      .setColor(if (isOverrun) COLOR_AMBER else COLOR_INDIGO)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setContentIntent(openTimerPendingIntent(context, stop = false)) // tap body → open timer
      // Stop from the lock screen — opens the timer already asking to stop + log.
      .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop & log", openTimerPendingIntent(context, stop = true))
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
      // Chip text policy: while RUNNING, DON'T set shortCriticalText — an unset short text lets
      // the promoted chip fall back to the live count-down chronometer, which ticks MM:SS
      // (seconds included) instead of the minutes-only "5m" label. On OVERRUN the chronometer
      // counts UP (a growing "time since finish"), which reads oddly in a glanceable chip, so we
      // pin a short "over" there instead. (Body content text stays "Finish H:mm" / "Over · …".)
      if (isOverrun) {
        builder.setShortCriticalText("over")
      }
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

  data class TimerState(
    val label: String,
    val startEpochSec: Double,
    val finishEpochSec: Double,
    val isProRich: Boolean,
    val guessFinishEpochSec: Double,
  )
}
