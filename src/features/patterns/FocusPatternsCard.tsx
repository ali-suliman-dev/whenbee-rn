import { useState } from 'react';
import { View, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { formatClockMeridiem } from '@/src/lib/time';
import { FW_GATE_MIN_COMPLETED } from '@/src/engine/constants';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { FocusCurve } from '@/src/features/planner/FocusCurve';
import { FocusWindowEditorSheet } from '@/src/features/planner/FocusWindowEditorSheet';
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
import { useSettingsStore } from '@/src/stores/settingsStore';

// ──────────────────────────────────────────────────────────────────────────────
// FocusPatternsCard — the focus curve + window detail in the Patterns screen.
//
// Migrated from FocusMode (Plan tab). Reuses FocusCurve + FocusWindowEditorSheet.
// NO task-packing (that's the Timeline — Phase 4).
//
// Three mutually exclusive states:
//   forming  (basis === 'prior')          — dashed curve + maturity progress
//   learned + Pro                         — full curve + window range + maturity + edit
//   learned + Free (basis === 'personal') — locked curve + frosted teaser + unlock CTA
// ──────────────────────────────────────────────────────────────────────────────

/** Minutes-after-midnight → a meridiem clock string e.g. "9:00am". */
function clockFor(min: number): string {
  const d = new Date();
  d.setHours(Math.floor(min / 60), min % 60, 0, 0);
  return formatClockMeridiem(d.getTime());
}

export function FocusPatternsCard() {
  const t = useTheme();
  const isPro = useEntitlement((s) => s.isPro);
  const window = useLearnedFocusWindow();
  const startMin = useSettingsStore((s) => s.windowStartMin);
  const endMin = useSettingsStore((s) => s.windowEndMin);
  const setFocusWindow = useSettingsStore((s) => s.setFocusWindow);

  const [editing, setEditing] = useState(false);

  const { basis, scoreByBin, sampleCount, startMin: learnedStart, endMin: learnedEnd } = window;

  const isPersonal = basis === 'personal';

  const windowRange =
    isPersonal
      ? `${clockFor(learnedStart)}–${clockFor(learnedEnd)}`
      : null;

  // ── Shared styles ────────────────────────────────────────────────────────────
  const cardStyle: ViewStyle = {
    gap: t.space[3],
  };

  const eyebrowStyle: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  const windowTimeStyle: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.primary,
    textTransform: 'none',
  };

  const titleStyle: TextStyle = {
    ...(type.subtitle as unknown as TextStyle),
    color: t.colors.ink,
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
      <View style={cardStyle}>
        <FocusCurve scoreByBin={scoreByBin} variant="forming" />
        <AppText style={titleStyle}>Learning your focus hours</AppText>
        <AppText style={bodyStyle}>
          {"A few more sessions and your focus window shows up here."}
        </AppText>
        <AppText
          testID="focus-maturity"
          style={progressStyle}
          accessibilityLabel={`Focus window progress: ${sampleCount} of ${FW_GATE_MIN_COMPLETED} sessions`}
        >
          {`${sampleCount} / ${FW_GATE_MIN_COMPLETED} sessions`}
        </AppText>
        <AppButton
          label="Set my hours myself"
          variant="ghost"
          size="sm"
          accessibilityLabel="Set focus window manually"
          onPress={() => setEditing(true)}
        />

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
      </View>
    );
  }

  // ── State 2: learned + Free — locked teaser ───────────────────────────────────
  if (!isPro) {
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
      <View style={cardStyle} testID="focus-locked-teaser">
        <View>
          <FocusCurve scoreByBin={scoreByBin} variant="locked" />
          <View style={frostStyle} pointerEvents="none">
            <AppText style={lockTextStyle}>🔒</AppText>
          </View>
        </View>
        <AppText style={titleStyle}>{"We found your sharpest stretch."}</AppText>
        <AppText style={bodyStyle}>
          {`Learned from ${sampleCount} sessions. Unlock to see your exact window.`}
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
    );
  }

  // ── State 3: learned + Pro — full curve + window + maturity + edit ────────────
  return (
    <View style={cardStyle}>
      <FocusCurve
        scoreByBin={scoreByBin}
        variant="learned"
        windowStartMin={learnedStart}
        windowEndMin={learnedEnd}
      />

      {windowRange ? (
        <AppText
          testID="focus-window-range"
          style={windowTimeStyle}
          accessibilityLabel={`Your focus window: ${windowRange}`}
        >
          {windowRange}
        </AppText>
      ) : null}

      <AppText
        testID="focus-maturity"
        style={metaStyle}
        accessibilityLabel={`Focus window learned from ${sampleCount} sessions`}
      >
        {isPersonal
          ? `Based on your last ${sampleCount} sessions`
          : `${sampleCount} / ${FW_GATE_MIN_COMPLETED} sessions`}
      </AppText>

      <Pressable
        accessibilityLabel="Edit focus window"
        accessibilityRole="button"
        onPress={() => setEditing(true)}
      >
        <View>
          <AppText style={[eyebrowStyle, { color: t.colors.primary, textTransform: 'none' }]}>
            Edit window
          </AppText>
        </View>
      </Pressable>

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
    </View>
  );
}
