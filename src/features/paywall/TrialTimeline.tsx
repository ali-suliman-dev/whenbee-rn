import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Trans, useTranslation } from 'react-i18next';
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

// Step ids only — the head/desc copy lives in `paywall.trialTimeline.*`, and the
// emphasised span inside the Day-5 line is a <strong> component inside the
// translated sentence (never a pre-split prefix, which no other language keeps
// in the same position).
const STEPS = [
  { id: 'today', today: true },
  { id: 'day5', today: false },
  { id: 'day7', today: false },
] as const;

export function TrialTimeline() {
  const t = useTheme();
  const { t: tr } = useTranslation('paywall');

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
  // paddingBottom is the only thing separating one step from the next (DottedRail
  // is flex:1 and just fills whatever height the row ends up). Keep it well above
  // the 2pt head→desc gap so the steps still read as three groups, not six lines.
  const stx: ViewStyle = { flex: 1, gap: t.space[0.5], paddingTop: t.space[0.5], paddingBottom: t.space[2] };
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
          <View key={s.id} style={row}>
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
              {last ? null : <DottedRail />}
            </View>
            <View style={last ? stxLast : stx}>
              <Text style={head}>{tr(`trialTimeline.${s.id}.head`)}</Text>
              <Text style={desc}>
                <Trans
                  i18nKey={`trialTimeline.${s.id}.desc`}
                  ns="paywall"
                  components={{ strong: <Text style={descBold} /> }}
                />
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
