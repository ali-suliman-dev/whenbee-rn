import { View, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, Line } from 'react-native-svg';
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
// ──────────────────────────────────────────────────────────────────────────────

export type TrailState = 'done' | 'now' | 'ahead';
export interface TrailNode {
  label: string;
  state: TrailState;
}

const NODE = 28;

function Node({ state }: { state: TrailState }) {
  const t = useTheme();

  if (state === 'now') {
    return (
      <View
        style={{ width: NODE, height: NODE, alignItems: 'center', justifyContent: 'center' }}
      >
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

export function HoneyTrail({ nodes }: { nodes: TrailNode[] }) {
  const t = useTheme();

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
            <View style={{ alignItems: 'center', gap: t.space[1] }}>
              <View
                accessible
                accessibilityLabel={`${node.label}: ${node.state}`}
              >
                <Node state={node.state} />
              </View>
              <AppText
                variant="label"
                numberOfLines={1}
                style={{
                  textAlign: 'center',
                  width: t.space[16],
                  color: labelColor(node.state, t.colors),
                }}
              >
                {node.label}
              </AppText>
            </View>

            {/* Connector line stretching to the next node */}
            {!isLast && (
              <View style={{ flex: 1, paddingTop: NODE / 2 }}>
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
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
