import { useState } from 'react';
import { View, ScrollView, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { formatClock } from '@/src/lib/time';
import { FW_GATE_MIN_COMPLETED } from '@/src/engine/constants';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { FocusCurve } from './FocusCurve';
import { FocusWindowCard } from './FocusWindowCard';
import { FocusWindowEditorSheet } from './FocusWindowEditorSheet';
import { useLearnedFocusWindow } from './useLearnedFocusWindow';
import { useSettingsStore } from '@/src/stores/settingsStore';

// ──────────────────────────────────────────────────────────────────────────────
// FocusMode — the Focus tab in the Plan screen.
//
// Three mutually exclusive states:
//   forming  (basis === 'prior')              — learning, show progress
//   learned + Pro                             — full window card
//   learned + Free (basis === 'personal')     — locked curve + unlock CTA
//
// Exactly ONE filled CTA per screen (per the 60-30-10 rule):
//   forming → none (ghost button only)
//   learned + Pro → none (already in FocusWindowCard)
//   learned + Free → indigo "Unlock my focus window"
// ──────────────────────────────────────────────────────────────────────────────

/** Minutes-after-midnight → a clock string via the app formatter. */
function clockFor(min: number): string {
  const d = new Date();
  d.setHours(Math.floor(min / 60), min % 60, 0, 0);
  return formatClock(d.getTime());
}

export function FocusMode() {
  const t = useTheme();
  const isPro = useEntitlement((s) => s.isPro);
  const window = useLearnedFocusWindow();
  const startMin = useSettingsStore((s) => s.windowStartMin);
  const endMin = useSettingsStore((s) => s.windowEndMin);
  const setFocusWindow = useSettingsStore((s) => s.setFocusWindow);

  const [editing, setEditing] = useState(false);

  const { basis, scoreByBin, sampleCount, startMin: learnedStart, endMin: learnedEnd } = window;

  const windowLabel =
    learnedStart !== null && learnedEnd !== null
      ? `${clockFor(learnedStart)}–${clockFor(learnedEnd)}`
      : null;

  const scrollStyle: ViewStyle = { flex: 1 };
  const contentStyle: ViewStyle = { padding: t.space[5], gap: t.space[6] };

  const eyebrowStyle: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.primary,
  };

  const titleStyle: TextStyle = {
    ...(type.subtitle as unknown as TextStyle),
    color: t.colors.ink,
    marginTop: t.space[1],
  };

  const bodyStyle: TextStyle = {
    ...(type.body as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  const metaStyle: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkFaint,
  };

  const progressStyle: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  // ── State 1: forming (basis === 'prior') ─────────────────────────────────────
  if (basis === 'prior') {
    return (
      <ScrollView style={scrollStyle} contentContainerStyle={contentStyle} showsVerticalScrollIndicator={false}>
        <View style={{ gap: t.space[3] }}>
          <AppText style={eyebrowStyle}>YOUR FOCUS WINDOW</AppText>
          <FocusCurve scoreByBin={scoreByBin} variant="forming" />
          <AppText style={titleStyle}>Learning your focus hours</AppText>
          <AppText style={bodyStyle}>
            {"I'm watching when your work goes sharpest. A few more sessions and your window shows up here."}
          </AppText>
          <AppText style={progressStyle}>
            {sampleCount} / {FW_GATE_MIN_COMPLETED} sessions
          </AppText>
          <AppButton
            label="Set my hours myself"
            variant="ghost"
            size="sm"
            onPress={() => setEditing(true)}
          />
        </View>

        <FocusWindowEditorSheet
          visible={editing}
          startMin={startMin}
          endMin={endMin}
          onConfirm={(nextStart, nextEnd) => {
            setFocusWindow(nextStart, nextEnd);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </ScrollView>
    );
  }

  // ── State 2: learned + Pro ────────────────────────────────────────────────────
  if (isPro) {
    return (
      <ScrollView style={scrollStyle} contentContainerStyle={contentStyle} showsVerticalScrollIndicator={false}>
        <View style={{ gap: t.space[3] }}>
          <FocusCurve
            scoreByBin={scoreByBin}
            variant="learned"
            windowStartMin={learnedStart ?? undefined}
            windowEndMin={learnedEnd ?? undefined}
          />
          {windowLabel ? (
            <AppText style={eyebrowStyle}>{windowLabel}</AppText>
          ) : null}
          <AppText style={metaStyle}>
            {`Learned from ${sampleCount} sessions · your most productive logged hours`}
          </AppText>
        </View>
        <FocusWindowCard />
      </ScrollView>
    );
  }

  // ── State 3: learned + Free ───────────────────────────────────────────────────
  const frostStyle: ViewStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: t.colors.scrim,
    borderRadius: t.radii.card,
    justifyContent: 'center',
    alignItems: 'center',
  };

  const lockTextStyle: TextStyle = {
    fontSize: t.fontSize.xl,
    color: t.colors.onIndigo,
  };

  return (
    <ScrollView style={scrollStyle} contentContainerStyle={contentStyle} showsVerticalScrollIndicator={false}>
      <View style={{ gap: t.space[3] }}>
        <View>
          <FocusCurve scoreByBin={scoreByBin} variant="locked" />
          <View style={frostStyle} pointerEvents="none">
            <AppText style={lockTextStyle}>🔒</AppText>
          </View>
        </View>
        <AppText style={titleStyle}>{"We found your sharpest stretch."}</AppText>
        <AppText style={bodyStyle}>
          {`Learned from ${sampleCount} sessions. Unlock to see your exact window — and fit the right tasks into it.`}
        </AppText>
        <AppButton
          label="Unlock my focus window"
          variant="indigo"
          size="md"
          fullWidth
          accessibilityLabel="Unlock my focus window"
          onPress={() =>
            router.push({
              pathname: '/(modals)/paywall',
              params: { trigger: 'focus_window' },
            })
          }
        />
      </View>
    </ScrollView>
  );
}
