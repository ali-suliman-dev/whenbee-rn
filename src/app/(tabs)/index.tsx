import { View, Text, Pressable, ScrollView, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { haptics } from '@/src/lib/haptics';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { ActiveTimerBar } from '@/src/components/ActiveTimerBar';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useToday } from '@/src/features/today/useToday';
import { FocusCard } from '@/src/features/today/FocusCard';
import { ReclaimTodayLine } from '@/src/features/today/ReclaimTodayLine';
import { HoneycombStrip } from '@/src/components/honeycomb/HoneycombStrip';
import type { HoneycombCell } from '@/src/components/honeycomb/Honeycomb';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';

// Date label, e.g. "Fri · Jun 12" — the day + date, no clock (the time added
// nothing here and ticked distractingly).
function dateLabel(now: Date): string {
  const day = now.toLocaleDateString('en-US', { weekday: 'short' });
  const date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${day} · ${date}`;
}

export default function Today() {
  const t = useTheme();
  const { focus, summary, categoryName, todayReclaimMin } = useToday();

  // Build the honey strip from the tracked categories + their cached stats. One
  // hex per tracked category; sharpness/tier come straight from the calibration
  // cache (monotonic — cells only ever rise).
  const categories = useCategoriesStore((s) => s.categories);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const logs = useCalibrationStore((s) => s.logs);
  const honeyCells: HoneycombCell[] = categories.map((c) => {
    const stat = statsByCategory[c.id];
    return {
      categoryId: c.id,
      label: c.name,
      sharpness: stat?.sharpness ?? 0,
      tier: stat?.tier ?? 'Raw',
    };
  });

  const logChip: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    alignSelf: 'stretch',
    // Sits as the natural last item, not a pinned footer — a small extra top
    // margin lifts it just clear of the content above (the row gap does the rest).
    marginTop: t.space[2],
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.hairline,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[4],
  };
  const logChipText: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink, flex: 1 };

  const emptyCopy: TextStyle = {
    ...(type.body as unknown as TextStyle),
    color: t.colors.inkSoft,
    textAlign: 'center',
  };

  const FAB_SIZE = 56;
  const FAB_EDGE = 5;
  const fabPosition: ViewStyle = {
    position: 'absolute',
    right: t.space[5],
    bottom: t.space[6],
    paddingBottom: FAB_EDGE,
  };
  // Low-emphasis FAB: a neutral raised "coin" with an indigo + glyph, so only the
  // Start button holds the single indigo FILL on the screen. Same 3D coin press.
  const fabEdge: ViewStyle = {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: t.colors.border,
  };
  const fabCircle: ViewStyle = {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: t.colors.surfaceRaised,
    borderWidth: t.borderWidth.hairline,
    borderColor: t.colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  };

  // FAB presses straight down onto its edge on tap (a clean 3D drop), then
  // springs back. No scale, no spin — the depth shift carries the feedback.
  const reducedMotion = useReducedMotion();
  const fabY = useSharedValue(0);
  const fabAnim = useAnimatedStyle(() => ({ transform: [{ translateY: fabY.get() }] }));
  function fabPressIn() {
    if (reducedMotion) return;
    fabY.set(withTiming(FAB_EDGE - 1, { duration: t.motion.press }));
  }
  function fabPressOut() {
    if (reducedMotion) return;
    fabY.set(withSpring(0, t.motion.spring));
  }

  return (
    <Screen>
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            gap: t.space[5],
            // Reserve the FAB's footprint so the log chip never sits under it.
            paddingBottom: FAB_SIZE + t.space[8],
          }}
          showsVerticalScrollIndicator={false}
        >
          <ScreenHeader
            title="Today"
            subtitle={dateLabel(new Date())}
            right={
              <Pressable
                onPress={() => router.push('/settings')}
                accessibilityRole="button"
                accessibilityLabel="Settings"
                hitSlop={8}
              >
                <Ionicons name="settings-outline" size={22} color={t.colors.inkSoft} />
              </Pressable>
            }
          />

          <ActiveTimerBar />

          <View style={{ gap: t.space[2] }}>
            <HoneycombStrip
              cells={honeyCells}
              logs={logs}
              onPress={() => router.push('/(tabs)/whenbee')}
            />
            <ReclaimTodayLine minutes={todayReclaimMin} />
          </View>

          {focus && summary ? (
            <FocusCard
              category={focus.category}
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
          ) : (
            <Text style={emptyCopy}>
              Nothing tracked yet today — tap + when you start something.
            </Text>
          )}

          <Pressable
            onPress={() => router.push('/(modals)/retro')}
            accessibilityRole="button"
            accessibilityLabel="Log something you finished to ripen your honey"
            style={logChip}
          >
            <Ionicons name="time-outline" size={t.iconSize.sm} color={t.colors.inkSoft} />
            <Text style={logChipText}>Finished something? Log it — it ripens your honey</Text>
            <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkSoft} />
          </Pressable>
        </ScrollView>

        <Pressable
          onPress={() => {
            haptics.light();
            router.push('/(modals)/add-task');
          }}
          onPressIn={fabPressIn}
          onPressOut={fabPressOut}
          accessibilityRole="button"
          accessibilityLabel="Add a task"
          style={fabPosition}
        >
          <View style={fabEdge} />
          <Animated.View style={[fabCircle, fabAnim]}>
            <Ionicons name="add" size={30} color={t.colors.primary} />
          </Animated.View>
        </Pressable>
      </View>
    </Screen>
  );
}
