package expo.modules.whenbeepresence

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject

// Native "Your Bias" Home-screen widget (RemoteViews, Pro).
// Presentation-only: it renders the BiasWidgetData snapshot the JS layer already computed and
// stored (WhenbeePresenceModule.writeWidgetData -> WidgetDataStore key "bias", written from the
// bias widget publisher). The widget never derives the bias, the multiplier, or the tier.
//
// Three states, kept strictly non-leaky on the free path:
//   1. Pro + data      -> categoryLabel title, the pre-formatted multiplierText VERBATIM as the
//                         hero line (e.g. "1.4× over" — no "you run" prefix re-added), tier caption.
//   2. Pro + no data    -> a quiet neutral "Keep logging to learn your bias." — no number, no
//                         category. This is the "not enough data yet" state, NOT the locked one.
//   3. Free / locked    -> a quiet "Your bias" + "Pro" with NO category and NO number (gate value
//                         AND marker — a free user sees neither which category nor the multiplier).
//
// Distinguishing locked from no-data at the native layer: the JS side publishes { isPro: false }
// (parseable) for a free user, but CLEARS the key (-> null) when a Pro user has no qualifying
// category yet. So: parsed-with-isPro:false -> locked; null/absent/corrupt -> keep-logging.
class YourBiasWidgetProvider : AppWidgetProvider() {

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
    private const val WIDGET_KEY = "bias"

    private val COLOR_INK = Color.parseColor("#F4F1EA")
    private val COLOR_INK_SOFT = Color.parseColor("#ADA9B5")
    private val COLOR_ACCENT = Color.parseColor("#EEAE4D")

    /** Trigger a rebuild of every placed instance of the widget. */
    fun updateAll(context: Context) {
      val mgr = AppWidgetManager.getInstance(context)
      val ids = mgr.getAppWidgetIds(
        android.content.ComponentName(context, YourBiasWidgetProvider::class.java),
      )
      if (ids.isEmpty()) return
      val views = buildViews(context)
      for (id in ids) {
        mgr.updateAppWidget(id, views)
      }
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_your_bias)
      val snapshot = readSnapshot(context)

      // Locked / free: quiet teaser, NO category, NO number (gate value AND marker).
      // Tap opens the paywall. Distinguished from no-data by a parseable { isPro: false }.
      if (snapshot != null && !snapshot.isPro) {
        views.setViewVisibility(R.id.yb_category, View.GONE)
        views.setTextViewText(R.id.yb_value, context.getString(R.string.your_bias_locked))
        views.setTextColor(R.id.yb_value, COLOR_INK)
        views.setTextViewTextSize(R.id.yb_value, TypedValue.COMPLEX_UNIT_SP, 20f)
        views.setTextViewText(R.id.yb_tier, context.getString(R.string.your_bias_pro))
        views.setTextColor(R.id.yb_tier, COLOR_ACCENT)
        views.setTextViewTextSize(R.id.yb_tier, TypedValue.COMPLEX_UNIT_SP, 13f)
        views.setViewVisibility(R.id.yb_tier, View.VISIBLE)
        views.setOnClickPendingIntent(R.id.yb_root, activityPendingIntent(context, "whenbee://paywall"))
        return views
      }

      // No qualifying category (payload cleared/absent/corrupt): quiet neutral state for a Pro
      // user, still no number. Tap opens Patterns (harmless — nothing sensitive is shown).
      if (snapshot == null || snapshot.categoryLabel.isEmpty() || snapshot.multiplierText.isEmpty()) {
        views.setViewVisibility(R.id.yb_category, View.GONE)
        views.setTextViewText(R.id.yb_value, context.getString(R.string.your_bias_empty))
        views.setTextColor(R.id.yb_value, COLOR_INK_SOFT)
        views.setTextViewTextSize(R.id.yb_value, TypedValue.COMPLEX_UNIT_SP, 16f)
        views.setViewVisibility(R.id.yb_tier, View.GONE)
        views.setOnClickPendingIntent(R.id.yb_root, activityPendingIntent(context, "whenbee://patterns"))
        return views
      }

      // Pro + data: category title, hero multiplierText VERBATIM, subtle tier caption.
      views.setTextViewText(R.id.yb_category, snapshot.categoryLabel)
      views.setViewVisibility(R.id.yb_category, View.VISIBLE)

      views.setTextViewText(R.id.yb_value, snapshot.multiplierText)
      views.setTextColor(R.id.yb_value, COLOR_ACCENT)
      views.setTextViewTextSize(R.id.yb_value, TypedValue.COMPLEX_UNIT_SP, 24f)

      if (snapshot.tier.isEmpty()) {
        views.setViewVisibility(R.id.yb_tier, View.GONE)
      } else {
        views.setTextViewText(R.id.yb_tier, snapshot.tier)
        views.setTextColor(R.id.yb_tier, COLOR_INK_SOFT)
        views.setTextViewTextSize(R.id.yb_tier, TypedValue.COMPLEX_UNIT_SP, 12f)
        views.setViewVisibility(R.id.yb_tier, View.VISIBLE)
      }

      views.setOnClickPendingIntent(R.id.yb_root, activityPendingIntent(context, "whenbee://patterns"))
      return views
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

    private fun readSnapshot(context: Context): BiasSnapshot? {
      val raw = WidgetDataStore.read(context, WIDGET_KEY) ?: return null // no data -> keep-logging
      return try {
        val json = JSONObject(raw)
        val isPro = json.optBoolean("isPro", false)
        // Free/locked sentinel carries only { isPro: false } — return it as-is; buildViews
        // renders the locked state and never reads the (absent) category/number.
        if (!isPro) return BiasSnapshot(categoryLabel = "", multiplierText = "", tier = "", isPro = false)
        BiasSnapshot(
          categoryLabel = json.optString("categoryLabel", ""),
          multiplierText = json.optString("multiplierText", ""),
          tier = json.optString("tier", ""),
          isPro = true,
        )
      } catch (_: Throwable) {
        null // corrupt payload -> quiet keep-logging, never throw (no number leaks either way)
      }
    }

    // Mirrors the JS BiasWidgetData shape: { categoryLabel, multiplierText, tier, isPro,
    // updatedAtEpoch }. multiplierText is already formatted in JS and rendered verbatim.
    private data class BiasSnapshot(
      val categoryLabel: String,
      val multiplierText: String,
      val tier: String,
      val isPro: Boolean,
    )
  }
}
