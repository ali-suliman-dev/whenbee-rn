import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Card } from '@/src/components/Card';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { formatClock, formatClockMeridiem } from '@/src/lib/time';
import type { HonestBlock, HonestDayResult } from './buildHonestDay';

// ──────────────────────────────────────────────────────────────────────────────
// HonestDayPreview — the before/after for the Pro Honest-Day calendar.
//
// Shows the planned day-end vs the honest day-end ("planned ends 5:00pm" →
// "honest ends 7:10pm"), each block's planned vs honest time, a kind amber
// "this won't fit — cut one" note when the day overflows (never red, never
// shame), and ONE "Apply to my calendar" confirm button — the only thing that
// writes. Cancel/back leaves the calendar untouched. The write + its analytics
// event live in useHonestDay; this component only renders and calls `onApply`.
// ──────────────────────────────────────────────────────────────────────────────

interface HonestDayPreviewProps {
  result: HonestDayResult;
  /** Called when the user confirms. The ONLY path that writes the calendar. */
  onApply: () => void;
  /** Called when the user backs out. Leaves the calendar untouched. */
  onCancel: () => void;
  /** True while the confirmed write is in flight (disables the button). */
  applying?: boolean;
}

/** "5:00pm" for an absolute end time, from minutes-from-midnight. */
function endClock(block: HonestBlock): string {
  return formatClockMeridiem(block.endMs);
}

export function HonestDayPreview({ result, onApply, onCancel, applying }: HonestDayPreviewProps) {
  const t = useTheme();
  const { t: tr } = useTranslation('calendar');
  const { before, after, overflowsDay } = result;

  const lastBefore = before[before.length - 1];
  const lastAfter = after[after.length - 1];

  const sectionLabel: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const summaryRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[3] };
  const plannedEnd: TextStyle = {
    ...(type.bodyLg as unknown as TextStyle),
    color: t.colors.inkSoft,
    textDecorationLine: 'line-through',
  };
  const honestEnd: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };

  return (
    <View style={{ gap: t.space[5] }}>
      <Card tone="focal" style={{ gap: t.space[3] }}>
        <Text style={sectionLabel}>{tr('preview.sectionLabel')}</Text>
        {lastBefore && lastAfter ? (
          <View style={summaryRow}>
            <Text style={plannedEnd}>
              {tr('preview.endsPlanned', { time: formatClockMeridiem(lastBefore.endMs) })}
            </Text>
            <Ionicons name="arrow-forward" size={t.iconSize.sm} color={t.colors.inkSoft} />
            <Text style={honestEnd}>
              {tr('preview.endsHonest', { time: formatClockMeridiem(lastAfter.endMs) })}
            </Text>
          </View>
        ) : (
          <Text style={{ ...(type.body as unknown as TextStyle), color: t.colors.inkSoft }}>
            {tr('preview.empty')}
          </Text>
        )}

        {overflowsDay ? <CapacityNote /> : null}
      </Card>

      {after.length > 0 ? (
        <View style={{ gap: t.space[2] }}>
          <Text style={sectionLabel}>{tr('preview.blockByBlock')}</Text>
          {after.map((block, index) => (
            <BlockRow key={block.id} planned={before[index]} honest={block} />
          ))}
        </View>
      ) : null}

      <View style={{ gap: t.space[3] }}>
        <AppButton
          label={applying ? tr('preview.applying') : tr('preview.apply')}
          variant="amber"
          fullWidth
          disabled={applying || after.length === 0}
          onPress={onApply}
        />
        <AppButton label={tr('preview.notNow')} variant="ghost" fullWidth disabled={applying} onPress={onCancel} />
      </View>
    </View>
  );
}

// One block's planned → honest time. Amber only when the honest block grows.
function BlockRow({ planned, honest }: { planned: HonestBlock | undefined; honest: HonestBlock }) {
  const t = useTheme();
  const { t: tr } = useTranslation('calendar');
  const grew = planned !== undefined && honest.durationMin > planned.durationMin;

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    minHeight: t.size.control.sm,
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.card,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[3],
  };
  const title: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink, flex: 1 };
  const duration: TextStyle = {
    fontFamily: 'Inter-Bold',
    fontSize: t.fontSize.md,
    color: grew ? t.colors.accent : t.colors.inkSoft,
    fontVariant: ['tabular-nums'],
  };
  const clock: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };

  return (
    <View style={row}>
      <View style={{ flex: 1, gap: t.space[0.5] }}>
        <Text style={title} numberOfLines={1}>
          {honest.title}
        </Text>
        <Text style={clock}>
          {formatClock(honest.startMs)}–{endClock(honest)}
        </Text>
      </View>
      <Text style={duration}>{tr('preview.duration', { count: honest.durationMin })}</Text>
    </View>
  );
}

// Kind amber capacity note — surfaced when the honest day runs long. Names the
// real choice (trim one) without shame; never red, never "you overcommitted".
function CapacityNote() {
  const t = useTheme();
  const { t: tr } = useTranslation('calendar');
  const pill: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
    alignSelf: 'flex-start',
    backgroundColor: t.colors.accentSoft,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[2],
  };
  const copy: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.amberText, flexShrink: 1 };

  return (
    <View
      style={pill}
      accessibilityRole="text"
      accessibilityLabel={tr('capacityNote.accessibilityLabel')}
    >
      <Ionicons name="time-outline" size={15} color={t.colors.amberText} />
      <Text style={copy}>{tr('capacityNote.text')}</Text>
    </View>
  );
}
