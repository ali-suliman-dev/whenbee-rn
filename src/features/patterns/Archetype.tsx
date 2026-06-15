import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppButton } from '@/src/components/AppButton';
import { ShareableCard } from '@/src/components/ShareableCard';
import { useShareCard } from '@/src/features/share/useShareCard';
import { PatternCard } from './PatternCard';
import type { ArchetypeCard } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// Archetype (S1) — one shareable time-personality derived from the spread of your
// category multipliers. Flattering-but-honest, never a diagnosis: a self-portrait
// you'd be happy to read aloud — now sharable as an on-device image (Pro).
// ──────────────────────────────────────────────────────────────────────────────

export function Archetype({ card }: { card: ArchetypeCard }) {
  const t = useTheme();
  const archetypeShare = useShareCard('archetype');
  const { title: archTitle, blurb, averageMultiplier } = card;

  const title: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const blurbStyle: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  const note: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint };
  const block: ViewStyle = { gap: t.space[1.5] };

  return (
    <PatternCard eyebrow="YOUR TIME PERSONALITY" icon="sparkles-outline" dismissLabel="Hide your time personality">
      <View style={block}>
        <Text style={title}>{archTitle}</Text>
        <Text style={blurbStyle}>{blurb}</Text>
        <Text style={note}>Across your tracked tasks you run about {averageMultiplier.toFixed(1)}× your guess.</Text>
        <View style={{ alignSelf: 'flex-start', marginTop: t.space[2] }}>
          <AppButton
            label="Share my archetype"
            variant="ghost"
            size="md"
            onPress={archetypeShare.onShare}
          />
        </View>
      </View>

      {/* Off-screen capture card — for react-native-view-shot only; never visible. */}
      <View style={{ position: 'absolute', left: -9999, top: 0 }} pointerEvents="none">
        <ShareableCard
          ref={archetypeShare.ref}
          data={{ kind: 'archetype', title: archTitle, blurb, averageMultiplier }}
        />
      </View>
    </PatternCard>
  );
}
