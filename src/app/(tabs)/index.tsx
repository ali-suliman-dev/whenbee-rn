import { View, Text, Pressable, ScrollView, type ViewStyle, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useToday } from '@/src/features/today/useToday';
import { FocusCard } from '@/src/features/today/FocusCard';
import { HoneycombStripPlaceholder } from '@/src/features/today/HoneycombStripPlaceholder';

// Live date label, e.g. "Sat · 9:41". OK to read the clock here (per spec).
function dateLabel(now: Date): string {
  const day = now.toLocaleDateString('en-US', { weekday: 'short' });
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false });
  return `${day} · ${time}`;
}

export default function Today() {
  const t = useTheme();
  const { focus, summary, categoryName } = useToday();

  const brandRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: t.space[2],
  };
  const screenTitle: TextStyle = { ...(type.title as unknown as TextStyle), color: t.colors.ink };
  const dateText: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };

  const leadLine: TextStyle = {
    ...(type.body as unknown as TextStyle),
    color: t.colors.inkSoft,
    textAlign: 'center',
  };

  const logChip: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.space[2],
    alignSelf: 'center',
    backgroundColor: t.colors.surface,
    borderWidth: 1.5,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.pill,
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[3],
  };
  const logChipText: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink };

  const emptyCopy: TextStyle = {
    ...(type.body as unknown as TextStyle),
    color: t.colors.inkSoft,
    textAlign: 'center',
  };

  const fab: ViewStyle = {
    position: 'absolute',
    right: t.space[5],
    bottom: t.space[6],
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: t.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    // flat offset edge (no blur) — physical tactile shadow
    shadowColor: t.colors.primaryEdge,
    shadowOffset: { width: 0, height: t.shadow.md.offset },
    shadowOpacity: t.shadow.md.opacity,
    shadowRadius: t.shadow.md.radius,
    elevation: t.shadow.md.offset,
  };

  return (
    <Screen>
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ gap: t.space[5], paddingBottom: t.space[16] }}
          showsVerticalScrollIndicator={false}
        >
          <View style={brandRow}>
            <Text style={screenTitle}>Today</Text>
            <Text style={dateText}>{dateLabel(new Date())}</Text>
          </View>

          <HoneycombStripPlaceholder onPress={() => router.push('/(tabs)/whenbee')} />

          {focus && summary ? (
            <>
              <FocusCard
                categoryLabel={categoryName(focus.category)}
                taskTitle={focus.label}
                summary={summary}
                onStart={() =>
                  router.push({
                    pathname: '/(modals)/timer',
                    params: {
                      taskId: focus.id,
                      label: focus.label,
                      category: focus.category,
                      estimateMin: summary.honestMinutes,
                      guessMin: focus.guessMin,
                    },
                  })
                }
              />
              <Text style={leadLine}>Just the one thing in front of you.</Text>
            </>
          ) : (
            <Text style={emptyCopy}>
              Nothing tracked yet today — tap + when you start something.
            </Text>
          )}

          <Pressable
            onPress={() => router.push('/(modals)/retro')}
            accessibilityRole="button"
            accessibilityLabel="Finished something? Log it and ripen your honey"
            style={({ pressed }) => [logChip, pressed ? { opacity: 0.8 } : null]}
          >
            <Ionicons name="time-outline" size={18} color={t.colors.primary} />
            <Text style={logChipText}>Finished something? Log it &amp; ripen your honey</Text>
          </Pressable>
        </ScrollView>

        <Pressable
          onPress={() => router.push('/(modals)/add-task')}
          accessibilityRole="button"
          accessibilityLabel="Add a task"
          style={({ pressed }) => [fab, pressed ? { opacity: 0.9 } : null]}
        >
          <Ionicons name="add" size={30} color={t.colors.onIndigo} />
        </Pressable>
      </View>
    </Screen>
  );
}
