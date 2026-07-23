import { AppText } from '@/src/components/AppText';
import { analytics } from '@/src/services/analytics';
import { haptics } from '@/src/lib/haptics';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { type } from '@/src/theme/typography';
import { useTheme } from '@/src/theme/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { EnergyGlyph, type EnergyKind } from './EnergyGlyph';
import { ReasonGlyph, type ReasonGlyphKind } from './ReasonGlyph';
import type { RunDirection } from './useReward';

// ──────────────────────────────────────────────────────────────────────────────
// ContextQuestions — the reward screen's post-log "quick questions", asked ONE
// at a time instead of two always-visible chip rows. Q1 (reason) only appears
// when the run diverged from the guess past useReward's gate; Q2 (energy)
// always follows. Both are pure side-channel taps — they never touch the
// multiplier, honey, or Reclaim — and both stay fully skippable.
//
// A tap plays a brief "landed" beat on the option (haptics + selected look),
// then the question collapses to a one-line receipt and the next question (if
// any) fades in. Skip collapses with NO receipt and advances immediately.
//
// Analytics funnel (preserved exactly from the old ReasonChips/EnergyChips):
// `overrun_reason_shown` fires once when Q1 appears; `overrun_reason_tagged` on
// a pick; `overrun_reason_skipped` on an explicit Skip OR on leaving without
// tagging — never both. Energy only ever fires `context_tagged` on a pick.
// ──────────────────────────────────────────────────────────────────────────────

interface ReasonOption {
  value: string;
  label: string;
  hint: string;
  glyph: ReasonGlyphKind;
}
interface EnergyOption {
  value: EnergyKind;
  label: string;
  hint: string;
}
type QuestionKey = 'reason' | 'energy';
interface ReasonQuestion {
  key: 'reason';
  header: string;
  options: readonly ReasonOption[];
}
interface EnergyQuestion {
  key: 'energy';
  header: string;
  options: readonly EnergyOption[];
}
type Question = ReasonQuestion | EnergyQuestion;

const OVER_HEADER = 'Where did the time go?';
const UNDER_HEADER = 'What made it quick?';
const ENERGY_HEADER = 'How was your energy?';

// Neutral, kind framings — curiosity, never blame. Over-run owns the "took
// longer" reasons; under-run the "went faster" ones.
const OVER_OPTIONS: readonly ReasonOption[] = [
  { value: 'interrupted', label: 'Paused', hint: 'stopped mid-run', glyph: 'interrupted' },
  { value: 'underestimated', label: 'Grew', hint: 'bigger than it looked', glyph: 'bigger' },
  { value: 'context_switch', label: 'Pulled', hint: 'something took you away', glyph: 'pulled' },
];
const UNDER_OPTIONS: readonly ReasonOption[] = [
  { value: 'focused', label: 'Flow', hint: 'locked in', glyph: 'zone' },
  { value: 'overestimated', label: 'Fast', hint: 'smaller than it looked', glyph: 'smaller' },
];
const ENERGY_OPTIONS: readonly EnergyOption[] = [
  { value: 'low', label: 'Low', hint: 'running on fumes' },
  { value: 'ok', label: 'OK', hint: 'normal day' },
  { value: 'high', label: 'High', hint: 'fully charged' },
];

// Receipt copy — a warm, honest close after a tap. The option's own word lands
// bolded mid-sentence (matching the brief's exact strings).
const REASON_RECEIPTS: Record<string, { prefix: string; bold: string; suffix: string }> = {
  interrupted: { prefix: '', bold: 'Paused', suffix: ' along the way. Good to know.' },
  underestimated: { prefix: 'It ', bold: 'grew', suffix: ' on you. Good to know.' },
  context_switch: { prefix: 'Something ', bold: 'pulled', suffix: ' you away. Good to know.' },
  focused: { prefix: 'You found ', bold: 'flow', suffix: '. Good to know.' },
  overestimated: { prefix: '', bold: 'Quicker', suffix: ' than you thought. Good to know.' },
};

// Option rows fade in staggered by this much (opacity only, per the motion HARD RULE).
const OPTION_STAGGER = 50;

