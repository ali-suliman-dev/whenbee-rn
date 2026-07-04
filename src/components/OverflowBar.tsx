import { useEffect } from 'react';
import { View, type TextStyle } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from './AppText';

// ──────────────────────────────────────────────────────────────────────────────
// OverflowBar — shows guess vs. honest duration as a two-segment track.
// Left (primary/indigo) = what you guessed; right (accent/amber) = the reality
// gap. Eases in on mount (HoneyBar-weight timing); reduce-motion renders
// immediately. Used in onboarding to illustrate the calibration payoff.
// ──────────────────────────────────────────────────────────────────────────────

export function OverflowBar({
  guessMin,
  honestMin,
}: {
  guessMin: number;
  honestMin: number;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation('shared');
  const reduced = useReducedMotion();
  const pct = Math.max(0, Math.min(1, guessMin / honestMin));
  const fill = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      fill.value = 1;
      return;
    }
    fill.value = withTiming(1, { duration: t.motion.honeyFill });
  }, [reduced, fill, t.motion.honeyFill]);

  const guessStyle = useAnimatedStyle(() => ({
    width: `${pct * 100 * fill.value}%` as `${number}%`,
  }));
  const overStyle = useAnimatedStyle(() => ({
    width: `${(1 - pct) * 100 * fill.value}%` as `${number}%`,
  }));

  const trackH = t.space[3];

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: t.space[2],
        }}
      >
        <AppText variant="caption" style={{ color: t.colors.inkSoft }}>
          {tr('overflowBar.minutesShort', { minutes: guessMin })}
        </AppText>
        <AppText style={[(type.bigNumber as unknown as TextStyle), { color: t.colors.accent }]}>
          {tr('overflowBar.minutesShort', { minutes: honestMin })}
        </AppText>
      </View>

      <View
        style={{
          flexDirection: 'row',
          height: trackH,
          borderRadius: t.radii.full,
          backgroundColor: t.colors.accentSoft,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[guessStyle, { height: trackH, backgroundColor: t.colors.primary }]}
        />
        <Animated.View
          style={[overStyle, { height: trackH, backgroundColor: t.colors.accent }]}
        />
      </View>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: t.space[2],
        }}
      >
        <AppText variant="caption" style={{ color: t.colors.inkSoft }}>
          {tr('overflowBar.guessed')}
        </AppText>
        <Animated.Text
          entering={reduced ? undefined : FadeIn.duration(t.motion.base).delay(t.motion.honeyFill)}
          style={{
            fontSize: t.fontSize.sm,
            fontWeight: t.fontWeight.medium as TextStyle['fontWeight'],
            color: t.colors.accent,
          }}
        >
          {tr('overflowBar.realityDelta', { delta: honestMin - guessMin })}
        </Animated.Text>
      </View>

      <AppText
        variant="caption"
        style={{
          color: t.colors.inkFaint,
          textAlign: 'center',
          marginTop: t.space[2],
        }}
      >
        {tr('overflowBar.example')}
      </AppText>
    </View>
  );
}
