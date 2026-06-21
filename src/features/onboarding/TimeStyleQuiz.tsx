import { useState } from 'react';
import { Pressable, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Chip } from '@/src/components/Chip';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import type { QuizAnswers } from '@/src/engine';
import { ArchetypeQuizGlyph, type QuizGlyphKind } from './ArchetypeQuizGlyph';

// ──────────────────────────────────────────────────────────────────────────────
// TimeStyleQuiz — 2–3 question illustrated chip flow.
//
// Used in onboarding AND the re-open modal. Runs pace → mid → focus in order;
// each chip tap records the answer and auto-advances. "See my type" is enabled
// as soon as `pace` is answered; the user can stop there (mid + focus are
// optional enrichment). "Skip" calls onSkip without building answers.
//
// Chip stagger: FadeInDown entering-only — no exiting animations (Fabric
// exiting = SIGABRT). Reduced-motion guard: entering is set to undefined.
// ──────────────────────────────────────────────────────────────────────────────

interface QuizOption {
  value: string;
  label: string;
  glyph: QuizGlyphKind;
}

interface Question {
  key: keyof QuizAnswers;
  prompt: string;
  options: readonly QuizOption[];
}

const QUESTIONS: readonly Question[] = [
  {
    key: 'pace',
    prompt: 'When you plan your day, things usually take…',
    options: [
      { value: 'about', label: 'About right', glyph: 'pace_about' },
      { value: 'bit', label: 'A bit longer', glyph: 'pace_bit' },
      { value: 'lot', label: 'A lot longer', glyph: 'pace_lot' },
      { value: 'lose', label: 'I lose track', glyph: 'pace_lose' },
    ],
  },
  {
    key: 'mid',
    prompt: 'Mid-task, you usually…',
    options: [
      { value: 'track', label: 'Stay on track', glyph: 'mid_track' },
      { value: 'rabbit', label: 'Fall down rabbit holes', glyph: 'mid_rabbit' },
    ],
  },
  {
    key: 'focus',
    prompt: 'You focus best…',
    options: [
      { value: 'morning', label: 'Mornings', glyph: 'focus_morning' },
      { value: 'evening', label: 'Evenings', glyph: 'focus_evening' },
      { value: 'varies', label: 'It varies', glyph: 'focus_varies' },
    ],
  },
] as const;

// Per-chip stagger delay matches the onboarding enterStagger budget (t.motion.enterStagger).
// The cascade stays within ~500ms for liveliness.

export function TimeStyleQuiz({
  onComplete,
  onSkip,
}: {
  onComplete: (a: QuizAnswers) => void;
  onSkip: () => void;
}): React.JSX.Element | null {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  // Collected answers — only pace is required; mid + focus are optional.
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({});
  // Which question index is currently shown (0-based).
  const [step, setStep] = useState(0);

  const currentQuestion = QUESTIONS[step];

  function choose(key: keyof QuizAnswers, value: string) {
    const next = { ...answers, [key]: value } as Partial<QuizAnswers>;
    setAnswers(next);

    // Auto-advance to the next question, if there is one.
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    }
  }

  function finish() {
    if (!answers.pace) return; // gate: pace is required
    // Build a well-typed QuizAnswers — pace is required, mid + focus are optional.
    const result: QuizAnswers = {
      pace: answers.pace,
      ...(answers.mid !== undefined ? { mid: answers.mid } : {}),
      ...(answers.focus !== undefined ? { focus: answers.focus } : {}),
    };
    onComplete(result);
  }

  const hasPace = answers.pace !== undefined;

  // ── Styles (all tokens, no hardcoded values) ──────────────────────────────
  const wrap: ViewStyle = {
    gap: t.space[6],
  };

  const promptStyle: TextStyle = {
    fontSize: t.fontSize.bodySm,
    fontWeight: t.fontWeight.medium as TextStyle['fontWeight'],
    color: t.colors.ink,
    lineHeight: t.fontSize.bodySm * t.lineHeight.normal,
  };

  const chipRow: ViewStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.space[2],
  };

  const actionsRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const ctaStyle: TextStyle = {
    fontSize: t.fontSize.base,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: hasPace ? t.colors.primary : t.colors.inkFaint,
  };

  const skipStyle: TextStyle = {
    fontSize: t.fontSize.sm,
    color: t.colors.inkSoft,
  };

  if (!currentQuestion) return null;

  return (
    <View style={wrap}>
      {/* Question prompt */}
      <AppText style={promptStyle}>{currentQuestion.prompt}</AppText>

      {/* Chip row — staggered FadeInDown entering-only */}
      <View style={chipRow}>
        {currentQuestion.options.map((opt, i) => {
          const answerForKey = answers[currentQuestion.key];
          const isSelected = answerForKey === opt.value;
          return (
            <Animated.View
              key={`${currentQuestion.key}-${opt.value}`}
              entering={
                reducedMotion
                  ? undefined
                  : FadeInDown.duration(t.motion.base)
                      .delay(i * t.motion.enterStagger)
                      .springify()
                      .damping(t.motion.spring.damping)
                      .stiffness(t.motion.spring.stiffness)
              }
            >
              <Chip
                label={opt.label}
                icon={
                  <ArchetypeQuizGlyph
                    kind={opt.glyph}
                    active={isSelected}
                  />
                }
                selected={isSelected}
                onPress={() => choose(currentQuestion.key, opt.value)}
              />
            </Animated.View>
          );
        })}
      </View>

      {/* Action row: "See my type" CTA + Skip */}
      <View style={actionsRow}>
        <Pressable
          onPress={finish}
          disabled={!hasPace}
          accessibilityRole="button"
          accessibilityState={{ disabled: !hasPace }}
          hitSlop={t.size.hitSlop}
        >
          <AppText style={ctaStyle}>See my type</AppText>
        </Pressable>

        <Pressable
          onPress={onSkip}
          accessibilityRole="button"
          hitSlop={t.size.hitSlop}
        >
          <AppText style={skipStyle}>Skip</AppText>
        </Pressable>
      </View>
    </View>
  );
}
