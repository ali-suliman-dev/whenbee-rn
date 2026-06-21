import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, View, type ViewStyle, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { FinishTimeWheel } from './FinishTimeWheel';

// ──────────────────────────────────────────────────────────────────────────────
// FocusWindowEditorSheet — the two-stop window picker (start, then end).
//
// Step 1 asks when the focus window starts; step 2 asks when it ends. The end
// step pre-selects start + 60 and refuses to confirm an end that is ≤ the start,
// so a zero/negative window can never be saved. The wheel works in epoch ms on a
// reference calendar day; we map those to minutes-after-midnight on confirm.
// ──────────────────────────────────────────────────────────────────────────────

const HOUR_MIN = 60;
const DAY_MAX_MIN = 23 * 60 + 55; // last selectable minute-of-day on a 5-min wheel

interface FocusWindowEditorSheetProps {
  visible: boolean;
  /** Current start/end in minutes-after-midnight, or null when unset. */
  startMin: number | null;
  endMin: number | null;
  onConfirm: (startMin: number, endMin: number) => void;
  onCancel: () => void;
}

/** Minutes-after-midnight → epoch ms on the reference day (today). */
function minToMs(min: number, baseMs: number): number {
  const d = new Date(baseMs);
  d.setHours(Math.floor(min / 60), min % 60, 0, 0);
  return d.getTime();
}

/** Epoch ms → minutes-after-midnight. */
function msToMin(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

export function FocusWindowEditorSheet({
  visible,
  startMin,
  endMin,
  onConfirm,
  onCancel,
}: FocusWindowEditorSheetProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  // A fixed reference day so the wheel's epoch math is stable across renders.
  const baseMs = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const [step, setStep] = useState<'start' | 'end'>('start');
  const [draftStartMin, setDraftStartMin] = useState(startMin ?? 9 * 60);
  const [draftEndMin, setDraftEndMin] = useState(endMin ?? 12 * 60);

  // Reset to the start step with the latest values each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setStep('start');
    setDraftStartMin(startMin ?? 9 * 60);
    setDraftEndMin(endMin ?? 12 * 60);
  }, [visible, startMin, endMin]);

  const progress = useSharedValue(0);
  useEffect(() => {
    const target = visible ? 1 : 0;
    if (reduced) {
      progress.set(target);
      return;
    }
    progress.set(
      visible
        ? withSpring(1, { damping: 18, stiffness: 240 })
        : withTiming(0, { duration: t.motion.fast }),
    );
  }, [visible, reduced, progress, t.motion.fast]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * t.space[10] }],
  }));

  const isStart = step === 'start';
  const endFloorMin = Math.min(draftStartMin + HOUR_MIN, DAY_MAX_MIN);
  const canConfirmEnd = draftEndMin > draftStartMin;

  const handleNext = () => {
    // Step 1 → step 2: pre-select start + 60 (clamped) before showing the end wheel.
    setDraftEndMin((prev) => (prev > draftStartMin ? prev : endFloorMin));
    setStep('end');
  };

  const handleConfirm = () => {
    if (!canConfirmEnd) return;
    onConfirm(draftStartMin, draftEndMin);
  };

  const sheet: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: t.radii.sheet,
    borderTopRightRadius: t.radii.sheet,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[5],
    paddingTop: t.space[5],
    paddingBottom: insets.bottom + t.space[5],
    gap: t.space[4],
  };
  const heading: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const hint: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          style={[
            { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.colors.scrim },
            scrimStyle,
          ]}
        >
          <Pressable style={{ flex: 1 }} accessibilityLabel="Dismiss" onPress={onCancel} />
        </Animated.View>

        <Animated.View style={[sheet, sheetStyle]}>
          <AppText style={heading}>
            {isStart ? 'When does your focus window start?' : 'And when does it end?'}
          </AppText>

          {isStart ? (
            <FinishTimeWheel
              valueMs={minToMs(draftStartMin, baseMs)}
              showModes={false}
              nowMs={baseMs}
              onChange={(ms) => setDraftStartMin(msToMin(ms))}
            />
          ) : (
            <>
              <FinishTimeWheel
                valueMs={minToMs(draftEndMin, baseMs)}
                showModes={false}
                nowMs={baseMs}
                onChange={(ms) => setDraftEndMin(msToMin(ms))}
              />
              {!canConfirmEnd ? (
                <AppText style={hint}>Pick a time after it starts.</AppText>
              ) : null}
            </>
          )}

          <View style={{ gap: t.space[2] }}>
            {isStart ? (
              <AppButton label="Next" variant="indigo" fullWidth onPress={handleNext} />
            ) : (
              <AppButton
                label="Save window"
                variant="indigo"
                fullWidth
                disabled={!canConfirmEnd}
                onPress={handleConfirm}
              />
            )}
            <AppButton label="Cancel" variant="ghost" fullWidth onPress={onCancel} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
