import { useEffect, useRef } from 'react';
import { ScrollView, View, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/useTheme';
import { tokens } from '@/src/theme/tokens';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { Card } from '@/src/components/Card';
import { formatClock } from '@/src/lib/time';
import { analytics } from '@/src/services/analytics';
import { useRoutines, type RoutineCardModel } from './useRoutines';
import { EXAMPLE_ROUTINE } from './exampleRoutine';

// ──────────────────────────────────────────────────────────────────────────────
// RoutinesList — the Pro Routines surface: saved routine cards + empty state +
// a New routine affordance. Each card shares one vertical structure (name, honest
// total + basis, optional start-by, a step-count chip) so siblings align. Cards
// fade in (entering-only — Fabric SIGABRT on exiting). No-guilt, amber-free here;
// the honest total is amber-neutral ink with a quiet basis caption.
// ──────────────────────────────────────────────────────────────────────────────

const CARD_ENTER = FadeIn.duration(tokens.motion.base).reduceMotion(ReduceMotion.System);

/** Minute-of-day → a clock string via the app formatter (12/24h honoured). */
function clockFor(minuteOfDay: number): string {
  const d = new Date();
  d.setHours(Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0);
  return formatClock(d.getTime());
}

function StepChip({ count }: { count: number }) {
  const t = useTheme();
  const chip: ViewStyle = {
    backgroundColor: t.colors.surfaceSunken,
    borderRadius: t.radii.sm,
    paddingHorizontal: t.space[2],
    paddingVertical: t.space[0.5],
  };
  const text: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.colors.inkSoft };
  return (
    <View style={chip}>
      <AppText style={text}>{count === 1 ? '1 step' : `${count} steps`}</AppText>
    </View>
  );
}

function RoutineCard({ model, onOpen }: { model: RoutineCardModel; onOpen: (id: string) => void }) {
  const t = useTheme();
  const headRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.space[2] };
  const name: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink, flex: 1 };
  const totalRow: ViewStyle = { flexDirection: 'row', alignItems: 'baseline', gap: t.space[2], flexWrap: 'wrap' };
  const total: TextStyle = { ...(type.honestNumberMd as unknown as TextStyle), color: t.colors.ink };
  const basis: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const startByRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1] };

  return (
    <Animated.View entering={CARD_ENTER}>
      <Pressable
        onPress={() => onOpen(model.routineId)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${model.name}`}
      >
        <Card style={{ gap: t.space[1.5] }}>
          <View style={headRow}>
            <AppText style={name} numberOfLines={1}>
              {model.name}
            </AppText>
            <StepChip count={model.stepCount} />
          </View>
          <View style={totalRow}>
            <AppText style={total}>{model.summary.honestTotalMin} min</AppText>
            <AppText style={basis}>{model.summary.label}</AppText>
          </View>
          {model.doneByMinuteOfDay !== null ? (
            <View style={startByRow}>
              <Ionicons name="time-outline" size={t.iconSize.sm} color={t.colors.inkSoft} />
              <AppText style={basis}>Start by {clockFor(model.doneByMinuteOfDay)}</AppText>
            </View>
          ) : null}
        </Card>
      </Pressable>
    </Animated.View>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// ExampleCard — the pre-built "Morning routine" shown when the list is empty.
// "Try it" fires onTryExample without writing anything to the DB. No-guilt copy.
// ──────────────────────────────────────────────────────────────────────────────

function ExampleCard({ onTryExample }: { onTryExample: () => void }) {
  const t = useTheme();
  const card: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.card,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous' as ViewStyle['borderCurve'],
    padding: t.space[3],
    gap: t.space[2],
  };
  const nameStyle: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const metaStyle: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const stepCount = EXAMPLE_ROUTINE.steps.length;

  return (
    <Animated.View entering={CARD_ENTER}>
      <View style={card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.space[2] }}>
          <AppText style={nameStyle} numberOfLines={1}>
            {EXAMPLE_ROUTINE.name}
          </AppText>
          <StepChip count={stepCount} />
        </View>
        <AppText style={metaStyle}>
          {EXAMPLE_ROUTINE.steps.map((s) => s.label).join(' · ')}
        </AppText>
        <AppButton
          label="Try it"
          variant="secondary"
          fullWidth
          onPress={onTryExample}
          accessibilityLabel={`Try the ${EXAMPLE_ROUTINE.name} example`}
        />
      </View>
    </Animated.View>
  );
}

export function RoutinesList({
  isPro,
  onNew,
  onOpen,
  onTryExample,
  nowMs,
}: {
  isPro: boolean;
  onNew: () => void;
  onOpen: (id: string) => void;
  /** Called when the user taps "Try it" on the example card. The parent loads the
   *  example into the draft (resetDraft → setName → addStep × n) and navigates to
   *  BuildView. Nothing is persisted until the user explicitly saves. */
  onTryExample: () => void;
  nowMs?: number;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { summaries } = useRoutines(nowMs !== undefined ? { nowMs } : {});

  // Fire the segment-mount impression once, with the resolved routine count.
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    analytics.capture('routines_tab_viewed', { is_pro: isPro, routine_count: summaries.length });
  }, [isPro, summaries.length]);

  const introText: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };

  return (
    <ScrollView
      contentContainerStyle={{ gap: t.space[4], paddingTop: t.space[4], paddingBottom: insets.bottom + t.space[6] }}
      showsVerticalScrollIndicator={false}
    >
      {summaries.length === 0 ? (
        <>
          <AppText style={introText}>
            A guided sequence that runs on a timer — it tells you what to do now, then moves you on.
          </AppText>
          <ExampleCard onTryExample={onTryExample} />
        </>
      ) : (
        summaries.map((model) => <RoutineCard key={model.routineId} model={model} onOpen={onOpen} />)
      )}

      <AppButton
        label="New routine"
        variant="secondary"
        fullWidth
        onPress={onNew}
        icon={<Ionicons name="add" size={t.iconSize.sm} color={t.colors.ink} />}
      />
    </ScrollView>
  );
}
