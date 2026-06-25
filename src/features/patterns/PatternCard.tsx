import { type ReactNode } from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { usePatternDismiss } from './usePatternDismiss';

// ──────────────────────────────────────────────────────────────────────────────
// PatternCard — the shared shell for every Patterns self-insight card. Keeps the
// 7 cards on one rhythm: an indigo eyebrow (the section voice), an optional dismiss
// (×, 44pt hit target, matches AhaCard), then the card's own body. Flat tone — the
// workhorse surface; no shadow, no red, amber stays scarce.
//
// Dismissal is DURABLE (not session-only): each card receives a stable `dismissId`
// keyed by content/period (e.g. "drift:{categoryId}:{ISO-week}"); dismissing writes
// that id to kv so the card stays gone across restarts. A genuinely-new insight
// (different content key) appears as fresh — no pre-dismissal of new content.
// See usePatternDismiss for the full id scheme.
// ──────────────────────────────────────────────────────────────────────────────

interface PatternCardProps {
  eyebrow: string;
  icon: keyof typeof Ionicons.glyphMap;
  dismissLabel: string;
  /** Stable, content-keyed id for this card instance. Same id = stays dismissed;
   *  different id (new content/period) = appears fresh. Required. */
  dismissId: string;
  children: ReactNode;
}

export function PatternCard({ eyebrow, icon, dismissLabel, dismissId, children }: PatternCardProps) {
  const t = useTheme();
  const { dismissed, dismiss } = usePatternDismiss(dismissId);
  if (dismissed) return null;

  const header: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };
  const eyebrowRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2], flex: 1 };
  const eyebrowText: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.primary };
  const dismissBtn: ViewStyle = {
    width: t.size.control.md,
    height: t.size.control.md,
    marginRight: -t.space[2],
    marginTop: -t.space[2],
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  };

  return (
    <Card tone="flat" style={{ gap: t.space[3] }}>
      <View style={header}>
        <View style={eyebrowRow}>
          <Ionicons name={icon} size={t.iconSize.sm} color={t.colors.primary} />
          <Text style={eyebrowText} numberOfLines={1}>
            {eyebrow}
          </Text>
        </View>
        <Pressable
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          hitSlop={8}
          style={dismissBtn}
        >
          <Ionicons name="close" size={t.iconSize.sm} color={t.colors.inkFaint} />
        </Pressable>
      </View>
      {children}
    </Card>
  );
}
