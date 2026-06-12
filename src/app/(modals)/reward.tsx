import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { HonestNumber } from '@/src/components/HonestNumber';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useReward } from '@/src/features/reward/useReward';
import { RewardBee } from '@/src/features/reward/RewardBee';
import { HoneyBar } from '@/src/features/reward/HoneyBar';
import { ReclaimDeposit } from '@/src/features/reward/ReclaimDeposit';
import { ReasonChips } from '@/src/features/reward/ReasonChips';

// ──────────────────────────────────────────────────────────────────────────────
// Reward (Screen 4) — the dopamine payoff: logging IS the reward. Calm, flat
// reveal (full confetti/bloom choreography is a LATER phase). Reads the
// ephemeral rewardStore hand-off via useReward; clears it on leave.
//
// THE ONE primary action: See my Whenbee (ghost secondary: Back to today).
// Deep-linked with no log → a graceful "nothing to celebrate yet" fallback.
// ──────────────────────────────────────────────────────────────────────────────

export default function Reward() {
  const t = useTheme();
  const r = useReward();

  const center: ViewStyle = {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: t.space[5],
  };
  const headlineText: TextStyle = {
    ...(type.title as unknown as TextStyle),
    color: t.colors.ink,
    textAlign: 'center',
  };
  const subText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
    textAlign: 'center',
  };
  const capEyebrow: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.accent,
    textAlign: 'center',
  };
  const ritualText: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
    textAlign: 'center',
  };

  if (!r.hasReward) {
    return (
      <Screen>
        <View style={center}>
          <AppText style={headlineText}>Nothing to celebrate yet</AppText>
          <Text style={subText}>Log something and the honey will ripen here.</Text>
        </View>
        <View style={{ paddingBottom: t.space[4] }}>
          <AppButton label="Back to today" variant="ghost" fullWidth onPress={r.onBackToToday} />
        </View>
      </Screen>
    );
  }

  // ── Honey row pieces ──
  const honeyHeaderRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };
  const honeyLabel: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.inkSoft,
  };
  const honeyPctText: TextStyle = {
    ...(type.multiplier as unknown as TextStyle),
    color: t.colors.amberText,
  };
  const numberRow: ViewStyle = { alignItems: 'center', gap: t.space[1] };

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'space-between', paddingTop: t.space[4] }}>
        {/* Hero + numbers */}
        <View style={{ alignItems: 'center', gap: t.space[5], paddingTop: t.space[2] }}>
          {r.capEyebrow ? <Text style={capEyebrow}>{r.capEyebrow}</Text> : null}

          <RewardBee sealed={r.sealed} />

          <Text style={headlineText}>{r.headline}</Text>

          <View style={numberRow}>
            <HonestNumber size="xl" tone="ink" value={String(r.actualMin)} unit="min" />
            <Text style={subText}>you guessed {r.guessMin} — now we both know</Text>
          </View>
        </View>

        {/* Honey row */}
        <View style={{ gap: t.space[2] }}>
          <View style={honeyHeaderRow}>
            <Text style={honeyLabel}>HONEY</Text>
            <Text style={honeyPctText}>{r.honeyPct}%</Text>
          </View>
          <HoneyBar pct={r.honeyPct} />
          <Text style={subText}>
            {r.categoryLabel} now reads {r.multiplier.toFixed(1)}× · multiplier updated quietly.
          </Text>

          {/* Tangible payoff: the minutes this log just banked. Only when >= 1m —
              never a "+0m". Staggered to land after the honey fill. */}
          {r.reclaimDeltaMin >= 1 ? (
            <ReclaimDeposit
              reclaimDeltaMin={r.reclaimDeltaMin}
              reclaimFrom={r.reclaimFrom}
              reclaimTo={r.reclaimTo}
              delayMs={t.motion.reveal}
            />
          ) : null}

          {/* Capture-only: an optional "where'd the time go?" row, only when the run
              diverged enough to be worth a why. Never blocks the two exits, never
              touches the multiplier/honey/Reclaim — pure side-channel data. */}
          {r.reasonDirection && r.eventId ? (
            <ReasonChips
              eventId={r.eventId}
              direction={r.reasonDirection}
              category={r.category}
            />
          ) : null}
        </View>

        {/* Ritual + CTAs */}
        <View style={{ gap: t.space[4], paddingBottom: t.space[4] }}>
          <Text style={ritualText}>{r.ritualLine}</Text>
          <AppButton label="See my Reclaim" variant="indigo" fullWidth onPress={r.onSeeWhenbee} />
          <AppButton label="Back to today" variant="ghost" fullWidth onPress={r.onBackToToday} />
        </View>
      </View>
    </Screen>
  );
}
