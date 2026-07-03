package expo.modules.whenbeepresence

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// Handles BOTH alarm kinds for the running-timer notification, routed by intent action:
//
//   ACTION_OVERRUN  — the one-shot exact alarm at the honest finish. Flips the notification to
//                     count-up (over-by), even when the app is backgrounded/killed and JS timers
//                     are frozen. It also STOPS the visual progress repeats (a full bar has no
//                     more advancing to do).
//   ACTION_PROGRESS — a lightweight, self-rescheduling INEXACT alarm that only nudges the manual
//                     ProgressStyle bar forward over time (ProgressStyle doesn't auto-advance).
//                     Each tick re-posts with a freshly-computed fill, then queues the next tick.
//
// A legacy alarm from an older build carries no action; it's treated as the overrun flip so an
// in-flight upgrade still behaves. Missing/parse-failed timer state → no-op (readTimer == null).
class TimerAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val state = PresenceNotifier.readTimer(context) ?: return
    val finishMs = (state.finishEpochSec * 1000).toLong()
    val now = System.currentTimeMillis()

    when (intent?.action) {
      ACTION_PROGRESS -> {
        if (now >= finishMs) {
          // Finish arrived between ticks: flip to overrun (full bar) and stop advancing.
          PresenceNotifier.post(context, state.label, state.finishEpochSec, isOverrun = true, isProRich = state.isProRich)
          cancelProgress(context)
        } else {
          // Still running: re-post so post() recomputes the elapsed fraction, then queue the next
          // tick. setOnlyAlertOnce(true) inside post() means this never re-buzzes; the system
          // chronometer keeps ticking the countdown smoothly on its own.
          PresenceNotifier.post(context, state.label, state.finishEpochSec, isOverrun = false, isProRich = state.isProRich)
          scheduleProgress(context)
        }
      }
      else -> {
        // ACTION_OVERRUN (or a legacy no-action alarm): flip to count-up and stop the repeats.
        PresenceNotifier.post(context, state.label, state.finishEpochSec, isOverrun = true, isProRich = state.isProRich)
        cancelProgress(context)
      }
    }
  }

  companion object {
    const val ACTION_OVERRUN = "expo.modules.whenbeepresence.action.OVERRUN"
    const val ACTION_PROGRESS = "expo.modules.whenbeepresence.action.PROGRESS_UPDATE"

    // ~45s cadence: advances the bar on a seconds-to-minute scale while staying battery-cheap
    // (well under any promoted-update rate limit). Self-rescheduled single-shots, not
    // setInexactRepeating, because the latter floors sub-15-min intervals at 15 min.
    private const val PROGRESS_INTERVAL_MS = 45_000L

    private fun progressPendingIntent(context: Context): PendingIntent {
      val intent = Intent(context, TimerAlarmReceiver::class.java).setAction(ACTION_PROGRESS)
      return PendingIntent.getBroadcast(
        context,
        PresenceNotifier.PROGRESS_REQUEST_CODE,
        intent,
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )
    }

    // Queues ONE inexact progress tick ~PROGRESS_INTERVAL_MS out. RTC (not RTC_WAKEUP): the bar
    // is purely visual, so there's no reason to wake a dozing device just to nudge a segment —
    // the update naturally coalesces to the next time the screen/notification is looked at.
    fun scheduleProgress(context: Context) {
      val mgr = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      mgr.set(AlarmManager.RTC, System.currentTimeMillis() + PROGRESS_INTERVAL_MS, progressPendingIntent(context))
    }

    fun cancelProgress(context: Context) {
      val mgr = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val pi = progressPendingIntent(context)
      mgr.cancel(pi)
      pi.cancel()
    }
  }
}
