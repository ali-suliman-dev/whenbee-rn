import { useEffect, useRef, useState } from 'react';
import { View, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { promoteIntoWindow } from '@/src/engine';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { Card } from '@/src/components/Card';
import { FillBar } from '@/src/components/FillBar';
import { formatClock } from '@/src/lib/time';
import { analytics } from '@/src/services/analytics';
import type { FocusWindowResult } from '@/src/domain/types';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useFocusWindow } from './useFocusWindow';
import { FocusWindowList } from './FocusWindowList';
import { FocusWindowEditorSheet } from './FocusWindowEditorSheet';

// ──────────────────────────────────────────────────────────────────────────────
// FocusWindowCard — the Pro focus-window section (Plan tab, BuildView).
//
// Marks the hours the user's head works best, packs their honest-numbered tasks
// into that fixed band, and lists what spills past it with one-tap "Move up".
// States: invite (no window) · fits · spills · empty (no tasks) · prior-basis
// caption · window-passed. The fill bar + "full" state are amber; the single CTA
// is the one filled indigo. No-guilt (spill is "can wait") and no health framing.
// ──────────────────────────────────────────────────────────────────────────────

/** Minutes-after-midnight → a clock string via the app formatter. */
function clockFor(min: number): string {
  const d = new Date();
  d.setHours(Math.floor(min / 60), min % 60, 0, 0);
  return formatClock(d.getTime());
}

/** Current local minute-of-day (for the gentle "window has passed" caption). */
function nowMinuteOfDay(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function Eyebrow({ windowLabel, onEdit }: { windowLabel: string | null; onEdit: () => void }) {
  const t = useTheme();
  const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const chip: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1] };
  const chipText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.ink,
    fontVariant: ['tabular-nums'],
  };
  return (
    <View style={row}>
      <AppText style={eyebrow}>YOUR FOCUS WINDOW</AppText>
      {windowLabel ? (
        <Pressable
          onPress={onEdit}
          hitSlop={t.space[2]}
          accessibilityRole="button"
          accessibilityLabel="Edit your focus window"
        >
          <View style={chip}>
            <AppText style={chipText}>{windowLabel}</AppText>
            <Ionicons name="pencil" size={t.iconSize.xs} color={t.colors.inkSoft} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

function Headline({ result }: { result: FocusWindowResult }) {
  const t = useTheme();
  const allFit = result.fitCount === result.totalCount;
  const wrap: ViewStyle = { flexDirection: 'row', alignItems: 'baseline', gap: t.space[2] };
  const big: TextStyle = { ...(type.honestNumberMd as unknown as TextStyle), color: t.colors.ink };
  const rest: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  return (
    <View style={wrap}>
      {allFit ? (
        <>
          <AppText style={big}>All {result.totalCount}</AppText>
          <AppText style={rest}>fit your window</AppText>
        </>
      ) : (
        <>
          <AppText style={big}>{result.fitCount}</AppText>
          <AppText style={rest}>of {result.totalCount} fit your window</AppText>
        </>
      )}
    </View>
  );
}

function Verdict({ result }: { result: FocusWindowResult }) {
  const t = useTheme();
  const style: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.ink };
  if (result.verdict === 'fits') {
    const spare = result.windowMin - result.packedMin;
    const text =
      spare > 0
        ? `These fit your focus window with ${spare}m to spare.`
        : 'These fit your focus window. Right to the edge.';
    return <AppText style={style}>{text}</AppText>;
  }
  const text =
    result.fitCount === 1
      ? 'One fits your window. The rest can wait.'
      : `${result.fitCount} of these fit. The rest can wait.`;
  return <AppText style={style}>{text}</AppText>;
}

export function FocusWindowCard() {
  const t = useTheme();
  const isPro = useEntitlement((s) => s.isPro);
  const startMin = useSettingsStore((s) => s.windowStartMin);
  const endMin = useSettingsStore((s) => s.windowEndMin);
  const { result, hasWindow, setWindow, promote } = useFocusWindow();
  const [editing, setEditing] = useState(false);

  useViewedEvent(result, isPro);
  useSpilledEvent(result);

  const handleSave = (nextStart: number, nextEnd: number) => {
    setWindow(nextStart, nextEnd);
    setEditing(false);
    analytics.capture('focus_window_set', {
      window_start_min: nextStart,
      window_end_min: nextEnd,
      window_min: Math.max(0, nextEnd - nextStart),
    });
  };

  const handleMoveUp = (id: string) => {
    if (!result) return;
    const projected = promoteIntoWindow(result, id);
    if (projected === result) return; // unfittable — no change, no event
    promote(id);
    const evictedN = result.inWindow.filter((p) => !projected.inWindow.some((q) => q.id === p.id)).length;
    analytics.capture('focus_window_promoted', {
      saved_min: Math.max(0, projected.packedMin - result.packedMin),
      evicted_n: evictedN,
      verdict_after: projected.verdict,
    });
  };

  const windowLabel =
    hasWindow && startMin !== null && endMin !== null
      ? `${clockFor(startMin)}–${clockFor(endMin)}`
      : null;

  return (
    <Card style={{ gap: t.space[3] }}>
      <Eyebrow windowLabel={windowLabel} onEdit={() => setEditing(true)} />
      <CardBody
        result={result}
        hasWindow={hasWindow}
        startMin={startMin}
        endMin={endMin}
        onSetWindow={() => setEditing(true)}
        onMoveUp={handleMoveUp}
      />
      <FocusWindowEditorSheet
        visible={editing}
        startMin={startMin}
        endMin={endMin}
        onConfirm={handleSave}
        onCancel={() => setEditing(false)}
      />
    </Card>
  );
}

/** Fire the impression once per mount with the resolved verdict. */
function useViewedEvent(result: FocusWindowResult | null, isPro: boolean) {
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    analytics.capture('focus_window_viewed', {
      verdict: result?.verdict ?? 'unset',
      fit_count: result?.fitCount ?? 0,
      total_count: result?.totalCount ?? 0,
      window_min: result?.windowMin ?? 0,
      is_pro: isPro,
    });
  }, [result, isPro]);
}

