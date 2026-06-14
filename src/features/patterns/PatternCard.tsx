import { useState, type ReactNode } from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// PatternCard — the shared shell for every Patterns self-insight card. Keeps the
// 7 cards on one rhythm: an indigo eyebrow (the section voice), an optional dismiss
// (×, 44pt hit target, matches AhaCard), then the card's own body. Flat tone — the
// workhorse surface; no shadow, no red, amber stays scarce. Dismiss is local state
// (kind: a card you've read can step aside without nagging you again this session).
// ──────────────────────────────────────────────────────────────────────────────

interface PatternCardProps {
  eyebrow: string;
  icon: keyof typeof Ionicons.glyphMap;
  dismissLabel: string;
  children: ReactNode;
}

export function PatternCard({ eyebrow, icon, dismissLabel, children }: PatternCardProps) {
  const t = useTheme();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const header: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };
  const eyebrowRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2], flex: 1 };
  const eyebrowText: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.primary };
  const dismiss: ViewStyle = {
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
          onPress={() => setDismissed(true)}
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          hitSlop={8}
          style={dismiss}
        >
          <Ionicons name="close" size={t.iconSize.sm} color={t.colors.inkFaint} />
        </Pressable>
      </View>
      {children}
    </Card>
  );
}
