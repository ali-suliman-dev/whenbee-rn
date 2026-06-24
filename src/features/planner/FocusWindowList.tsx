import { View, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { tokens } from '@/src/theme/tokens';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';
import type { FocusWindowPlacement } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// FocusWindowList — the two stacked task lists inside the focus-window card.
//
// "In your window" rows read calm; "Spills past your window" rows carry a quiet
// ghost "Move up" that promotes a spilled task into the window. Entering-only
// (a promoted row fades into the in-window list; no exiting layout animation —
// Fabric SIGABRT). No-guilt: spill is "can wait", never a deficit.
// ──────────────────────────────────────────────────────────────────────────────

const ROW_ENTER = FadeIn.duration(tokens.motion.base).reduceMotion(ReduceMotion.System);

function formatMinutes(min: number): string {
  return `${min}m`;
}

function HeadingLabel({ children }: { children: string }) {
  const t = useTheme();
  const style: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
    marginBottom: t.space[1],
  };
  return <AppText style={style}>{children}</AppText>;
}

function TaskRow({
  placement,
  onMoveUp,
}: {
  placement: FocusWindowPlacement;
  onMoveUp?: () => void;
}) {
  const t = useTheme();
  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
    paddingVertical: t.space[1],
  };
  const dot: ViewStyle = {
    width: t.space[1.5],
    height: t.space[1.5],
    borderRadius: t.radii.full,
    backgroundColor: placement.inWindow ? t.colors.primarySoft : t.colors.inkFaint,
  };
  const label: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: placement.inWindow ? t.colors.ink : t.colors.inkSoft,
    flex: 1,
  };
  const minutes: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
    fontVariant: ['tabular-nums'],
  };
  const moveUp: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.primary,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
  };

  return (
    <Animated.View entering={ROW_ENTER} style={row}>
      <View style={dot} />
      <AppText style={label} numberOfLines={1}>
        {placement.label}
      </AppText>
      <AppText style={minutes}>{formatMinutes(placement.honestMin)}</AppText>
      {onMoveUp ? (
        <Pressable
          onPress={onMoveUp}
          hitSlop={t.space[2]}
          accessibilityRole="button"
          accessibilityLabel={`Move ${placement.label} into your window`}
        >
          <AppText style={moveUp}>Move up</AppText>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

export function FocusWindowList({
  inWindow,
  spilled,
  onMoveUp,
}: {
  inWindow: FocusWindowPlacement[];
  spilled: FocusWindowPlacement[];
  onMoveUp: (id: string) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space[3] }}>
      {inWindow.length > 0 ? (
        <View>
          <HeadingLabel>In your window</HeadingLabel>
          {inWindow.map((p) => (
            <TaskRow key={p.id} placement={p} />
          ))}
        </View>
      ) : null}

      {spilled.length > 0 ? (
        <View>
          <HeadingLabel>Spills past your window</HeadingLabel>
          {spilled.map((p) => (
            <TaskRow key={p.id} placement={p} onMoveUp={() => onMoveUp(p.id)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
