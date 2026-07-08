import { useCallback, useState } from 'react';
import { ScrollView, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { kv } from '@/src/lib/kv';
import { formatClockMeridiem } from '@/src/lib/time';
import { useDayPlan } from '@/src/features/today/useDayPlan';
import { DayTimeline } from '@/src/features/today/DayTimeline';
import { PlanReminderChip } from '@/src/features/today/PlanReminderChip';
import { PlanSetupStep } from '@/src/features/today/PlanSetupStep';

// ──────────────────────────────────────────────────────────────────────────────
// Plan route (Option 3 — a full screen you visit). First run shows a one-time
// consent setup step (calendar read + start-by nudge, both off); after that it
// opens straight into the day plan. Modal HARD RULE: headerShown:false + own
// title (type.subtitle + ink); the '(tabs)' anchor is on the root stack.
// ──────────────────────────────────────────────────────────────────────────────

export default function PlanScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { plan } = useDayPlan();

  // Show the plan directly once the one-time setup has been seen.
  const [showPlan, setShowPlan] = useState(() => kv.getString('plan.setupSeen') != null);

  const handleContinue = useCallback(() => {
    kv.set('plan.setupSeen', '1');
    setShowPlan(true);
  }, []);

  const titleStyle: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const startByClock = plan?.startBy ? formatClockMeridiem(plan.startBy) : null;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          gap: t.space[5],
          paddingTop: t.space[4],
          paddingBottom: insets.bottom + t.space[8],
        }}
        showsVerticalScrollIndicator={false}
      >
        {showPlan ? (
          <>
            <AppText accessibilityRole="header" style={titleStyle}>
              Your day, planned
            </AppText>
            <DayTimeline />
            <PlanReminderChip startByClock={startByClock} />
            <AppButton
              label="Looks good"
              onPress={() => router.back()}
              fullWidth
              accessibilityLabel="Done, back to today"
            />
          </>
        ) : (
          <PlanSetupStep onContinue={handleContinue} />
        )}
      </ScrollView>
    </Screen>
  );
}
