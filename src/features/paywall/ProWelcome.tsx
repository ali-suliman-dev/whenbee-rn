import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/src/components/AppButton';
import { Screen } from '@/src/components/Screen';
import { BeeBurst } from '@/src/components/bee/BeeBurst';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { analytics } from '@/src/services/analytics';
import {
  getNotificationPermissionState,
  requestNotificationPermission,
  scheduleTrialReminder,
  trialChargeDate,
  trialReminderDate,
} from '@/src/services/trialReminder';

// ──────────────────────────────────────────────────────────────────────────────
// ProWelcome — the post-purchase moment. Celebrate briefly, confirm exactly what
// happens next (dates included), keep the paywall's Day-5 reminder promise
// honestly (schedule when granted; otherwise the ask lives right here), then one
// action into the payoff. Content fades in as staggered opacity only — the bee
// crest carries the celebratory motion (its own approved entrance); the CTA is
// never animated.
// Spec: docs/product/specs/2026-07-19-paywall-redesign.md §4
// ──────────────────────────────────────────────────────────────────────────────

type ReminderState = 'checking' | 'scheduled' | 'ask' | 'denied' | 'unavailable';

function formatDay(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

/** Staggered opacity-only entrance (reduced motion → final state). */
function useFadeIn(order: number) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (reducedMotion) {
      opacity.set(1);
      return;
    }
    opacity.set(
      withDelay(
        order * t.motion.enterStagger,
        withTiming(1, { duration: t.motion.base, easing: t.motion.easing.out }),
      ),
    );
  }, [reducedMotion, opacity, order, t.motion.enterStagger, t.motion.base, t.motion.easing.out]);
  return useAnimatedStyle(() => ({ opacity: opacity.get() }));
}

function Row({
  icon,
  strong,
  rest,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  strong: string;
  rest: string;
  onPress?: () => void;
}) {
  const t = useTheme();
  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    paddingVertical: t.space[3],
  };
  const tile: ViewStyle = {
    width: t.size.momentCoin,
    height: t.size.momentCoin,
    borderRadius: t.radii.sm,
    backgroundColor: t.colors.primaryWash,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const text: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft, flex: 1 };
  const strongText: TextStyle = { fontFamily: 'Jakarta-Bold', color: t.colors.ink };

  const content = (
    <View style={row}>
      <View style={tile}>
        <Ionicons name={icon} size={t.iconSize.sm} color={t.colors.primary} />
      </View>
      <Text style={text}>
        <Text style={strongText}>{strong}</Text> {rest}
      </Text>
      {onPress ? (
        <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkFaint} />
      ) : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={strong}>
      {content}
    </Pressable>
  );
}

export function ProWelcome({ plan, purchasedAt }: { plan: string; purchasedAt: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const parsed = new Date(purchasedAt);
  const purchased = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const isSub = plan === 'yearly' || plan === 'monthly';
  const reminderDay = formatDay(trialReminderDate(purchased));
  const chargeDay = formatDay(trialChargeDate(purchased));

  const [reminder, setReminder] = useState<ReminderState>('checking');

  useEffect(() => {
    analytics.capture('pro_welcome_view', { plan });
    // Mount-only funnel event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the Day-5 promise: schedule when granted; otherwise surface the ask.
  useEffect(() => {
    if (!isSub) return;
    let cancelled = false;
    void (async () => {
      const state = await getNotificationPermissionState();
      if (cancelled) return;
      if (state === 'granted') {
        const result = await scheduleTrialReminder(purchased);
        if (cancelled) return;
        if (result === 'scheduled') {
          analytics.capture('trial_reminder_scheduled', {});
          setReminder('scheduled');
        } else {
          analytics.capture('trial_reminder_skipped', { reason: result });
          setReminder('unavailable');
        }
      } else if (state === 'undetermined') {
        setReminder('ask');
      } else {
        analytics.capture('trial_reminder_skipped', { reason: state });
        setReminder(state === 'denied' ? 'denied' : 'unavailable');
      }
    })();
    return () => {
      cancelled = true;
    };
    // purchased is derived from the route param; re-running on identity changes
    // would double-schedule.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSub]);

  const onAskReminder = useCallback(async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      const result = await scheduleTrialReminder(purchased);
      if (result === 'scheduled') {
        analytics.capture('trial_reminder_scheduled', {});
        setReminder('scheduled');
        return;
      }
      analytics.capture('trial_reminder_skipped', { reason: result });
      setReminder('unavailable');
      return;
    }
    analytics.capture('trial_reminder_skipped', { reason: 'declined-ask' });
    setReminder('denied');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSeeMyDay() {
    analytics.capture('pro_welcome_cta', {});
    router.replace('/(tabs)');
  }

  const headerAnim = useFadeIn(0);
  const cardAnim = useFadeIn(1);

  const title: TextStyle = {
    ...(type.title as unknown as TextStyle),
    color: t.colors.ink,
    textAlign: 'center',
  };
  const sub: TextStyle = {
    ...(type.body as unknown as TextStyle),
    color: t.colors.inkSoft,
    textAlign: 'center',
  };
  const card: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[1],
  };
  const divider: ViewStyle = { height: t.borderWidth.chip, backgroundColor: t.colors.surfaceSunken };

  const reminderRow = (() => {
    if (!isSub) return null;
    switch (reminder) {
      case 'scheduled':
        return (
          <Row icon="notifications-outline" strong={`Reminder set for ${reminderDay}.`} rest="We'll nudge you before the trial ends." />
        );
      case 'ask':
        return (
          <Row
            icon="notifications-outline"
            strong="Get the Day-5 reminder."
            rest="One nudge before the trial ends, nothing else."
            onPress={() => void onAskReminder()}
          />
        );
      case 'denied':
      case 'unavailable':
        return (
          <Row icon="notifications-outline" strong="Reminder needs notifications." rest="You can still cancel anytime in Settings." />
        );
      default:
        return (
          <Row icon="notifications-outline" strong="Setting up your reminder…" rest={`Trial ends ${chargeDay}.`} />
        );
    }
  })();

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{
          gap: t.space[5],
          paddingTop: t.space[6],
          paddingBottom: t.space[6] + insets.bottom,
          flexGrow: 1,
          justifyContent: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center' }}>
          <BeeBurst variant="upgrade" />
        </View>

        <Animated.View style={[{ gap: t.space[2] }, headerAnim]}>
          <Text style={title}>{"You're Pro."}</Text>
          <Text style={sub}>Every honest number you earned now works everywhere you plan.</Text>
        </Animated.View>

        <Animated.View style={cardAnim}>
          <View style={card}>
            {isSub ? (
              <Row icon="checkmark" strong="7-day free trial started." rest={`Nothing is charged before ${chargeDay}.`} />
            ) : (
              <Row icon="checkmark" strong="Pro is yours, forever." rest="One payment, no renewals." />
            )}
            {reminderRow ? (
              <>
                <View style={divider} />
                {reminderRow}
              </>
            ) : null}
            <View style={divider} />
            <Row
              icon="calendar-outline"
              strong="Your day is honest now."
              rest="Calendar, routines, insights, review, lock-screen timer."
            />
          </View>
        </Animated.View>

        <AppButton label="See my honest day" variant="amber" fullWidth onPress={onSeeMyDay} />
      </ScrollView>
    </Screen>
  );
}