/** Fire when the fit first becomes a spill (a new decision surface appeared). */
function useSpilledEvent(result: FocusWindowResult | null) {
  const firedRef = useRef(false);
  useEffect(() => {
    if (!result || result.verdict !== 'spills') {
      firedRef.current = false;
      return;
    }
    if (firedRef.current) return;
    firedRef.current = true;
    analytics.capture('focus_window_spills', {
      fit_count: result.fitCount,
      spill_count: result.spilled.length,
      window_min: result.windowMin,
    });
  }, [result]);
}

function CardBody({
  result,
  hasWindow,
  startMin,
  endMin,
  onSetWindow,
  onMoveUp,
}: {
  result: FocusWindowResult | null;
  hasWindow: boolean;
  startMin: number | null;
  endMin: number | null;
  onSetWindow: () => void;
  onMoveUp: (id: string) => void;
}) {
  const t = useTheme();
  const body: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.ink };
  const caption: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };

  // Invite — no window set yet.
  if (!hasWindow || !result || startMin === null || endMin === null) {
    return (
      <View style={{ gap: t.space[3] }}>
        <AppText style={body}>
          Mark the hours your head works best. I&apos;ll fit the right tasks into them.
        </AppText>
        <AppButton label="Set focus window" variant="ghost" size="sm" onPress={onSetWindow} />
      </View>
    );
  }

  const rangeLabel = `${clockFor(startMin)}–${clockFor(endMin)}`;

  // Empty — window set, nothing planned.
  if (result.totalCount === 0) {
    return (
      <AppText style={caption}>
        No tasks yet. Add some and I&apos;ll fit them into {rangeLabel}.
      </AppText>
    );
  }

  const fillFor = result.verdict === 'spills' ? 1 : result.windowMin > 0 ? result.packedMin / result.windowMin : 1;
  const fillColor = result.verdict === 'spills' ? t.colors.accent : t.colors.primarySoft;
  const windowPassed = nowMinuteOfDay() >= endMin;

  const barCaption: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
    fontVariant: ['tabular-nums'],
    marginTop: t.space[1],
  };

  return (
    <View style={{ gap: t.space[3] }}>
      <Headline result={result} />
      <View>
        <FillBar fraction={fillFor} fillColor={fillColor} />
        <AppText style={barCaption}>
          {result.packedMin}m / {result.windowMin}m
        </AppText>
      </View>

      {result.basis === 'prior' ? (
        <AppText style={caption}>Times from typical patterns. Gets sharper as you log.</AppText>
      ) : null}

      <FocusWindowList inWindow={result.inWindow} spilled={result.spilled} onMoveUp={onMoveUp} />

      {windowPassed ? (
        <AppText style={caption}>Today&apos;s window has passed. This is ready for tomorrow.</AppText>
      ) : (
        <Verdict result={result} />
      )}
    </View>
  );
}
