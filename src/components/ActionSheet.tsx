import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, useWindowDimensions, View, type ViewStyle, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { haptics } from '@/src/lib/haptics';
import { AppText } from './AppText';
import { SheetGrabber } from './SheetGrabber';

// ──────────────────────────────────────────────────────────────────────────────
// ActionSheet — cross-platform bottom-sheet menu. Replaces ActionSheetIOS, which
// is iOS-only and crashes on Android. Matches the app's sheet language (surface +
// radii + SheetGrabber, scrim fade + ease-up, reduced-motion → instant) so it's
// identical on both platforms. Rows are bare Pressables with the visual on an
// inner View (reactCompiler drops function-form styles on Pressable).
// ──────────────────────────────────────────────────────────────────────────────

export interface ActionSheetItem {
  label: string;
  onPress: () => void;
  /** Renders the label in the danger color (e.g. Remove). */
  destructive?: boolean;
}

export interface ActionSheetProps {
  visible: boolean;
  title?: string;
  items: ActionSheetItem[];
  onCancel: () => void;
  cancelLabel?: string;
}

export function ActionSheet({
  visible,
  title,
  items,
  onCancel,
  cancelLabel = 'Cancel',
}: ActionSheetProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { height: screenH } = useWindowDimensions();
  const [pressed, setPressed] = useState<number | null>(null);

  const progress = useSharedValue(0); // 0 hidden → 1 shown
  useEffect(() => {
    if (reduced) {
      progress.set(visible ? 1 : 0);
      return;
    }
    progress.set(
      visible
        ? withTiming(1, { duration: t.motion.base, easing: Easing.out(Easing.cubic) })
        : withTiming(0, { duration: t.motion.fast }),
    );
  }, [visible, reduced, progress, t.motion.base, t.motion.fast]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * 40 }],
  }));

  function select(item: ActionSheetItem) {
    haptics.selection();
    onCancel(); // dismiss first; the action may open the next sheet
    item.onPress();
  }

  const sheet: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: t.radii.sheet,
    borderTopRightRadius: t.radii.sheet,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[3],
    paddingTop: t.space[3],
    paddingBottom: Math.max(insets.bottom, t.space[4]),
    gap: t.space[2],
  };

  const titleStyle: TextStyle = {
    fontSize: t.fontSize.sm,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: t.colors.inkSoft,
    textAlign: 'center',
    paddingVertical: t.space[2],
  };

  const rowInner = (isPressed: boolean): ViewStyle => ({
    paddingVertical: t.space[4],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    backgroundColor: isPressed ? t.colors.surfaceSunken : 'transparent',
  });

  const rowLabel = (destructive?: boolean): TextStyle => ({
    fontSize: t.fontSize.md,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: destructive ? t.colors.danger : t.colors.ink, // audit-ok: destructive
    textAlign: 'center',
  });

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

        <Animated.View style={[sheet, sheetStyle]} accessibilityViewIsModal>
          <SheetGrabber />

          {title ? <AppText variant="caption" style={titleStyle}>{title}</AppText> : null}

          <ScrollView
            style={{ maxHeight: screenH * 0.5 }}
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {items.map((item, i) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPressIn={() => setPressed(i)}
                onPressOut={() => setPressed(null)}
                onPress={() => select(item)}
              >
                <View style={rowInner(pressed === i)}>
                  <AppText variant="body" style={rowLabel(item.destructive)}>{item.label}</AppText>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
            onPressIn={() => setPressed(-1)}
            onPressOut={() => setPressed(null)}
            onPress={onCancel}
          >
            <View style={rowInner(pressed === -1)}>
              <AppText variant="body" style={{ ...rowLabel(), fontWeight: t.fontWeight.bold as TextStyle['fontWeight'] }}>
                {cancelLabel}
              </AppText>
            </View>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}
