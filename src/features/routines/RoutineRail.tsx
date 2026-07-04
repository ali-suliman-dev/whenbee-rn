import { View, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';
import { PlanRail } from '@/src/features/planner/PlanRail';
import { categoryName } from '@/src/features/shared/categoryName';
import { formatClock } from '@/src/lib/time';
import { haptics } from '@/src/lib/haptics';
import type { RoutineRailModel, RailRow } from './routineRailModel';

// ──────────────────────────────────────────────────────────────────────────────
// RoutineRail — renders a RoutineRailModel as a PlanRail gutter + content rows.
//
// Rows:
//   start   — time cap showing start-by clock or plain "start" label
//   step    — tappable (edit) and swipeable-left (delete) task card
//   breather — quiet in-between gap row
//   finish  — time cap showing done-by clock or a CTA to set a finish time
//   tail    — "＋ add step" add row below the finish cap
//
// Swipe-to-delete mirrors TaskRow: friction=2, rightThreshold=40, haptic on open.
// ──────────────────────────────────────────────────────────────────────────────

// Minute-of-day → "8:40" using the shared clock formatter.
// Build the reference from today's LOCAL midnight so getHours() aligns with the
// device's timezone. Using epoch 0 would be shifted by the UTC offset.
function clockLabel(min: number | null): string | undefined {
  if (min === null) return undefined;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return formatClock(d.getTime() + min * 60_000);
}

export interface RoutineRailProps {
  model: RoutineRailModel;
  onEditStep: (id: string) => void;
  onDeleteStep: (id: string) => void;
  onAddStep: () => void;
  onEditFinish: () => void;
}

export function RoutineRail({
  model,
  onEditStep,
  onDeleteStep,
  onAddStep,
  onEditFinish,
}: RoutineRailProps) {
  const t = useTheme();
  const { t: tr } = useTranslation('routines');
  const { rows } = model;

  // ── Shared layout styles ───────────────────────────────────────────────────

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'stretch',
  };

  const contentCol: ViewStyle = {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: t.space[2],
  };

  // ── Step card ──────────────────────────────────────────────────────────────

  const card: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.card,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[2],
    gap: t.space[0.5],
    minHeight: t.size.planCardMin,
    justifyContent: 'center',
  };

  const titleStyle: TextStyle = {
    ...(type.bodySmBold as unknown as TextStyle),
    color: t.colors.ink,
  };

  const metaStyle: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  // ── Cap rows (start / finish) ──────────────────────────────────────────────

  const capStyle: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  // Same weight as the "＋ add step" tail so the finish-time CTA reads as an
  // equally tappable action, not a quiet caption.
  const capCtaStyle: TextStyle = {
    ...(type.bodySmBold as unknown as TextStyle),
    color: t.colors.primary,
  };

  // ── Breather row ───────────────────────────────────────────────────────────

  const breatherStyle: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkFaint,
  };

  // ── Add-step tail ──────────────────────────────────────────────────────────

  const addStyle: TextStyle = {
    ...(type.bodySmBold as unknown as TextStyle),
    color: t.colors.primary,
  };

  // ── Swipe delete action — mirrors TaskRow exactly ──────────────────────────
  // Text color uses t.colors.paper (same token TaskRow uses for icon + label on
  // a danger background). t.colors.onDanger does not exist as a token.

  const deleteActionStyle: ViewStyle = {
    backgroundColor: t.colors.danger, // audit-ok: destructive — a delete action reads as red
    borderTopRightRadius: t.radii.card,
    borderBottomRightRadius: t.radii.card,
    justifyContent: 'center',
    alignItems: 'center',
    width: t.size.control.lg + t.space[5] + t.space[4],
    marginLeft: -t.radii.card,
    paddingLeft: t.radii.card,
  };

  const deleteLabelStyle: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    fontSize: t.fontSize.xs,
    color: t.colors.paper,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    marginTop: t.space[0.5],
  };

  // ── Row helpers ────────────────────────────────────────────────────────────

  function renderDeleteAction(id: string, label: string) {
    return (
      <Pressable
        onPress={() => onDeleteStep(id)}
        accessibilityRole="button"
        accessibilityLabel={tr('rail.removeA11y', { label })}
        style={deleteActionStyle}
      >
        <AppText style={deleteLabelStyle}>{tr('rail.remove')}</AppText>
      </Pressable>
    );
  }

  function renderRow(r: RailRow, i: number) {
    const isFirst = i === 0;
    const isLast = false;

    if (r.kind === 'start') {
      const label = clockLabel(r.clockMin);
      return (
        <View key={`start-${i}`} style={row}>
          <PlanRail
            state="next"
            isFirst={isFirst}
            isLast={isLast}
            prevState="next"
            timeLabel={label}
          />
          <View style={contentCol}>
            <AppText style={capStyle}>{tr('rail.start')}</AppText>
          </View>
        </View>
      );
    }

    if (r.kind === 'finish') {
      const label = clockLabel(r.clockMin);
      const hasTime = label !== undefined;
      return (
        <Pressable
          key={`finish-${i}`}
          onPress={onEditFinish}
          style={row}
          accessibilityRole="button"
          accessibilityLabel={hasTime ? tr('rail.doneByA11y', { time: label }) : tr('rail.setFinishTimeA11y')}
        >
          <PlanRail
            state="next"
            isFirst={isFirst}
            isLast={isLast}
            prevState="next"
            timeLabel={label}
          />
          <View style={contentCol}>
            {hasTime ? (
              <AppText style={capStyle}>{tr('rail.doneBy')}</AppText>
            ) : (
              <AppText style={capCtaStyle}>{tr('rail.setFinishTime')}</AppText>
            )}
          </View>
        </Pressable>
      );
    }

    if (r.kind === 'breather') {
      return (
        <View key={`breather-${i}`} style={row}>
          <PlanRail
            state="breather"
            isFirst={isFirst}
            isLast={isLast}
            prevState="next"
          />
          <View style={contentCol}>
            <AppText style={breatherStyle}>{tr('rail.breather', { count: r.min })}</AppText>
          </View>
        </View>
      );
    }

    // r.kind === 'step'
    return (
      <ReanimatedSwipeable
        key={r.id}
        friction={2}
        rightThreshold={t.space[10]}
        overshootRight={false}
        onSwipeableWillOpen={() => haptics.selection()}
        renderRightActions={() => renderDeleteAction(r.id, r.label)}
      >
        <Pressable
          style={row}
          onPress={() => onEditStep(r.id)}
          accessibilityRole="button"
          accessibilityLabel={tr('rail.editA11y', { label: r.label })}
        >
          <PlanRail
            state="next"
            isFirst={isFirst}
            isLast={isLast}
            prevState="next"
            timeLabel={clockLabel(r.clockMin)}
          />
          <View style={contentCol}>
            <View style={card}>
              <AppText style={titleStyle} numberOfLines={1}>
                {r.label}
              </AppText>
              <AppText style={metaStyle} numberOfLines={1}>
                {categoryName(r.category)} · {tr('rail.honestMinutes', { count: r.honestMin })}
                {r.clockMin !== null ? ` · ${clockLabel(r.clockMin) ?? ''}` : ''}
              </AppText>
            </View>
          </View>
        </Pressable>
      </ReanimatedSwipeable>
    );
  }

  return (
    <View>
      {rows.map((r, i) => renderRow(r, i))}

      {/* Add-step tail — always rendered below the last row */}
      <Pressable
        onPress={onAddStep}
        style={row}
        accessibilityRole="button"
        accessibilityLabel={tr('rail.addStepA11y')}
      >
        <PlanRail state="next" isLast prevState="next" />
        <View style={contentCol}>
          <AppText style={addStyle}>{tr('rail.addStepTail')}</AppText>
        </View>
      </Pressable>
    </View>
  );
}
