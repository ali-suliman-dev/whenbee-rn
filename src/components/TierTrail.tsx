import { View, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from './AppText';

// ──────────────────────────────────────────────────────────────────────────────
// TierTrail — Flat Tactical UI
//
// Horizontal trail of milestone nodes. State is ALWAYS communicated via both
// color AND icon (never color-only — accessibility requirement).
//
//   done  — primary filled circle with check mark (✓)
//   now   — primary ring (○ outlined, filled center dot)
//   lock  — hairline-colored padlock icon
//
// Each node gets an accessible label via accessibilityLabel.
// ──────────────────────────────────────────────────────────────────────────────

type NodeState = 'done' | 'now' | 'lock';

interface TrailNode {
  label: string;
  state: NodeState;
}

const NODE_SIZE = 28;
const CONNECTOR_HEIGHT = 2;

function NodeIcon({ state, t }: { state: NodeState; t: ReturnType<typeof useTheme> }) {
  const container: ViewStyle = {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...(state === 'done'
      ? { backgroundColor: t.colors.primary }
      : state === 'now'
        ? {
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            borderColor: t.colors.primary,
          }
        : {
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderColor: t.colors.hairline,
          }),
  };

  return (
    <View style={container}>
      {state === 'done' && (
        <AppText
          style={{
            color: t.colors.onIndigo,
            fontSize: 14,
            fontWeight: '700' as '700',
            lineHeight: 16,
          }}
        >
          ✓
        </AppText>
      )}
      {state === 'now' && (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: t.colors.primary,
          }}
        />
      )}
      {state === 'lock' && (
        <AppText
          style={{
            color: t.colors.hairline,
            fontSize: 13,
            lineHeight: 14,
          }}
        >
          🔒
        </AppText>
      )}
    </View>
  );
}

function Connector({ active, t }: { active: boolean; t: ReturnType<typeof useTheme> }) {
  return (
    <View
      style={{
        flex: 1,
        height: CONNECTOR_HEIGHT,
        backgroundColor: active ? t.colors.primary : t.colors.hairline,
        alignSelf: 'center',
        marginTop: -(NODE_SIZE / 2 - CONNECTOR_HEIGHT / 2),
      }}
    />
  );
}

export function TierTrail({ nodes }: { nodes: TrailNode[] }) {
  const t = useTheme();

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'flex-start' }}
      accessibilityRole="list"
    >
      {nodes.map((node, i) => {
        const isLast = i === nodes.length - 1;
        const connectorActive =
          !isLast &&
          (node.state === 'done' || nodes[i + 1]?.state === 'now');

        return (
          <View
            key={i}
            style={{ flexDirection: 'row', alignItems: 'flex-start', flex: isLast ? 0 : 1 }}
            // @ts-expect-error - 'listitem' is valid ARIA but not in RN's narrow type union
            accessibilityRole="listitem"
          >
            {/* Node column */}
            <View style={{ alignItems: 'center', gap: 4 }}>
              <View
                accessible
                accessibilityLabel={`${node.label}: ${node.state === 'done' ? 'completed' : node.state === 'now' ? 'in progress' : 'locked'}`}
              >
                <NodeIcon state={node.state} t={t} />
              </View>
              <AppText
                style={{
                  fontSize: t.fontSize.xs,
                  color:
                    node.state === 'lock' ? t.colors.inkSoft : t.colors.ink,
                  textAlign: 'center',
                  maxWidth: 56,
                }}
              >
                {node.label}
              </AppText>
            </View>

            {/* Connector line to next node */}
            {!isLast && (
              <View style={{ flex: 1, paddingTop: NODE_SIZE / 2 }}>
                <Connector active={connectorActive} t={t} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
