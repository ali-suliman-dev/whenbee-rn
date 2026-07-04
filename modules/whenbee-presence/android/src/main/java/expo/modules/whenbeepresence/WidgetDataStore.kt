package expo.modules.whenbeepresence

import android.content.Context

// Generic keyed store for home-screen widget payloads. Every widget owns its own
// slice, so multiple widgets can each keep their own JSON without stepping on one
// another. Backed by the same SharedPreferences file the running-timer state uses
// (context.packageName + ".presence", via PresenceNotifier.prefs), under keys
// "widget.<key>" (e.g. "widget.nextTask", "widget.capacity").
//
// JS owns the payload shape and formatting (see src/services/liveActivity.ts and the
// createAndroidPresence factory); native only stores the string and renders it.
object WidgetDataStore {
  private const val KEY_PREFIX = "widget."

  private fun prefKey(key: String): String = KEY_PREFIX + key

  /** Persist a widget's JSON payload under its key. */
  fun write(context: Context, key: String, json: String) {
    PresenceNotifier.prefs(context).edit().putString(prefKey(key), json).apply()
  }

  /** Remove a widget's payload. */
  fun clear(context: Context, key: String) {
    PresenceNotifier.prefs(context).edit().remove(prefKey(key)).apply()
  }

  /** Read a widget's raw JSON payload, or null when missing / unreadable. Never throws. */
  fun read(context: Context, key: String): String? =
    try {
      PresenceNotifier.prefs(context).getString(prefKey(key), null)
    } catch (_: Throwable) {
      null
    }
}
