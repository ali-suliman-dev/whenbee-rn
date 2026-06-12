import { useEffect, useState } from 'react';
import { Pressable, View, type TextStyle, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from './AppText';
import { useTimerStore } from '@/src/stores/timerStore';

// ──────────────────────────────────────────────────────────────────────────────
// ActiveTimerBar — a slim persistent pill shown while a timer is running, so a
// minimized session always has a place to be seen and reopened (rendered on Today
// + Plan, under the header). Live elapsed is derived from the persisted startedAt
// (wall-clock), ticked once a second only while this bar is mounted. Tapping it
// reopens the SAME session — the timer screen attaches to the running startedAt
// (it does not restart). Flat, hairline border, no shadow.
// ──────────────────────────────────────────────────────────────────────────────

function elapsedLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function ActiveTimerBar() {
  const t = useTheme();
  const isRunning = useTimerStore((s) => s.isRunning);
  const startedAt = useTimerStore((s) => s.startedAt);
  const taskLabel = useTimerStore((s) => s.taskLabel);
  const category = useTimerStore((s) => s.category);
  const estimateMin = useTimerStore((s) => s.estimateMin);
  const guessMin = useTimerStore((s) => s.guessMin);
  const taskId = useTimerStore((s) => s.taskId);
  const suggestedHonestMin = useTimerStore((s) => s.suggestedHonestMin);

  const [elapsedSec, setElapsedSec] = useState(0);

  // Cheap 1s tick — only while mounted AND running. The clock math is wall-clock
  // (now - startedAt), so it stays correct across backgrounding/relaunch.
  useEffect(() => {
    if (!isRunning || startedAt === null) return;
    const update = () => setElapsedSec(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isRunning, startedAt]);

  if (!isRunning || startedAt === null) return null;

  const bar: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    alignSelf: 'stretch',
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.hairline,
    borderColor: t.colors.border,
    borderRadius: t.radii.full,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[3],
  };
  const dot: ViewStyle = {
    width: t.space[2],
    height: t.space[2],
    borderRadius: t.radii.full,
    backgroundColor: t.colors.primary,
  };
  const labelStyle: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink, flex: 1 };
  const elapsedStyle: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
    fontVariant: ['tabular-nums'],
  };

  function reopen() {
    router.push({
      pathname: '/(modals)/timer',
      params: {
        ...(taskId ? { taskId } : null),
        label: taskLabel ?? 'Focus session',
        category: category ?? 'getting_ready',
        estimateMin: String(estimateMin),
        guessMin: String(guessMin),
        suggestedHonestMin: String(suggestedHonestMin),
      },
    });
  }

  return (
    <Pressable
      onPress={reopen}
      accessibilityRole="button"
      accessibilityLabel={`Timing now: ${taskLabel ?? 'a task'}, ${elapsedLabel(elapsedSec)} elapsed. Tap to reopen.`}
      style={bar}
    >
      <View style={dot} />
      <AppText style={labelStyle} numberOfLines={1}>
        {taskLabel ?? 'Timing now'}
      </AppText>
      <AppText style={elapsedStyle}>{elapsedLabel(elapsedSec)}</AppText>
      <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkSoft} />
    </Pressable>
  );
}
