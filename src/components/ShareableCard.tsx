import { forwardRef } from 'react';
import { View, Text, type TextStyle, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { formatClock } from '@/src/lib/time';
import { HonestNumber } from '@/src/components/HonestNumber';

// ──────────────────────────────────────────────────────────────────────────────
// ShareableCard — a flat, self-contained card rendered OFF-SCREEN purely so it can
// be captured to a PNG (react-native-view-shot → the OS share sheet). It is the
// only "card" in the app that carries a real 1px edge: a shared image lands on any
// background, so it needs a defined boundary the borderless in-app cards don't.
//
// Two variants:
//   plan       a finished Start-By plan — the honest start time + the timeline.
//   archetype  the user's calibration signature — title, blurb, average multiplier.
//
// Component-boundary safe: NO service/store imports. It is a pure presentational
// render of the `data` it's handed. Tokens only, no inline literals.
// ──────────────────────────────────────────────────────────────────────────────

export interface PlanShareData {
  kind: 'plan';
  focalClock: number;
  eyebrow: string;
  deadlineClock: number;
  timeline: { id: string; label: string; startAt: number; endAt: number }[];
}

export interface ArchetypeShareData {
  kind: 'archetype';
  title: string;
  blurb: string;
  averageMultiplier: number;
}

export type ShareCardData = PlanShareData | ArchetypeShareData;

export const ShareableCard = forwardRef<View, { data: ShareCardData }>(function ShareableCard(
  { data },
  ref,
) {
  const t = useTheme();
  const { t: tr } = useTranslation('shared');

  const card: ViewStyle = {
    width: t.size.shareCard,
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    borderWidth: t.borderWidth.share,
    borderColor: t.colors.hairline,
    padding: t.space[6],
    gap: t.space[5],
  };

  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.primary };
  const footer: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint };
  const footerRule: ViewStyle = {
    borderTopWidth: t.borderWidth.share,
    borderTopColor: t.colors.hairline,
    paddingTop: t.space[3],
  };

  return (
    <View ref={ref} collapsable={false} style={card}>
      {data.kind === 'plan' ? <PlanBody t={t} tr={tr} eyebrow={eyebrow} data={data} /> : null}
      {data.kind === 'archetype' ? <ArchetypeBody t={t} tr={tr} eyebrow={eyebrow} data={data} /> : null}

      <View style={footerRule}>
        <Text style={footer}>{tr('shareableCard.footer')}</Text>
      </View>
    </View>
  );
});

type Theme = ReturnType<typeof useTheme>;

function PlanBody({
  t,
  tr,
  eyebrow,
  data,
}: {
  t: Theme;
  tr: TFunction<'shared'>;
  eyebrow: TextStyle;
  data: PlanShareData;
}) {
  const focalGroup: ViewStyle = { gap: t.space[1] };
  const deadline: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const timeCol: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    fontVariant: ['tabular-nums'],
    minWidth: t.size.timelineCol,
    color: t.colors.primary,
  };
  const itemLabel: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink, flex: 1 };
  const row: ViewStyle = { flexDirection: 'row', alignItems: 'baseline', gap: t.space[3] };

  return (
    <>
      <View style={focalGroup}>
        <Text style={eyebrow}>{data.eyebrow}</Text>
        <HonestNumber size="xl" tone="indigo" value={formatClock(data.focalClock)} />
        <Text style={deadline}>
          {tr('shareableCard.finishBy', { time: formatClock(data.deadlineClock) })}
        </Text>
      </View>

      {data.timeline.length > 0 ? (
        <View style={{ gap: t.space[2] }}>
          {data.timeline.map((item) => (
            <View key={item.id} style={row}>
              <Text style={timeCol}>
                {formatClock(item.startAt)}–{formatClock(item.endAt)}
              </Text>
              <Text style={itemLabel} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

function ArchetypeBody({
  t,
  tr,
  eyebrow,
  data,
}: {
  t: Theme;
  tr: TFunction<'shared'>;
  eyebrow: TextStyle;
  data: ArchetypeShareData;
}) {
  const head: ViewStyle = { gap: t.space[1] };
  const title: TextStyle = { ...(type.title as unknown as TextStyle), color: t.colors.ink };
  const blurb: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  const avg: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink };

  return (
    <>
      <View style={head}>
        <Text style={eyebrow}>{tr('shareableCard.archetypeEyebrow')}</Text>
        <Text style={title}>{data.title}</Text>
      </View>
      <Text style={blurb}>{data.blurb}</Text>
      <Text style={avg}>
        {tr('shareableCard.averageMultiplier', { multiplier: data.averageMultiplier.toFixed(1) })}
      </Text>
    </>
  );
}
