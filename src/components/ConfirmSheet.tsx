import { useEffect } from 'react';
import { Modal, Pressable, View, type ViewStyle, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from './AppText';
import { AppButton } from './AppButton';
import { DataResetGlyph } from './DataResetGlyph';

// ──────────────────────────────────────────────────────────────────────────────
// ConfirmSheet — styled, reduced-motion-aware bottom-sheet confirmation for
// destructive actions (the Settings Danger Zone). NOT a native alert: it matches
// the app's surface + hairline + radii so a wipe feels considered, not alarming.
// Scrim fades in; the sheet eases up from the bottom. Reduced motion → instant.
// ──────────────────────────────────────────────────────────────────────────────

export interface ConfirmSheetProps {
  visible: boolean;
  tone: 'caution' | 'danger';
  glyphKind: 'progress' | 'erase';
  title: string;
  bullets: string[];
  confirmLabel: string;
  /** Cancel button label. Defaults to 'Cancel'. */
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmSheet({
  visible,
  tone,
  glyphKind,
  title,
  bullets,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const progress = useSharedValue(0); // 0 hidden → 1 shown
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
    transform: [{ translateY: (1 - progress.get()) * 40 }],
  }));

  const accent = tone === 'danger' ? t.colors.danger : t.colors.accent;

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
  const headerRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[3] };
  const titleStyle: TextStyle = { color: t.colors.ink };
  const bulletRow: ViewStyle = { flexDirection: 'row', gap: t.space[2], alignItems: 'flex-start' };
  const dot: ViewStyle = {
    width: t.space[1.5],
    height: t.space[1.5],
    borderRadius: t.radii.full,
    backgroundColor: accent,
    marginTop: t.space[2],
  };

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
          <View style={headerRow}>
            <DataResetGlyph kind={glyphKind} active={visible} size={t.iconSize.xl} />
            <AppText variant="title" style={titleStyle}>{title}</AppText>
          </View>

          <View style={{ gap: t.space[2] }}>
            {bullets.map((b) => (
              <View key={b} style={bulletRow}>
                <View style={dot} />
                <AppText variant="body" style={{ flex: 1, color: t.colors.inkSoft }}>{b}</AppText>
              </View>
            ))}
          </View>

          <View style={{ gap: t.space[2] }}>
            <AppButton
              label={confirmLabel}
              onPress={onConfirm}
              variant={tone === 'danger' ? 'danger' : 'amber'}
              fullWidth
            />
            <AppButton label={cancelLabel} onPress={onCancel} variant="ghost" fullWidth />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
