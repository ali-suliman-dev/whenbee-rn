package expo.modules.whenbeepresence

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject

// Native Home-screen widget (RemoteViews). Replaces the broken JS widget library.
// It is presentation-only: it renders the snapshot the JS layer already computed and
// stored (see WhenbeePresenceModule.writeWidgetSnapshot -> SharedPreferences key "widget",
// written from src/services/liveActivity.ts). The widget never does calibration math.
class NextTaskWidgetProvider : AppWidgetProvider() {

  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray,
  ) {
    for (id in appWidgetIds) {
      appWidgetManager.updateAppWidget(id, buildViews(context))
    }
  }

  companion object {
    private const val KEY_WIDGET = "widget"
    // Seconds after which a snapshot is "stale": drop the confident "Honest finish"
    // prefix and show the bare clock. Mirrors kStaleSeconds / SharedStore.staleSeconds.
    private const val STALE_SECONDS = 6 * 3600

    /**
     * Fraction [0,1] of the way from `updatedAt` to `finish` at `now`.
     * Kotlin port of arcFraction() in src/engine/presence.ts (also mirrored in
     * targets/widget/SharedStore.swift). Keep all three in sync.
     * Negative span -> 0, zero span -> 1 (no divide-by-zero), past finish -> 1.
     */
    fun arcFraction(updatedAt: Double, finish: Double, now: Double): Double {
      val span = finish - updatedAt
      if (span < 0) return 0.0
      if (span == 0.0) return 1.0
      val elapsed = now - updatedAt
      if (elapsed <= 0) return 0.0
      if (elapsed >= span) return 1.0
      return elapsed / span
    }

    /** Trigger a rebuild of every placed instance of the widget. */
    fun updateAll(context: Context) {
      val mgr = AppWidgetManager.getInstance(context)
      val ids = mgr.getAppWidgetIds(
        android.content.ComponentName(context, NextTaskWidgetProvider::class.java),
      )
      if (ids.isEmpty()) return
      val views = buildViews(context)
      for (id in ids) {
        mgr.updateAppWidget(id, views)
      }
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_next_task)
      val snapshot = readSnapshot(context)

      if (snapshot == null || snapshot.label.isBlank()) {
        // Empty state — no task queued.
        views.setTextViewText(R.id.widget_label, context.getString(R.string.widget_empty))
        views.setTextViewText(R.id.widget_finish, "")
        views.setViewVisibility(R.id.widget_finish, View.GONE)
        views.setViewVisibility(R.id.widget_bar, View.GONE)
        views.setOnClickPendingIntent(R.id.widget_start, startPendingIntent(context, null))
        return views
      }

      views.setTextViewText(R.id.widget_label, snapshot.label)

      // Drop the "Honest finish " prefix once the snapshot is stale (> 6h old).
      val nowSec = System.currentTimeMillis() / 1000.0
      val isStale = nowSec - snapshot.updatedAtEpoch > STALE_SECONDS
      val finishText =
        if (isStale) snapshot.honestFinishClock
        else "Honest finish " + snapshot.honestFinishClock
      views.setTextViewText(R.id.widget_finish, finishText)
      views.setViewVisibility(R.id.widget_finish, View.VISIBLE)

      // Pro fill bar: only when isPro and we have a finish epoch to compute against.
      // RemoteViews has no layout-weight setter, so the fraction is shown via a
      // horizontal ProgressBar (max 1000) — robust on every API level from minSdk 24.
      if (snapshot.isPro && snapshot.honestFinishEpoch != null) {
        val fraction = arcFraction(
          snapshot.updatedAtEpoch,
          snapshot.honestFinishEpoch,
          nowSec,
        )
        views.setProgressBar(R.id.widget_bar, 1000, (fraction * 1000).toInt(), false)
        views.setViewVisibility(R.id.widget_bar, View.VISIBLE)
      } else {
        views.setViewVisibility(R.id.widget_bar, View.GONE)
      }

      views.setOnClickPendingIntent(R.id.widget_start, startPendingIntent(context, snapshot.startDeepLink))
      return views
    }

    private fun startPendingIntent(context: Context, deepLink: String?): PendingIntent {
      val uri = Uri.parse(deepLink ?: "whenbee://timer")
      val intent = Intent(Intent.ACTION_VIEW, uri).apply {
        // Keep the implicit VIEW intent inside our own app so it opens the timer.
        setPackage(context.packageName)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      return PendingIntent.getActivity(
        context,
        0,
        intent,
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )
    }

    private fun readSnapshot(context: Context): WidgetSnapshot? {
      val raw = PresenceNotifier.prefs(context).getString(KEY_WIDGET, null) ?: return null
      return try {
        val json = JSONObject(raw)
        WidgetSnapshot(
          label = json.optString("nextTaskLabel", ""),
          honestFinishClock = json.optString("honestFinishClock", ""),
          startDeepLink = json.optString("startDeepLink", "whenbee://timer"),
          updatedAtEpoch = json.optDouble("updatedAtEpoch", 0.0),
          honestFinishEpoch = if (json.has("honestFinishEpoch") && !json.isNull("honestFinishEpoch"))
            json.optDouble("honestFinishEpoch") else null,
          isPro = json.optBoolean("isPro", false),
        )
      } catch (_: Throwable) {
        null // corrupt payload -> quiet empty widget, never throw
      }
    }

    // Mirrors the JS WidgetSnapshot shape (src/services/liveActivity.ts).
    private data class WidgetSnapshot(
      val label: String,
      val honestFinishClock: String,
      val startDeepLink: String,
      val updatedAtEpoch: Double,
      val honestFinishEpoch: Double?,
      val isPro: Boolean,
    )
  }
}
