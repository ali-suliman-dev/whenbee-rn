// src/features/today/DaySoFarCard.tsx
// The Today "Your day so far" recap card — shown only on a sparse-done day
// (see useDaySoFar / daySoFar.ts for the visibility rule). Tells the day's
// story from real logged values only; nothing here is fabricated.
//
// The card's whole job: put today's GUESSED total beside the HONEST total so
// the optimism gap is visible where you plan. All stat numbers stay ink/white;
// a small dot on each label carries which side (indigo = guessed, amber =
// honest). The honey % stat it replaced already lived in the header ring.
//
// Design constraints:
//   - Tokens only. No inline hex or raw px.
//   - Flat surface card, no shadow, matching sibling Today cards.
//   - Opacity-fade entrance only; plain unmount (no exiting animation).
//   - The ONE founder-approved accent-text exception: the honest-total span in
//     the headline renders in `t.colors.accent`. Every other run of text stays
//     ink/inkSoft/inkFaint.

import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { gapMilestone } from '@/src/features/today/daySoFar';
import { formatDuration } from '@/src/i18n/formatDuration';
import type { DaySoFar } from '@/src/features/today/useDaySoFar';
import { Trans, useTranslation } from 'react-i18next';
import { StatColumn } from './StatColumn';

export interface DaySoFarCardProps {
  recap: DaySoFar;
}

export function DaySoFarCard({ recap }: DaySoFarCardProps) {
  const t = useTheme();
  const { t: tr } = useTranslation('today');
  const { t: translate } = useTranslation();
  const { completedCount, guessedMin, totalMin } = recap;

  const milestone = gapMilestone(guessedMin, totalMin);
  const guessed = formatDuration(guessedMin, translate);
  const honest = formatDuration(totalMin, translate);

  const card: ViewStyle = {
    // Self-managed vertical margins — the parent Animated.View stacks Today's
    // sections with no shared gap (see CalendarOverlaySection, the sibling that
    // does the same), so each section owns its own spacing. Tight above (hugs the
    // calendar strip) and a wider gap below to set the Done list apart.
    marginTop: t.space[1],
    marginBottom: t.space[4],
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.card,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
  };
  const header: ViewStyle = {
    paddingHorizontal: t.space[4],
    paddingTop: t.space[4],
    paddingBottom: t.space[3],
    gap: t.space[2],
  };
  const eyebrow: TextStyle = {
    ...(type.eyebrowSm as unknown as TextStyle),
    color: t.colors.inkFaint,
  };
  const headline: TextStyle = {
    ...(type.bodyLg as unknown as TextStyle),
    color: t.colors.ink,
  };
  // `borderWidth.hairline` is 0 by design (global card-edge knob) — use `chip`
  // (1) for a divider that actually renders, same fix the brief calls out for
  // the vertical stat-column rules.
  const divider: ViewStyle = {
    height: t.borderWidth.chip,
    backgroundColor: t.colors.hairline,
    marginHorizontal: t.space[4],
  };
  const statsRow: ViewStyle = {
    flexDirection: 'row',
    gap: t.space[3],
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[4],
  };
  const milestoneRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.space[2],
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[3],
  };
  const glyph: TextStyle = {
    color: t.colors.accent,
    fontSize: t.fontSize.sm,
    lineHeight: (type.caption as unknown as TextStyle).lineHeight,
  };
  const milestoneCopy: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
    flex: 1,
  };
  const milestoneBold: TextStyle = { fontWeight: t.fontWeight.bold as TextStyle['fontWeight'], color: t.colors.ink };

  return (
    <Animated.View entering={FadeIn.duration(t.motion.base)} style={card}>
      <View style={header}>
        <Text style={eyebrow}>{tr('daySoFar.eyebrow')}</Text>
        <Text style={headline}>
          <Trans
            i18nKey="daySoFar.headline"
            ns="today"
            count={completedCount}
            values={{ guessed, honest }}
            components={{ honest: <Text style={{ color: t.colors.accent }} /> }}
          />
        </Text>
      </View>

      <View style={divider} />

      <View style={statsRow}>
        <StatColumn
          value={String(completedCount)}
          unit={tr('daySoFar.unit', { count: completedCount })}
          label={tr('daySoFar.loggedLabel')}
        />
        <StatColumn value={guessed} label={tr('daySoFar.guessedLabel')} dotColor={t.colors.primary} divided />
        <StatColumn value={honest} label={tr('daySoFar.honestLabel')} dotColor={t.colors.accent} divided />
      </View>

      <View style={divider} />

      <View style={milestoneRow}>
        <Text style={glyph}>{'⬢'}</Text>
        <Text style={milestoneCopy}>
          <Trans
            i18nKey={`daySoFar.milestone.${milestone.direction}`}
            ns="today"
            values={{ gap: formatDuration(milestone.gapMin, translate) }}
            components={{ strong: <Text style={milestoneBold} /> }}
          />
        </Text>
      </View>
    </Animated.View>
  );
}
