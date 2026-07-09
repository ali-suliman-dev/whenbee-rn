import { useState } from 'react';
import { View, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { ProCoinPill } from '@/src/components/ProCoinPill';
import { HoneyPips } from '@/src/features/category-detail/HoneyPips';
import { formatWindowRange } from '@/src/lib/time';
import { FW_GATE_MIN_COMPLETED, FW_GATE_MIN_DISTINCT_DAYS } from '@/src/engine/constants';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { FocusCurve } from '@/src/features/planner/FocusCurve';
import { FocusWindowEditorSheet } from '@/src/features/planner/FocusWindowEditorSheet';
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
import { useFocusInsights } from '@/src/features/patterns/useFocusInsights';
import { whyNarrative } from '@/src/features/patterns/focusCopy';
import { useSettingsStore } from '@/src/stores/settingsStore';

// ──────────────────────────────────────────────────────────────────────────────
// FocusPeakCard — the pinned, compact "When you're sharp" card on Patterns.
//
// Three mutually exclusive states:
//   forming            (basis === 'prior')           — dashed curve + maturity progress
//   locked (free)      (basis === 'personal' && !Pro) — frosted curve + teaser + Unlock CTA
//   personal + Pro                                    — window range + curve + why-line, taps to detail
// ──────────────────────────────────────────────────────────────────────────────

export function FocusPeakCard() {
  const t = useTheme();
  const isPro = useEntitlement((s) => s.isPro);
  const win = useLearnedFocusWindow();
  const insights = useFocusInsights(win.startMin, win.endMin);
  const startMin = useSettingsStore((s) => s.windowStartMin);
  const endMin = useSettingsStore((s) => s.windowEndMin);
  const setFocusWindow = useSettingsStore((s) => s.setFocusWindow);
  const [editing, setEditing] = useState(false);

  const { basis, scoreByBin, sampleCount, startMin: ws, endMin: we } = win;

  const card: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.card,
    padding: t.space[5],
    gap: t.space[4],
  };
  const eyebrow: TextStyle = { ...(type.eyebrow as TextStyle), color: t.colors.primary };
  const title: TextStyle = { ...(type.subtitle as TextStyle), color: t.colors.ink };
  const body: TextStyle = { ...(type.body as TextStyle), color: t.colors.inkSoft };
  const meta: TextStyle = { ...(type.caption as TextStyle), color: t.colors.inkFaint };

  const Eyebrow = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[1.5] }}>
      <Ionicons name="flash" size={t.iconSize.xs} color={t.colors.primary} />
      <AppText style={eyebrow}>WHEN YOU&apos;RE SHARP</AppText>
    </View>
  );

  // ── forming ──
  if (basis === 'prior') {
    const countHead: TextStyle = { ...(type.bodyLg as TextStyle), fontWeight: t.fontWeight.bold as TextStyle['fontWeight'] };
    const headerRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' };

    // The window unlocks on THREE gates, not one: enough sessions, enough distinct
    // days, and a peak that clears significance. Show progress against the gate
    // that's actually blocking — never keep asking for sessions once they're in.
    const sessionsMet = sampleCount >= FW_GATE_MIN_COMPLETED;
    const daysMet = win.distinctDays >= FW_GATE_MIN_DISTINCT_DAYS;

    // Which meter (if any) to show below the curve.
    const Meter = () => {
      if (!sessionsMet) {
        const filled = Math.min(sampleCount, FW_GATE_MIN_COMPLETED);
        return (
          <>
            <AppText testID="focus-maturity">
              <AppText style={{ ...countHead, color: t.colors.inkSoft }}>{sampleCount}</AppText>
              <AppText style={{ ...countHead, color: t.colors.inkFaint }}>{`/${FW_GATE_MIN_COMPLETED}`}</AppText>
              <AppText style={{ ...(type.body as TextStyle), color: t.colors.inkFaint }}> sessions</AppText>
            </AppText>
            <HoneyPips filled={filled} total={FW_GATE_MIN_COMPLETED} tone="sunken" />
            <AppText style={body}>Log {FW_GATE_MIN_COMPLETED} timed sessions and I&apos;ll reveal your sharpest hours.</AppText>
          </>
        );
      }
      if (!daysMet) {
        const filled = Math.min(win.distinctDays, FW_GATE_MIN_DISTINCT_DAYS);
        return (
          <>
            <AppText testID="focus-maturity-days">
              <AppText style={{ ...countHead, color: t.colors.inkSoft }}>{win.distinctDays}</AppText>
              <AppText style={{ ...countHead, color: t.colors.inkFaint }}>{`/${FW_GATE_MIN_DISTINCT_DAYS}`}</AppText>
              <AppText style={{ ...(type.body as TextStyle), color: t.colors.inkFaint }}> days</AppText>
            </AppText>
            <HoneyPips filled={filled} total={FW_GATE_MIN_DISTINCT_DAYS} tone="sunken" />
            <AppText style={body}>
              {sampleCount} sessions in — I just need them across {FW_GATE_MIN_DISTINCT_DAYS} different days to trust the peak.
            </AppText>
          </>
        );
      }
      // Sessions and days both met, still no significant peak.
      return (
        <AppText style={body}>
          Your hours look about even so far, so there&apos;s no clear peak yet. Keep logging and I&apos;ll flag one the moment it shows.
        </AppText>
      );
    };

    return (
      <View style={card}>
        <View style={headerRow}>
          <Eyebrow />
          {isPro ? null : <ProCoinPill icon="ribbon" />}
        </View>
        <FocusCurve scoreByBin={scoreByBin} variant="forming" yAxis />
        <AppText style={title}>Learning your focus hours</AppText>
        <Meter />
        <AppButton
          label="Set my hours myself"
          variant="ghost"
          tone="sunken"
          size="md"
          fullWidth
          onPress={() => setEditing(true)}
          accessibilityLabel="Set focus window manually"
        />
        <FocusWindowEditorSheet
          visible={editing}
          startMin={startMin}
          endMin={endMin}
          onConfirm={(s, e) => {
            setFocusWindow(s, e);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </View>
    );
  }

  const whyLead = insights ? whyNarrative(insights.peakMin) : '';
  const contrastAccent = insights?.contrast != null ? `${insights.contrast.toFixed(1)}×` : null;
  const contrastRest = contrastAccent != null ? ' above your dip' : '';

  const weeks = Math.max(1, Math.round(win.distinctDays / 7));
  const footerMeta =
    win.distinctDays >= 7 ? `${sampleCount} sessions · steady for ${weeks} weeks` : `${sampleCount} sessions · ${win.distinctDays} days`;

  // ── locked (free + personal) ──
  if (!isPro) {
    const frost: ViewStyle = {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: t.colors.scrim,
      borderRadius: t.radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    };
    const teaser =
      insights?.contrast != null
        ? `We found your sharpest stretch — ${insights.contrast.toFixed(1)}× above your slump.`
        : 'We found your sharpest stretch.';
    return (
      <View style={card} testID="focus-locked-teaser">
        <Eyebrow />
        <View>
          <FocusCurve scoreByBin={scoreByBin} variant="locked" yAxis />
          <View style={frost} pointerEvents="none" importantForAccessibility="no" accessibilityElementsHidden>
            <Ionicons name="lock-closed" size={t.iconSize.lg} color={t.colors.onIndigo} />
          </View>
        </View>
        <AppText style={body}>{teaser}</AppText>
        <AppText style={meta}>{`Learned from ${sampleCount} sessions.`}</AppText>
        <Pressable
          onPress={() => router.push({ pathname: '/(modals)/paywall', params: { trigger: 'focus_window' } })}
          accessibilityRole="button"
          accessibilityLabel="Unlock my focus window"
        >
          <AppText style={{ ...(type.captionBold as TextStyle), color: t.colors.primary }}>Unlock my focus window ›</AppText>
        </Pressable>
      </View>
    );
  }

  // ── personal + Pro ──
  return (
    <Pressable
      onPress={() => router.push('/(modals)/focus-window')}
      accessibilityRole="button"
      accessibilityLabel="Open focus window detail"
    >
      <View style={card}>
        <Eyebrow />
        <AppText style={{ ...(type.honestNumberMd as unknown as TextStyle), color: t.colors.ink }} testID="focus-window-range">
          {formatWindowRange(ws, we)}
        </AppText>
        <FocusCurve
          scoreByBin={scoreByBin}
          variant="learned"
          windowStartMin={ws}
          windowEndMin={we}
          peakMin={insights?.peakMin}
          yAxis
        />
        {whyLead ? (
          <AppText style={{ ...(type.body as TextStyle), color: t.colors.ink }}>
            {whyLead}
            {contrastAccent != null ? ', ' : ''}
            {contrastAccent != null ? (
              <AppText style={{ ...(type.body as TextStyle), color: t.colors.accent, fontWeight: t.fontWeight.bold as TextStyle['fontWeight'] }}>
                {contrastAccent}
              </AppText>
            ) : null}
            {contrastRest}.
          </AppText>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText style={meta}>{footerMeta}</AppText>
          <AppText style={{ ...(type.captionBold as TextStyle), color: t.colors.primary }}>Open ›</AppText>
        </View>
      </View>
    </Pressable>
  );
}
