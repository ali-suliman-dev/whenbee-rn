package expo.modules.whenbeepresence

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Android analog of the iOS Live Activity. An ONGOING notification whose countdown is ticked
// by the system chronometer (no foreground service, no background JS). The count-up "overrun"
// flip is driven NATIVELY by an exact AlarmManager alarm (see TimerAlarmReceiver) so it works
// even while the app is backgrounded/killed and JS setTimeout is frozen.
class WhenbeePresenceModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context unavailable" }

  private fun alarmPendingIntent(): PendingIntent {
    // Tag the overrun alarm with its action so TimerAlarmReceiver routes it as the finish-flip
    // (and not as a visual progress tick).
    val intent = Intent(context, TimerAlarmReceiver::class.java).setAction(TimerAlarmReceiver.ACTION_OVERRUN)
    return PendingIntent.getBroadcast(
      context,
      PresenceNotifier.ALARM_REQUEST_CODE,
      intent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
  }

  private fun scheduleOverrunAlarm(finishMs: Long) {
    val mgr = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pi = alarmPendingIntent()
    // USE_EXACT_ALARM is auto-granted for timer/alarm apps on API 33+, so no runtime request.
    // Guard the older-API path where the app may lack exact-alarm permission → fall back to an
    // inexact allow-while-idle alarm rather than crashing with SecurityException.
    val canExact = if (android.os.Build.VERSION.SDK_INT >= 31) mgr.canScheduleExactAlarms() else true
    try {
      if (canExact) {
        mgr.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, finishMs, pi)
      } else {
        mgr.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, finishMs, pi)
      }
    } catch (_: SecurityException) {
      mgr.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, finishMs, pi)
    }
  }

  private fun cancelOverrunAlarm() {
    val mgr = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pi = alarmPendingIntent()
    mgr.cancel(pi)
    pi.cancel()
  }

  override fun definition() = ModuleDefinition {
    Name("WhenbeePresence")

    Property("isStub") { false }

    Function("startTimerNotification") { attrs: Map<String, Any?> ->
      val label = attrs["taskLabel"] as? String ?: return@Function
      val finish = (attrs["finishEpoch"] as? Number)?.toDouble() ?: return@Function
      // startEpoch drives the progress bar; fall back to "now" if a caller omits it.
      val start = (attrs["startEpoch"] as? Number)?.toDouble() ?: (System.currentTimeMillis() / 1000.0)
      val proRich = attrs["isProRich"] as? Boolean ?: false

      // Persist for the background alarm, and keep the in-memory fast path.
      PresenceNotifier.saveTimer(context, label, start, finish, proRich)
      lastLabel = label; lastStart = start; lastFinish = finish; lastProRich = proRich

      val finishMs = (finish * 1000).toLong()
      if (finishMs <= System.currentTimeMillis()) {
        // Honest finish already passed — post overrun now, no alarm to schedule.
        PresenceNotifier.post(context, label, finish, isOverrun = true, isProRich = proRich)
      } else {
        PresenceNotifier.post(context, label, finish, isOverrun = false, isProRich = proRich)
        scheduleOverrunAlarm(finishMs)
        // Advance the manual ProgressStyle bar over time (the chronometer already ticks the
        // countdown). This only matters on API 36+, where ProgressStyle renders — skip the
        // repeating wakeups below that, where the fallback determinate bar is a static best-effort.
        if (android.os.Build.VERSION.SDK_INT >= 36) {
          TimerAlarmReceiver.scheduleProgress(context)
        }
      }
    }

    Function("updateTimerNotification") { state: Map<String, Any?> ->
      // Harmless foreground fast-path: idempotently re-post from the retained/persisted state.
      val overrun = state["isOverrun"] as? Boolean ?: false
      val persisted = PresenceNotifier.readTimer(context)
      val label = lastLabel ?: persisted?.label ?: return@Function
      val finish = lastFinish ?: persisted?.finishEpochSec ?: return@Function
      val proRich = lastProRich || (persisted?.isProRich ?: false)
      PresenceNotifier.post(context, label, finish, isOverrun = overrun, isProRich = proRich)
      // A foreground flip to overrun means the bar is full — stop advancing it.
      if (overrun) TimerAlarmReceiver.cancelProgress(context)
    }

    Function("stopTimerNotification") {
      cancelOverrunAlarm()
      TimerAlarmReceiver.cancelProgress(context)
      PresenceNotifier.cancel(context)
      PresenceNotifier.clearTimer(context)
      lastLabel = null; lastStart = null; lastFinish = null; lastProRich = false
    }

    // Generic keyed widget write: JS writes a presentation-ready payload for any widget,
    // native stores it (WidgetDataStore, key "widget.<key>") then rebuilds the matching
    // provider so that surface reflects the latest data immediately. Later tasks add more
    // keys; an unknown key stores the payload but has no provider to refresh yet.
    Function("writeWidgetData") { key: String, json: String ->
      WidgetDataStore.write(context, key, json)
      refreshWidget(key)
    }

    Function("clearWidgetData") { key: String ->
      WidgetDataStore.clear(context, key)
      refreshWidget(key)
    }

    // Back-compat: the next-task snapshot is one keyed slice. Kept so any caller still
    // invoking these keeps working; both delegate to the generic path above.
    Function("writeWidgetSnapshot") { json: String ->
      WidgetDataStore.write(context, KEY_NEXT_TASK, json)
      refreshWidget(KEY_NEXT_TASK)
    }

    Function("clearWidgetSnapshot") {
      WidgetDataStore.clear(context, KEY_NEXT_TASK)
      refreshWidget(KEY_NEXT_TASK)
    }
  }

  // Rebuild the widget provider that owns this key. Only "nextTask" maps to a provider
  // for now; other keys are stored but have no-op refresh until their provider lands.
  private fun refreshWidget(key: String) {
    when (key) {
      KEY_NEXT_TASK -> NextTaskWidgetProvider.updateAll(context)
      KEY_CAPACITY -> DoesTodayFitWidgetProvider.updateAll(context)
      else -> Unit
    }
  }

  // Retained so a foreground overrun update can re-post with the original label/finish.
  private var lastLabel: String? = null
  private var lastStart: Double? = null
  private var lastFinish: Double? = null
  private var lastProRich: Boolean = false

  private companion object {
    // WidgetDataStore key for the next-task widget snapshot.
    const val KEY_NEXT_TASK = "nextTask"
    // WidgetDataStore key for the "Does Today Fit?" capacity widget payload.
    const val KEY_CAPACITY = "capacity"
  }
}
