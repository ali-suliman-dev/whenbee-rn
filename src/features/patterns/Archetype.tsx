import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { PatternCard } from './PatternCard';
import type { ArchetypeCard } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// Archetype (S1) — one shareable time-personality derived from the spread of your
// category multipliers. Flattering-but-honest, never a diagnosis: a self-portrait
// you'd be happy to read aloud.
// ──────────────────────────────────────────────────────────────────────────────

export function Archetype({ card }: { card: ArchetypeCard }) {
  const t = useTheme();
  const title: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const blurb: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  const note: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint };
  const block: ViewStyle = { gap: t.space[1.5] };

  return (
    <PatternCard eyebrow="YOUR TIME PERSONALITY" icon="sparkles-outline" dismissLabel="Hide your time personality">
      <View style={block}>
        <Text style={title}>{card.title}</Text>
        <Text style={blurb}>{card.blurb}</Text>
        <Text style={note}>Across your tracked tasks you run about {card.averageMultiplier.toFixed(1)}× your guess.</Text>
      </View>
    </PatternCard>
  );
}
