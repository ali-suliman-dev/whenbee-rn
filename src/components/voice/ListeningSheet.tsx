// Bottom sheet shown while listening: live partial transcript, a looping mic
// pulse, and a Stop button. Entering-only animations (no exiting on a
// conditionally-unmounted view → Fabric SIGABRT). Transform/opacity only.
// Bottom inset added so the Stop button clears the home indicator.

import { useEffect } from 'react';
import { Modal, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';

interface ListeningSheetProps {
  visible: boolean;
  partial: string;
  onStop: () => void;
}

export const ListeningSheet = ({ visible, partial, onStop }: ListeningSheetProps) => {
  const t = useTheme();
  const { t: tr } = useTranslation('voice');
  const insets = useSafeAreaInsets();
  // 0 = ring at rest; 1 = ring fully expanded + faded
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    // Reset then start the looping pulse. beeLook (1400ms) gives a calm breath
    // rate — slow enough to stay serene, fast enough to feel alive.
    pulse.set(0);
    pulse.set(
      withRepeat(
        withTiming(1, { duration: t.motion.beeLook, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      ),
    );
  }, [visible, pulse, t.motion.beeLook]);

  // GPU-only: opacity + scale. The ring starts at full opacity (0.4) and scale 1,
  // grows to 1.6× and fades to transparent, then instantly snaps back and repeats.
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.4 * (1 - pulse.get()),
    transform: [{ scale: 1 + pulse.get() * 0.6 }],
  }));

  // Conditional mount + entering-only is the Fabric-safe pattern. The Modal
  // transparent overlay handles the overlay; this guard prevents an orphaned
  // render while visible is still false on the first pass.
  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onStop}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: t.colors.scrim }}>
        <Animated.View
          entering={FadeIn.duration(t.motion.base)}
          style={{
            backgroundColor: t.colors.surface,
            borderTopLeftRadius: t.radii.sheet,
            borderTopRightRadius: t.radii.sheet,
            // Use chip (=1) not hairline (=0) so the top edge is actually visible.
            borderTopWidth: t.borderWidth.chip,
            borderColor: t.colors.hairline,
            paddingHorizontal: t.space[5],
            paddingTop: t.space[6],
            paddingBottom: t.space[5] + insets.bottom,
            gap: t.space[5],
            alignItems: 'center',
          }}
        >
          {/* Mic icon with looping pulse ring behind it */}
          <View
            style={{
              width: t.size.control.lg,
              height: t.size.control.lg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Pulse ring: scales up + fades out, repeating on a beeLook (1400ms) cadence */}
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  width: t.size.control.lg,
                  height: t.size.control.lg,
                  borderRadius: t.radii.full,
                  backgroundColor: t.colors.primarySoft,
                },
                ringStyle,
              ]}
            />
            <SymbolView name="mic.fill" size={t.iconSize.lg} tintColor={t.colors.primary} />
          </View>

          {/* Live partial transcript — falls back to "Listening…" while speech starts */}
          <Text
            style={{
              fontSize: t.fontSize.md,
              color: t.colors.inkSoft,
              textAlign: 'center',
              minHeight: t.space[10],
            }}
          >
            {partial.length > 0 ? partial : tr('listeningSheet.listening')}
          </Text>

          <AppButton label={tr('listeningSheet.stop')} variant="ghost" size="md" fullWidth onPress={onStop} />
        </Animated.View>
      </View>
    </Modal>
  );
};
