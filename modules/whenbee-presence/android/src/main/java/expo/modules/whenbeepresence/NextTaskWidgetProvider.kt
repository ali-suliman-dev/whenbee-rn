package expo.modules.whenbeepresence

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.text.SpannableString
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.text.style.RelativeSizeSpan
import android.widget.RemoteViews
import org.json.JSONObject

// Native Home-screen widget (RemoteViews). Replaces the broken JS widget library.
// It is presentation-only: it renders the snapshot the JS layer already computed and
// stored (see WhenbeePresenceModule.writeWidgetData -> WidgetDataStore key "nextTask",
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
    private const val WIDGET_KEY = "nextTask"

    // colors.inkSoft (dark) — the meridiem suffix is de-emphasized, never amber:
    // amber is reserved for the one CTA (the play button), not label text.
    private val COLOR_INK_SOFT = Color.parseColor("#ADA9B5")

    /**
     * Splits a trailing "am"/"pm" off a formatClockMeridiem() string (e.g. "5:42pm")
     * into a SpannableString with the meridiem shrunk + colored inkSoft and
     * uppercased, so it reads as a quiet unit next to the ink-white hero time, not
     * a same-size sibling. Falls back to plain text (no span) for 24h-format
     * clocks, which carry no meridiem.
     */
    fun heroClockSpan(clock: String): CharSequence {
      val match = Regex("(?i)^(.*\\d)(am|pm)$").find(clock) ?: return clock
      val (time, meridiem) = match.destructured
      val text = "$time ${meridiem.uppercase()}"
      // Span starts at the space itself (not after it) — otherwise the space
      // renders at full hero size (27sp) and reads as a huge gap between the
      // time and the meridiem instead of a couple of pixels.
      val start = time.length
      return SpannableString(text).apply {
        setSpan(ForegroundColorSpan(COLOR_INK_SOFT), start, text.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        setSpan(RelativeSizeSpan(0.45f), start, text.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
      }
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
        views.setTextViewText(R.id.widget_hero, "")
        views.setTextViewText(R.id.widget_guess, "")
        views.setViewVisibility(R.id.widget_honestly, android.view.View.GONE)
        views.setViewVisibility(R.id.widget_guess, android.view.View.GONE)
        views.setOnClickPendingIntent(R.id.widget_start, startPendingIntent(context, null))
        return views
      }

      views.setTextViewText(R.id.widget_label, snapshot.label)
      views.setViewVisibility(R.id.widget_honestly, android.view.View.VISIBLE)
      views.setTextViewText(R.id.widget_hero, heroClockSpan(snapshot.honestFinishClock))
      if (snapshot.guessClock.isBlank()) {
        views.setViewVisibility(R.id.widget_guess, android.view.View.GONE)
      } else {
        views.setViewVisibility(R.id.widget_guess, android.view.View.VISIBLE)
        views.setTextViewText(R.id.widget_guess, "guessed ${snapshot.guessClock}")
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
      val raw = WidgetDataStore.read(context, WIDGET_KEY) ?: return null
      return try {
        val json = JSONObject(raw)
        WidgetSnapshot(
          label = json.optString("nextTaskLabel", ""),
          honestFinishClock = json.optString("honestFinishClock", ""),
          guessClock = json.optString("guessClock", ""),
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
      val guessClock: String,
      val startDeepLink: String,
      val updatedAtEpoch: Double,
      val honestFinishEpoch: Double?,
      val isPro: Boolean,
    )
  }
}
