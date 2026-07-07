// src/features/today/TimelineEmptyState.tsx
// Pre-plan state shown in the Timeline tab before the day has a plan: a calendar
// glyph, a title, one supporting line, and the existing PlanMyDayButton wired to
// onPlan. Static — no entrance motion (no slide/bounce per the animation rule).

import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/useTheme';
import { PlanMyDayButton } from './PlanMyDayButton';

interface TimelineEmptyStateProps {
  onPlan: () => void;
  isPro: boolean;
}

export function TimelineEmptyState({ onPlan, isPro }: TimelineEmptyStateProps) {
  const t = useTheme();

  return (
    <View
      style={{
        alignItems: 'center',
        gap: t.space[3],
        paddingVertical: t.space[6],
        paddingHorizontal: t.space[4],
      }}
    >
      <Ionicons name="calendar-outline" size={t.iconSize.lg} color={t.colors.inkSoft} />
      <Text
        style={{
          fontSize: t.fontSize.md,
          fontWeight: t.fontWeight.semibold,
          color: t.colors.ink,
          fontFamily: t.fontFamily.ui,
        }}
      >
        No plan for today yet
      </Text>
      <Text
        style={{
          fontSize: t.fontSize.sm,
          color: t.colors.inkSoft,
          fontFamily: t.fontFamily.ui,
          textAlign: 'center',
        }}
      >
        Build a timeline around your calendar and get a start-by time.
      </Text>
      <PlanMyDayButton onPress={onPlan} isPro={isPro} label="Plan my day" />
    </View>
  );
}
