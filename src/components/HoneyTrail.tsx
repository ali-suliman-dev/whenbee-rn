import { useCallback } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Keyframe,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Line } from 'react-native-svg';
import { useAmbientMotion } from '@/src/hooks/useAmbientMotion';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from './AppText';
import { BeeMascot } from './BeeMascot';

// ──────────────────────────────────────────────────────────────────────────────
// HoneyTrail — Honey-drop tier trail (replaces padlock-based TierTrail)
//
// Node states communicate meaning via BOTH shape AND color (accessibility rule):
//   done   — filled honey drop (accent) with a soft gloss highlight ellipse
//   now    — honey ring (accent stroke) with BeeMascot centered inside
//   ahead  — hairline outline circle in inkFaint (no padlock)
//
// Connector between nodes:
//   solid accent       — when left node is 'done' OR right node is 'now'
//   dotted inkFaint    — otherwise (strokeDasharray '2 6')
//
// Labels sit below each node using AppText variant="label" (uppercase eyebrow).
// Accessible: each node has accessibilityLabel="${label}: ${state}".
//
// `lively` (opt-in, onboarding only) brings the trail to life on mount: nodes pop
// in left→right, connectors draw between them, and the 'now' node breathes a calm
// "you are here" halo. Off by default so the static hub trail is unchanged.
// ──────────────────────────────────────────────────────────────────────────────

export type TrailState = 'done' | 'now' | 'ahead';
export interface TrailNode {
  label: string;
  state: TrailState;
}

const NODE = 28;

// Nodes pop from 0.6 (never 0 — nothing in the real world appears from nothing).
const nodeEnter = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.6 }] },
  100: { opacity: 1, transform: [{ scale: 1 }] },
});
// Connectors draw outward from their left node (paired with transformOrigin:'left').
const connectorEnter = new Keyframe({
  0: { opacity: 0, transform: [{ scaleX: 0 }] },
  100: { opacity: 1, transform: [{ scaleX: 1 }] },
});

function Node({ state, lively = false }: { state: TrailState; lively?: boolean }) {
  const t = useTheme();
  const reduced = useReducedMotion();

  // Calm "you are here" breath on the current node — grows and fades, then resets
  // while invisible (no blink). Only the 'now' node in lively mode runs it.
  const pulse = useSharedValue(0);
  useAmbientMotion(
    state === 'now' && lively && !reduced,
    useCallback(() => {
      pulse.set(
        withRepeat(withTiming(1, { duration: t.motion.halo, easing: t.motion.easing.calm }), -1, false),
      );
      return () => {
        cancelAnimation(pulse);
        pulse.set(0);
      };
    }, [pulse, t.motion]),
  );
  const haloStyle = useAnimatedStyle(() => ({
    opacity: (1 - pulse.get()) * t.opacity.disabled,
    transform: [{ scale: 1 + pulse.get() * 0.55 }],
  }));

  if (state === 'now') {
    return (
      <View
        style={{ width: NODE, height: NODE, alignItems: 'center', justifyContent: 'center' }}
      >
        {lively && !reduced ? (
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: NODE,
                height: NODE,
                borderRadius: t.radii.full,
                borderWidth: t.borderWidth.thick,
                borderColor: t.colors.accent,
              },
              haloStyle,
            ]}
          />
        ) : null}
        <Svg width={NODE} height={NODE}>
          <Circle
            cx={NODE / 2}
            cy={NODE / 2}
            r={NODE / 2 - t.borderWidth.thick}
            fill="none"
            stroke={t.colors.accent}
            strokeWidth={t.borderWidth.thick}
          />
        </Svg>
        <View style={{ position: 'absolute' }}>
          <BeeMascot size={Math.round(NODE * 0.62)} />
        </View>
      </View>
    );
  }

  // 'done' and 'ahead' — SVG-only nodes
  const r = state === 'done' ? 9 : 8;
  return (
    <Svg width={NODE} height={NODE}>
      {state === 'done' ? (
        <>
          <Circle cx={NODE / 2} cy={NODE / 2} r={r} fill={t.colors.accent} />
          {/* Gloss highlight ellipse — pure SVG geometry, not a theme value */}
          <Ellipse
            cx={NODE / 2 - 3}
            cy={NODE / 2 - 3}
            rx={3}
            ry={2}
            fill={t.colors.surface}
            opacity={t.opacity.disabled}
          />
        </>
      ) : (
        <Circle
          cx={NODE / 2}
          cy={NODE / 2}
          r={r}
          fill="none"
          stroke={t.colors.inkFaint}
          strokeWidth={t.borderWidth.thick}
        />
      )}
    </Svg>
  );
}

function labelColor(
  state: TrailState,
  colors: ReturnType<typeof useTheme>['colors'],
): string {
  if (state === 'now') return colors.accent;
  if (state === 'done') return colors.inkSoft;
  return colors.inkFaint;
}

export function HoneyTrail({ nodes, lively = false }: { nodes: TrailNode[]; lively?: boolean }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const animate = lively && !reduced;
  // Let the surrounding card settle first, then cascade the trail to life.
  const base = t.motion.fast;
  const step = t.motion.enterStagger;

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'flex-start' }}
      accessibilityRole="list"
    >
      {nodes.map((node, i) => {
        const isLast = i === nodes.length - 1;
        const next = nodes[i + 1];
        const solid = node.state === 'done' || next?.state === 'now';

        const col: ViewStyle = {
          flexDirection: 'row',
          alignItems: 'flex-start',
          flex: isLast ? 0 : 1,
        };

        return (
          <View key={i} style={col}>
            {/* Node column: circle + label */}
            <Animated.View
              style={{ alignItems: 'center', gap: t.space[1] }}
              entering={animate ? nodeEnter.duration(t.motion.base).delay(base + i * step) : undefined}
            >
              <View
                accessible
                accessibilityLabel={`${node.label}: ${node.state}`}
              >
                <Node state={node.state} lively={lively} />
              </View>
              <AppText
                variant="label"
                numberOfLines={1}
                style={{
                  textAlign: 'center',
                  width: t.space[16],
                  fontSize: t.fontSize.xs,
                  color: labelColor(node.state, t.colors),
                }}
              >
                {node.label}
              </AppText>
            </Animated.View>

            {/* Connector line stretching to the next node */}
            {!isLast && (
              <Animated.View
                style={{ flex: 1, paddingTop: NODE / 2, transformOrigin: 'left' }}
                entering={
                  animate
                    ? connectorEnter.duration(t.motion.slow).delay(base + i * step + step / 2)
                    : undefined
                }
              >
                <Svg width="100%" height={t.borderWidth.thick}>
                  <Line
                    x1="0"
                    y1="0"
                    x2="100%"
                    y2="0"
                    stroke={solid ? t.colors.accent : t.colors.inkFaint}
                    strokeWidth={t.borderWidth.thick}
                    strokeDasharray={solid ? undefined : '2 6'}
                    strokeLinecap="round"
                  />
                </Svg>
              </Animated.View>
            )}
          </View>
        );
      })}
    </View>
  );
}
