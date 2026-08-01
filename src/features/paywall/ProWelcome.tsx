import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { localeForLang } from '@/src/i18n/format';
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

/** The trial dates follow the APP language, not the device's. A Swedish user on
 *  an English phone reads "5 augusti", not "August 5". */
function formatDay(d: Date, lang: string): string {
  return d.toLocaleDateString(localeForLang(lang), { month: 'long', day: 'numeric' });
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
  const { t: tr, i18n } = useTranslation('paywall');
  const insets = useSafeAreaInsets();

  const parsed = new Date(purchasedAt);
  const purchased = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const isSub = plan === 'yearly' || plan === 'monthly';
  const reminderDay = formatDay(trialReminderDate(purchased), i18n.language);
  const chargeDay = formatDay(trialChargeDate(purchased), i18n.language);

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
          <Row icon="notifications-outline" strong={tr('proWelcome.reminderSet', { day: reminderDay })} rest={tr('proWelcome.reminderRest')} />
        );
      case 'ask':
        return (
          <Row
            icon="notifications-outline"
            strong={tr('proWelcome.askStrong')}
            rest={tr('proWelcome.askRest')}
            onPress={() => void onAskReminder()}
          />
        );
      case 'denied':
      case 'unavailable':
        return (
          <Row icon="notifications-outline" strong={tr('proWelcome.deniedStrong')} rest={tr('proWelcome.deniedRest')} />
        );
      default:
        return (
          <Row icon="notifications-outline" strong={tr('proWelcome.reminderPending')} rest={tr('proWelcome.trialEnds', { day: chargeDay })} />
        );
    }
  })();

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{
          gap: t.space[5],
          // `justifyContent: 'center'` centres inside the PADDING box, so the two
          // paddings must match or the column is pushed off-centre by their
          // difference. The bottom inset still has to be reserved (it keeps the
          // CTA off the home indicator once the column overflows), so it is
          // mirrored on top rather than dropped. Previously it was bottom-only,
          // which lifted everything by the full inset — 34pt on iOS (obvious),
          // ~0 on Android gesture nav, hence the iOS-only report.
          paddingTop: t.space[6] + insets.bottom,
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
          <Text style={title}>{tr('proWelcome.title')}</Text>
          <Text style={sub}>{tr('proWelcome.sub')}</Text>
        </Animated.View>

        <Animated.View style={cardAnim}>
          <View style={card}>
            {isSub ? (
              <Row icon="checkmark" strong={tr('proWelcome.trialStarted')} rest={tr('proWelcome.nothingCharged', { day: chargeDay })} />
            ) : (
              <Row icon="checkmark" strong={tr('proWelcome.lifetimeStrong')} rest={tr('proWelcome.lifetimeRest')} />
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
              strong={tr('proWelcome.dayStrong')}
              rest={tr('proWelcome.dayRest')}
            />
          </View>
        </Animated.View>

        <AppButton label={tr('proWelcome.cta')} variant="amber" fullWidth onPress={onSeeMyDay} />
      </ScrollView>
    </Screen>
  );
}
