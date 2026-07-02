package expo.modules.whenbeepresence

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// Fires at the honest finish via an exact AlarmManager alarm, so the notification flips to
// count-up (over-by) even when the app is backgrounded or killed and JS timers are frozen.
// Reads the persisted running-timer state and re-posts the SAME notification id as overrun.
class TimerAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val state = PresenceNotifier.readTimer(context) ?: return
    PresenceNotifier.post(
      context,
      label = state.label,
      finishEpochSec = state.finishEpochSec,
      isOverrun = true,
      isProRich = state.isProRich,
    )
  }
}
