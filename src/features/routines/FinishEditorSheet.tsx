// src/features/routines/FinishEditorSheet.tsx
//
// Full-screen overlay sheet for setting or clearing a finish-by time.
// Wraps FinishTimeWheel with the same backdrop/sheet shell as StepEditorSheet,
// rendered inside a transparent RN Modal so it covers the real screen even
// when mounted deep inside a scrollable parent (position:absolute alone only
// fills the nearest parent's bounding box, not the viewport).
//
// The Modal is its own native window, NOT a descendant of the app-root
// GestureHandlerRootView, so FinishTimeWheel's pan gestures are dead unless the
// Modal content is re-wrapped in its own GestureHandlerRootView.
//
// The wheel is NOT editable here: a real TextInput inside an Android Modal loses
// its input connection (the OS keyboard opens but keystrokes never register), so
// tap-to-type is disabled and the wheel is the only way to set the time.
// FadeIn only — no spring/bounce/translate.

import { type ReactElement } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  Pressable,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
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

  if (!visible) return null;

  // ─── Styles ─────────────────────────────────────────────────────────────────

  const backdrop: ViewStyle = {
    flex: 1,
    backgroundColor: t.colors.scrim,
    justifyContent: 'flex-end',
  };
  const sheet: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: t.radii.sheet,
    borderTopRightRadius: t.radii.sheet,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    // Android renders no SheetGrabber, so add explicit top breathing room.
    paddingTop: t.space[6],
    paddingBottom: t.space[10],
    gap: t.space[5],
  };
  // Extra air above and below the wheel — it's the hero, so give it its own room
  // on top of the sheet's base gap rhythm.
  const wheelWrap: ViewStyle = { paddingVertical: t.space[3] };
  // Quiet 12px label — the big tappable readout inside the wheel is the hero now.
  const titleStyle: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Re-establish a gesture root inside the Modal's own native window —
          without this the FinishTimeWheel pan gestures never fire. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={backdrop} entering={ENTER}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={onClose}
            accessibilityLabel="Dismiss"
          />
          <View style={sheet}>
            <SheetGrabber />
            <AppText style={titleStyle}>Finish by</AppText>
            <View style={wheelWrap}>
              <FinishTimeWheel
                valueMs={valueMs}
                mode="be done by"
                showModes={false}
                onChange={onChange}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: t.space[2] }}>
              {valueMs !== null ? (
                <AppButton label="Clear" variant="ghost" size="2xs" onPress={onClear} />
              ) : null}
              <AppButton label="Done" variant="indigo" size="sm" onPress={onClose} />
            </View>
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}
