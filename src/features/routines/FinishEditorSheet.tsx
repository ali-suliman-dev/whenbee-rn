// src/features/routines/FinishEditorSheet.tsx
//
// In-surface overlay sheet for setting or clearing a routine's finish-by time.
// Wraps FinishTimeWheel with the same backdrop/sheet shell as StepEditorSheet.
// FadeIn only — no spring/bounce/translate.

import { type ReactElement } from 'react';
import { StyleSheet, View, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { tokens } from '@/src/theme/tokens';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { FinishTimeWheel } from '@/src/features/planner/FinishTimeWheel';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

interface FinishEditorSheetProps {
  visible: boolean;
  valueMs: number | null;
  onChange: (ms: number) => void;
  onClear: () => void;
  onClose: () => void;
}

// ──────────────────────────────────────────────────────────────────────────────
// Animation — opacity FadeIn only; no spring/bounce/translate
// ──────────────────────────────────────────────────────────────────────────────

const ENTER = FadeIn.duration(tokens.motion.base).reduceMotion(ReduceMotion.System);

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export function FinishEditorSheet({
  visible,
  valueMs,
  onChange,
  onClear,
  onClose,
}: FinishEditorSheetProps): ReactElement | null {
  const t = useTheme();
  const { t: tr } = useTranslation('routines');

  if (!visible) return null;

  // ─── Styles ─────────────────────────────────────────────────────────────────

  const backdrop: ViewStyle = {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.scrim,
    justifyContent: 'flex-end',
  };
  const sheet: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: t.radii.sheet,
    borderTopRightRadius: t.radii.sheet,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingBottom: t.space[6],
    gap: t.space[4],
  };
  const titleStyle: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Animated.View style={backdrop} entering={ENTER}>
      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={onClose}
        accessibilityLabel={tr('finishSheet.dismissA11y')}
      />
      <View style={sheet}>
        <SheetGrabber />
        <AppText style={titleStyle}>{tr('finishSheet.title')}</AppText>
        <FinishTimeWheel valueMs={valueMs} mode="be done by" showModes={false} onChange={onChange} />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: t.space[2] }}>
          {valueMs !== null ? (
            <AppButton label={tr('finishSheet.clear')} variant="ghost" size="2xs" onPress={onClear} />
          ) : null}
          <AppButton label={tr('finishSheet.done')} variant="indigo" size="2xs" onPress={onClose} />
        </View>
      </View>
    </Animated.View>
  );
}
