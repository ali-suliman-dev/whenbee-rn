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

// Native "Does Today Fit?" Home-screen widget (RemoteViews, Pro).
// Presentation-only: it renders the CapacityWidgetData snapshot the JS layer already
// computed and stored (WhenbeePresenceModule.writeWidgetData -> WidgetDataStore key
// "capacity", written from src/features/today/useCapacityWidgetPublisher.ts). The widget
// never does capacity math.
//
// Pro-gate-at-source is enforced upstream: a free user's payload is ALWAYS the locked
// sentinel { isPro: false } — no verdict, no minutes. This provider additionally renders a
// quiet locked state (no bar, no numbers) whenever isPro is false OR the payload is
// missing/corrupt, so nothing about the day-load ever leaks on the free path.
class DoesTodayFitWidgetProvider : AppWidgetProvider() {

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
    private const val WIDGET_KEY = "capacity"

    // Bar fill by verdict. The payload only carries slack/overBy (not committed/window),
    // so the fill is a deliberate, honest-by-verdict indication rather than an exact ratio:
    // a day with room reads part-full, a snug day reads nearly full, an over day reads full.
    // Never red — the "over" fill is the same amber accent (no-guilt invariant).
    private const val FILL_COMFORTABLE = 620 // ~62%
    private const val FILL_SNUG = 860 // ~86%
    private const val FILL_OVER = 1000 // full

    /** Trigger a rebuild of every placed instance of the widget. */
    fun updateAll(context: Context) {
      val mgr = AppWidgetManager.getInstance(context)
      val ids = mgr.getAppWidgetIds(
        android.content.ComponentName(context, DoesTodayFitWidgetProvider::class.java),
      )
      if (ids.isEmpty()) return
      val views = buildViews(context)
      for (id in ids) {
        mgr.updateAppWidget(id, views)
      }
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_does_today_fit)
      val snapshot = readSnapshot(context)

      // Locked / free / empty: quiet teaser, NO bar, NO numbers (gate value AND marker).
      // Tap opens the paywall.
      if (snapshot == null || !snapshot.isPro) {
        views.setTextViewText(R.id.dtf_verdict, context.getString(R.string.does_today_fit_locked))
        views.setTextViewText(R.id.dtf_caption, context.getString(R.string.does_today_fit_pro))
        views.setViewVisibility(R.id.dtf_caption, View.VISIBLE)
        views.setViewVisibility(R.id.dtf_bar, View.GONE)
        views.setOnClickPendingIntent(R.id.dtf_root, activityPendingIntent(context, "whenbee://paywall"))
        return views
      }

      val isOver = snapshot.verdict == "over"
      if (isOver) {
        views.setTextViewText(
          R.id.dtf_verdict,
          context.getString(R.string.does_today_fit_over, fmtHm(snapshot.overByMin)),
        )
        views.setTextViewText(R.id.dtf_caption, context.getString(R.string.does_today_fit_over_caption))
      } else {
        views.setTextViewText(R.id.dtf_verdict, context.getString(R.string.does_today_fit_fits))
        // Only surface a slack caption when there's meaningful room to report.
        if (snapshot.slackMin > 0) {
          views.setTextViewText(
            R.id.dtf_caption,
            context.getString(R.string.does_today_fit_slack, fmtHm(snapshot.slackMin)),
          )
        } else {
          views.setTextViewText(R.id.dtf_caption, context.getString(R.string.does_today_fit_fits_caption))
        }
      }
      views.setViewVisibility(R.id.dtf_caption, View.VISIBLE)

      val fill = when (snapshot.verdict) {
        "over" -> FILL_OVER
        "snug" -> FILL_SNUG
        else -> FILL_COMFORTABLE
      }
      views.setProgressBar(R.id.dtf_bar, 1000, fill, false)
      views.setViewVisibility(R.id.dtf_bar, View.VISIBLE)

      views.setOnClickPendingIntent(R.id.dtf_root, activityPendingIntent(context, "whenbee://today"))
      return views
    }

    /**
     * "Xh Ym" for >= 60 min ("Xh" when it divides evenly), else "~N min".
     * Mirrors the app's fmtHm-style short duration used in the capacity copy.
     */
    private fun fmtHm(min: Int): String {
      if (min >= 60) {
        val h = min / 60
        val m = min % 60
        return if (m == 0) "${h}h" else "${h}h ${m}m"
      }
      return "~$min min"
    }

    private fun activityPendingIntent(context: Context, deepLink: String): PendingIntent {
      val uri = Uri.parse(deepLink)
      val intent = Intent(Intent.ACTION_VIEW, uri).apply {
        // Keep the implicit VIEW intent inside our own app.
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

    private fun readSnapshot(context: Context): CapacitySnapshot? {
      val raw = WidgetDataStore.read(context, WIDGET_KEY) ?: return null
      return try {
        val json = JSONObject(raw)
        val isPro = json.optBoolean("isPro", false)
        // Free/locked sentinel carries only { isPro: false } — return it as-is; buildViews
        // renders the locked state and never reads the (absent) numbers.
        if (!isPro) return CapacitySnapshot(verdict = "", slackMin = 0, overByMin = 0, isPro = false)
        CapacitySnapshot(
          verdict = json.optString("verdict", "comfortable"),
          slackMin = json.optInt("slackMin", 0),
          overByMin = json.optInt("overByMin", 0),
          isPro = true,
        )
      } catch (_: Throwable) {
        null // corrupt payload -> quiet locked widget, never throw
      }
    }

    // Mirrors the JS CapacityWidgetData / LockedCapacityWidgetData shapes
    // (src/services/presence/widgetData.ts).
    private data class CapacitySnapshot(
      val verdict: String,
      val slackMin: Int,
      val overByMin: Int,
      val isPro: Boolean,
    )
  }
}
