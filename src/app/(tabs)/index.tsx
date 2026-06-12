import { View, Text, Pressable, ScrollView, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { ScreenHeader } from '@/src/components/ScreenHeader';
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

  const leadLine: TextStyle = {
    ...(type.body as unknown as TextStyle),
    color: t.colors.inkSoft,
    textAlign: 'center',
  };

  const logChip: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
    alignSelf: 'stretch',
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[3],
  };
  const logChipText: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink };

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
  // Solid depth edge behind the front circle — the visible 3D "coin" edge.
  const fabEdge: ViewStyle = {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: t.colors.primaryEdge,
  };
  const fabCircle: ViewStyle = {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: t.colors.primary,
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
    fabY.set(withSpring(0, { damping: 13, stiffness: 340 }));
  }

  return (
    <Screen>
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ gap: t.space[5], paddingBottom: t.space[16] }}
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
            style={logChip}
          >
            <Ionicons name="time-outline" size={18} color={t.colors.primary} />
            <Text style={logChipText}>Finished something? Log it &amp; ripen your honey</Text>
          </Pressable>
        </ScrollView>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
            <Ionicons name="add" size={30} color={t.colors.onIndigo} />
          </Animated.View>
        </Pressable>
      </View>
    </Screen>
  );
}