export function ContextQuestions({
  eventId,
  category,
  reasonDirection,
}: {
  eventId: string;
  category: string;
  reasonDirection: RunDirection | null;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const setReason = useCalibrationStore((s) => s.setReason);
  const setContext = useCalibrationStore((s) => s.setContext);

  const questions = useMemo<Question[]>(() => {
    const list: Question[] = [];
    if (reasonDirection) {
      list.push({
        key: 'reason',
        header: reasonDirection === 'over' ? OVER_HEADER : UNDER_HEADER,
        options: reasonDirection === 'over' ? OVER_OPTIONS : UNDER_OPTIONS,
      });
    }
    list.push({ key: 'energy', header: ENERGY_HEADER, options: ENERGY_OPTIONS });
    return list;
  }, [reasonDirection]);

  const [stepIndex, setStepIndex] = useState(0);
  const [receipts, setReceipts] = useState<{ key: QuestionKey; value: string | null }[]>([]);
  // The value mid-"landed" beat, before the question collapses to a receipt.
  const [pendingValue, setPendingValue] = useState<string | null>(null);

  const beatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (beatTimeoutRef.current) clearTimeout(beatTimeoutRef.current);
    };
  }, []);

  // Q1 funnel: shown once on appear; skipped on unmount-without-tag OR explicit
  // skip — never both. `settledRef` is set by either a tag or a skip.
  const reasonSettledRef = useRef(false);
  useEffect(() => {
    if (!reasonDirection) return;
    analytics.capture('overrun_reason_shown', { category, direction: reasonDirection });
    return () => {
      if (!reasonSettledRef.current) {
        reasonSettledRef.current = true;
        analytics.capture('overrun_reason_skipped', { category, direction: reasonDirection });
      }
    };
  }, [reasonDirection, category]);

  function completeQuestion(key: QuestionKey, value: string | null) {
    setReceipts((prev) => [...prev, { key, value }]);
    setStepIndex((i) => i + 1);
    setPendingValue(null);
  }

  function handleSelect(question: Question, value: string) {
    haptics.selection();
    setPendingValue(value);
    if (question.key === 'reason') {
      reasonSettledRef.current = true;
      void setReason(eventId, value, 'manual');
      analytics.capture('overrun_reason_tagged', {
        category,
        direction: reasonDirection as RunDirection,
        reason: value,
        source: 'manual',
      });
    } else {
      void setContext(eventId, 'energy', value, 'manual');
      analytics.capture('context_tagged', { key: 'energy', value });
    }
    const delay = reducedMotion ? 0 : t.motion.reveal;
    beatTimeoutRef.current = setTimeout(() => completeQuestion(question.key, value), delay);
  }

  function handleSkip(question: Question) {
    if (question.key === 'reason' && !reasonSettledRef.current) {
      reasonSettledRef.current = true;
      analytics.capture('overrun_reason_skipped', {
        category,
        direction: reasonDirection as RunDirection,
      });
    }
    completeQuestion(question.key, null);
  }

  const activeQuestion: Question | undefined = questions[stepIndex];
  // Nothing left to show once every question has been settled AND every
  // settlement was a skip (a skip's Receipt renders null — see below). A
  // tagged answer always leaves a visible receipt, so the card chrome only
  // needs to disappear in the all-skipped case. Owning the card surface here
  // (instead of the parent always wrapping one) is what lets it unmount
  // cleanly — a plain unmount, no exit animation.
  const hasContent = activeQuestion !== undefined || receipts.some((r) => r.value !== null);
  if (!hasContent) return null;

  // The payoff card groups these questions into one surface — owned here so
  // the whole card (chrome included) disappears once there is nothing left to
  // show, instead of leaving an empty rounded box behind (see `hasContent`).
  const card: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.card,
    padding: t.space[4],
    gap: t.space[3],
  };
  const wrap: ViewStyle = { gap: t.space[3] };
  const headerRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };
  // ~15.5px-equivalent bold — the closest role in the type scale (bodyLg = 16).
  const headerText: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const skipText: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint };
  const optionsWrap: ViewStyle = { gap: t.space[2] };
  const counterText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkFaint,
    textAlign: 'center',
  };

  return (
    <View style={card}>
      {receipts.map((r, i) => (
        <Receipt key={i} questionKey={r.key} value={r.value} />
      ))}
      {activeQuestion ? (
        <Animated.View
          key={activeQuestion.key}
          style={wrap}
          entering={reducedMotion ? undefined : FadeIn.duration(t.motion.base)}
        >
          <View style={headerRow}>
            <Text style={headerText}>{activeQuestion.header}</Text>
            {pendingValue === null ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Skip"
                hitSlop={t.size.hitSlop}
                onPress={() => handleSkip(activeQuestion)}
              >
                <Text style={skipText}>Skip</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={optionsWrap}>
            {activeQuestion.key === 'reason'
              ? activeQuestion.options.map((opt, i) => (
                  <Animated.View
                    key={opt.value}
                    entering={
                      reducedMotion ? undefined : FadeIn.duration(t.motion.base).delay(i * OPTION_STAGGER)
                    }
                  >
                    <OptionRow
                      label={opt.label}
                      hint={opt.hint}
                      selected={pendingValue === opt.value}
                      disabled={pendingValue !== null}
                      glyph={<ReasonGlyph kind={opt.glyph} active={pendingValue === opt.value} />}
                      onPress={() => handleSelect(activeQuestion, opt.value)}
                    />
                  </Animated.View>
                ))
              : activeQuestion.options.map((opt, i) => (
                  <Animated.View
                    key={opt.value}
                    entering={
                      reducedMotion ? undefined : FadeIn.duration(t.motion.base).delay(i * OPTION_STAGGER)
                    }
                  >
                    <OptionRow
                      label={opt.label}
                      hint={opt.hint}
                      selected={pendingValue === opt.value}
                      disabled={pendingValue !== null}
                      glyph={<EnergyGlyph kind={opt.value} active={pendingValue === opt.value} />}
                      onPress={() => handleSelect(activeQuestion, opt.value)}
                    />
                  </Animated.View>
                ))}
          </View>
          {questions.length > 1 ? (
            <Text style={counterText}>{`${stepIndex + 1} of ${questions.length} · one tap, or skip`}</Text>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

function OptionRow({
  glyph,
  label,
  hint,
  selected,
  disabled,
  onPress,
}: {
  glyph: ReactNode;
  label: string;
  hint: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const t = useTheme();

  const container: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: t.size.control.md,
    borderRadius: t.radii.md,
    paddingHorizontal: t.space[3],
    gap: t.space[3],
    backgroundColor: selected ? t.colors.primaryWash : t.colors.surfaceSunken,
    borderWidth: selected ? t.borderWidth.selected : 0,
    borderColor: t.colors.primary,
  };
  const dish: ViewStyle = {
    width: t.size.glyphDish,
    height: t.size.glyphDish,
    borderRadius: t.radii.sm,
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.chip,
    borderColor: t.colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const textCol: ViewStyle = { flex: 1, gap: t.space[0.5] };
  const labelText: TextStyle = {
    ...(type.bodySmSemibold as unknown as TextStyle),
    color: t.colors.ink,
  };
  const hintText: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint };
  const radioOuter: ViewStyle = {
    width: t.size.optionRadio.dot,
    height: t.size.optionRadio.dot,
    borderRadius: t.radii.full,
    borderWidth: t.size.optionRadio.ring,
    borderColor: selected ? t.colors.primary : t.colors.radio,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };
  const radioCore: ViewStyle = {
    width: t.size.optionRadio.core,
    height: t.size.optionRadio.core,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.primary,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
    >
      <View style={container}>
        <View style={dish}>{glyph}</View>
        <View style={textCol}>
          <Text style={labelText}>{label}</Text>
        </View>
        <Text style={hintText}>{hint}</Text>
        <View style={radioOuter}>{selected ? <View style={radioCore} /> : null}</View>
      </View>
    </Pressable>
  );
}

function energyReceiptParts(value: string): { prefix: string; bold: string; suffix: string } {
  const label = ENERGY_OPTIONS.find((o) => o.value === value)?.label ?? '';
  return { prefix: 'Energy: ', bold: label, suffix: '. Noted.' };
}

function Receipt({ questionKey, value }: { questionKey: QuestionKey; value: string | null }) {
  const t = useTheme();
  if (value === null) return null;

  const parts = questionKey === 'reason' ? REASON_RECEIPTS[value] : energyReceiptParts(value);
  if (!parts) return null;

  const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const coin: ViewStyle = {
    width: t.size.checkCoin,
    height: t.size.checkCoin,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };
  const text: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft, flex: 1 };
  const boldText: TextStyle = { ...(type.captionBold as unknown as TextStyle), color: t.colors.ink };

  return (
    <View style={row}>
      <View style={coin}>
        <Ionicons name="checkmark" size={t.iconSize.xs} color={t.colors.surface} />
      </View>
      <AppText style={text}>
        {parts.prefix}
        <Text style={boldText}>{parts.bold}</Text>
        {parts.suffix}
      </AppText>
    </View>
  );
}
