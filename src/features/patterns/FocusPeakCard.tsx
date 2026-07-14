import { useState } from 'react';
import { View, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { ProCoinPill } from '@/src/components/ProCoinPill';
import { formatWindowRange } from '@/src/lib/time';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { FocusCurve } from '@/src/features/planner/FocusCurve';
import { FocusConfidenceMeter } from '@/src/features/planner/FocusConfidenceMeter';
import { FocusGateRow, type FocusGateState } from '@/src/features/planner/FocusGateRow';
import { FocusRewardPreview } from '@/src/features/planner/FocusRewardPreview';
import { FocusWindowEditorSheet } from '@/src/features/planner/FocusWindowEditorSheet';
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
import { useFocusInsights } from '@/src/features/patterns/useFocusInsights';
import {
  whyNarrative,
  sessionsGateCopy,
  daysGateCopy,
  daysUpcomingCopy,
  focusUnlockedTag,
  focusRewardCaption,
  coarseHintCopy,
  FOCUS_GATE_LABELS,
} from '@/src/features/patterns/focusCopy';
import { useSettingsStore } from '@/src/stores/settingsStore';

// ──────────────────────────────────────────────────────────────────────────────
// FocusPeakCard — the pinned, compact "When you're sharp" card on Patterns.
//
// Mutually exclusive states:
//   forming                (basis === 'forming')            — 2-gate unlock ladder
//   revealed, low conf.    (basis === 'revealed', low)      — coarse block + coarse curve + meter
//   revealed, Pro          (basis === 'revealed', !low)     — window range + precise curve + meter
//   locked (free)          (basis === 'revealed' && !Pro)   — frosted curve + teaser + Unlock CTA
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

  const headerRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  // ── forming — the 2-gate unlock ladder ──
  if (basis === 'forming') {
    const { gates } = win;
    const sDone = gates.sessions.have >= gates.sessions.need;
    const dDone = gates.days.have >= gates.days.need;

    const unlocked = (sDone ? 1 : 0) + (dDone ? 1 : 0);
    const gatesLeft = 2 - unlocked;

    // Exactly one active row: the first gate (in order) that isn't done.
    const sessionsState: FocusGateState = sDone ? 'done' : 'active';
    const daysState: FocusGateState = dDone ? 'done' : !sDone ? 'upcoming' : 'active';

    const sessionsCopy = sessionsGateCopy(gates.sessions.have, gates.sessions.need);
    const daysCopy =
      daysState === 'upcoming'
        ? daysUpcomingCopy(gates.days.have, gates.days.need)
        : daysGateCopy(gates.days.have, gates.days.need);

    const cardTitle = sDone && dDone ? 'Almost there' : 'Learning your focus hours';
    const hint = coarseHintCopy(win.coarseBlockLabel);
    const hintText = hint || "Keep timing and I'll find the hours you focus best.";

    const tagStyle: TextStyle = {
      ...(type.caption as unknown as TextStyle),
      color: t.colors.inkSoft,
    };
    const ladderHead: ViewStyle = { flexDirection: 'row', justifyContent: 'flex-end' };

    return (
      <View style={card}>
        <View style={headerRow}>
          <Eyebrow />
          {isPro ? null : <ProCoinPill icon="ribbon" />}
        </View>
        <FocusRewardPreview scoreByBin={scoreByBin} caption={focusRewardCaption(gatesLeft)} />
        <View style={{ gap: t.space[1.5] }}>
          <AppText style={title}>{cardTitle}</AppText>
          <AppText style={body}>{hintText}</AppText>
        </View>
        <View>
          <View style={ladderHead}>
            <AppText style={tagStyle}>{focusUnlockedTag(unlocked)}</AppText>
          </View>
          <FocusGateRow
            first
            state={sessionsState}
            label={FOCUS_GATE_LABELS.sessions}
            valueText={sessionsCopy.valueText}
            sub={sessionsCopy.sub}
            pips={
              sessionsState === 'active'
                ? { filled: gates.sessions.have, total: gates.sessions.need }
                : undefined
            }
          />
          <FocusGateRow
            state={daysState}
            label={FOCUS_GATE_LABELS.days}
            valueText={daysCopy.valueText}
            sub={daysCopy.sub}
            pips={
              daysState === 'active'
                ? { filled: gates.days.have, total: gates.days.need }
                : undefined
            }
          />
        </View>
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
    win.distinctDays >= 7
      ? `${sampleCount} sessions · steady for ${weeks} weeks`
      : `${sampleCount} sessions · ${win.distinctDays} days`;

  // ── locked (free + revealed) ──
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
          <FocusCurve scoreByBin={scoreByBin} variant="locked" grid />
          <View
            style={frost}
            pointerEvents="none"
            importantForAccessibility="no"
            accessibilityElementsHidden
          >
            <Ionicons name="lock-closed" size={t.iconSize.lg} color={t.colors.onIndigo} />
          </View>
        </View>
        <AppText style={body}>{teaser}</AppText>
        <AppText style={meta}>{`Learned from ${sampleCount} sessions.`}</AppText>
        <Pressable
          onPress={() =>
            router.push({ pathname: '/(modals)/paywall', params: { trigger: 'focus_window' } })
          }
          accessibilityRole="button"
          accessibilityLabel="Unlock my focus window"
        >
          <AppText style={{ ...(type.captionBold as TextStyle), color: t.colors.primary }}>
            Unlock my focus window ›
          </AppText>
        </Pressable>
      </View>
    );
  }

  // ── revealed + Pro, low confidence — coarse block, not yet precise ──
  if (win.confidenceTier === 'low') {
    const blockLabel = win.coarseBlockLabel;
    return (
      <Pressable
        onPress={() => router.push('/(modals)/focus-window')}
        accessibilityRole="button"
        accessibilityLabel="Open focus window detail"
      >
        <View style={card}>
          <Eyebrow />
          <View style={{ gap: t.space[1.5] }}>
            <AppText style={title}>{blockLabel}</AppText>
            <AppText style={meta}>{`around ${formatWindowRange(ws, we)}`}</AppText>
          </View>
          <FocusCurve
            scoreByBin={scoreByBin}
            variant="learned"
            windowStartMin={ws}
            windowEndMin={we}
            peakMin={insights?.peakMin}
            bandVariant="coarse"
            grid
          />
          <FocusConfidenceMeter tier={win.confidenceTier} fill={win.confidence} />
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <AppText style={meta}>{`${sampleCount} sessions · ${win.distinctDays} days`}</AppText>
            <AppText style={{ ...(type.captionBold as TextStyle), color: t.colors.primary }}>
              See details ›
            </AppText>
          </View>
        </View>
      </Pressable>
    );
  }

  // ── revealed + Pro, building/steady — precise window ──
  return (
    <Pressable
      onPress={() => router.push('/(modals)/focus-window')}
      accessibilityRole="button"
      accessibilityLabel="Open focus window detail"
    >
      <View style={card}>
        <Eyebrow />
        <AppText
          style={{ ...(type.honestNumberMd as unknown as TextStyle), color: t.colors.ink }}
          testID="focus-window-range"
        >
          {formatWindowRange(ws, we)}
        </AppText>
        <FocusCurve
          scoreByBin={scoreByBin}
          variant="learned"
          windowStartMin={ws}
          windowEndMin={we}
          peakMin={insights?.peakMin}
          bandVariant="precise"
          grid
        />
        {whyLead ? (
          <AppText style={{ ...(type.body as TextStyle), color: t.colors.ink }}>
            {whyLead}
            {contrastAccent != null ? ', ' : ''}
            {contrastAccent != null ? (
              <AppText
                style={{
                  ...(type.body as TextStyle),
                  color: t.colors.accent,
                  fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
                }}
              >
                {contrastAccent}
              </AppText>
            ) : null}
            {contrastRest}.
          </AppText>
        ) : null}
        <FocusConfidenceMeter tier={win.confidenceTier} fill={win.confidence} />
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <AppText style={meta}>{footerMeta}</AppText>
          <AppText style={{ ...(type.captionBold as TextStyle), color: t.colors.primary }}>
            Open ›
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}
