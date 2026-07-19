import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { DottedRail } from './DottedRail';

// ──────────────────────────────────────────────────────────────────────────────
// TrialTimeline — the honest, no-dark-pattern trial explainer, vertical + airy
// (no card; it floats on the page). Today is the one amber dot (check + soft
// halo); the Day-5 reminder promise is explicit — and the app really schedules
// that notification on purchase (services/trialReminder.ts).
// Rendered by the caller only when the selected plan is a subscription.
// ──────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { head: 'Today', desc: 'All of Pro, free. Nothing is charged.', today: true, bold: null },
  { head: 'Day 5', desc: ' the trial is ending.', today: false, bold: 'We remind you' },
  { head: 'Day 7', desc: 'Trial ends. Cancel before and you pay nothing.', today: false, bold: null },
] as const;

export function TrialTimeline() {
  const t = useTheme();

  const row: ViewStyle = { flexDirection: 'row', gap: t.space[3] };
  const railCol: ViewStyle = { width: t.iconSize.xl, alignItems: 'center' };
  const halo: ViewStyle = {
    width: t.iconSize.xl,
    height: t.iconSize.xl,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const dotToday: ViewStyle = {
    width: t.iconSize.lg,
    height: t.iconSize.lg,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const dotNext: ViewStyle = {
    width: t.iconSize.lg,
    height: t.iconSize.lg,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.primarySoft,
    marginVertical: (t.iconSize.xl - t.iconSize.lg) / 2,
  };
  const stx: ViewStyle = { flex: 1, gap: t.space[0.5], paddingTop: t.space[0.5], paddingBottom: t.space[4] };
  const stxLast: ViewStyle = { ...stx, paddingBottom: 0 };
  const head: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.ink,
    fontFamily: 'Jakarta-Bold',
  };
  const desc: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const descBold: TextStyle = { fontFamily: 'Jakarta-Bold', color: t.colors.ink };

  return (
    <View style={{ paddingHorizontal: t.space[1] }}>
      {STEPS.map((s, i) => {
        const last = i === STEPS.length - 1;
        return (
          <View key={s.head} style={row}>
            <View style={railCol}>
              {s.today ? (
                <View style={halo}>
                  <View style={dotToday}>
                    <Ionicons name="checkmark" size={t.iconSize.xs} color={t.colors.onAmber} />
                  </View>
                </View>
              ) : (
                <View style={dotNext} />
              )}
              {last ? null : <DottedRail topOffset={t.iconSize.xl} />}
            </View>
            <View style={last ? stxLast : stx}>
              <Text style={head}>{s.head}</Text>
              <Text style={desc}>
                {s.bold ? <Text style={descBold}>{s.bold}</Text> : null}
                {s.desc}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
