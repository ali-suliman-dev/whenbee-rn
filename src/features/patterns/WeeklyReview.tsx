import { useState } from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { kv } from '@/src/lib/kv';
import type { PatternsView } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// WeeklyReview (S8) — a calm, once-a-week digest at the top of Patterns. Four
// gentle lines composed from data the tab already has: an accuracy-trend read, the
// week's biggest surprise, an archetype nudge, and one reflective question. No
// scores, no streaks, no guilt — looser weeks are framed as "just data". Dismissible
// for the current ISO week (re-arms next week). Hidden until there are ≥2 real lines.
// ──────────────────────────────────────────────────────────────────────────────

const DISMISS_KEY = 'whenbee.weeklyReviewDismissedWeek';

const QUESTIONS = [
  'Which task surprised you most this week?',
  'What is one thing worth a little more time next week?',
  'When did you feel most on-pace?',
  'Which area is quietly getting sharper?',
] as const;

/** Stable {year}-W{week} id so the digest shows once per ISO-ish week. */
function weekId(now: Date): string {
  const start = new Date(now.getFullYear(), 0, 1);
  const week = Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${now.getFullYear()}-W${week}`;
}

function trendLine(view: PatternsView): string | null {
  const yp = view.youVsPast;
  if (!yp) return null;
  if (yp.delta > 2) return 'Your estimates got a little sharper.';
  if (yp.delta < -2) return 'Estimates ran a bit looser — that is just data, not a verdict.';
  return 'Steady week — your reads held.';
}

export function WeeklyReview({ view, nowMs = Date.now() }: { view: PatternsView; nowMs?: number }) {
  const t = useTheme();
  const thisWeek = weekId(new Date(nowMs));
  const [dismissed, setDismissed] = useState(() => kv.getString(DISMISS_KEY) === thisWeek);

  const lines: string[] = [];
  const trend = trendLine(view);
  if (trend) lines.push(trend);
  if (view.biggestSurprise) {
    const s = view.biggestSurprise;
    lines.push(`Biggest surprise: ${s.categoryName}, about ${s.ratio.toFixed(1)}× your guess.`);
  }
  if (view.archetype) lines.push(`You are still ${view.archetype.title}.`);

  // Not enough to call it a review yet — stay quiet.
  if (dismissed || lines.length < 2) return null;

  const question = QUESTIONS[Math.abs(hashWeek(thisWeek)) % QUESTIONS.length] ?? QUESTIONS[0];

  function dismiss() {
    kv.set(DISMISS_KEY, thisWeek);
    setDismissed(true);
  }

  const header: ViewStyle = { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' };
  const eyebrowRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.primary };
  const line: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.ink };
  const question_: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft, fontStyle: 'italic' };

  return (
    <Card style={{ gap: t.space[3] }}>
      <View style={header}>
        <View style={eyebrowRow}>
          <Ionicons name="leaf-outline" size={t.iconSize.sm} color={t.colors.primary} />
          <Text style={eyebrow}>YOUR WEEK</Text>
        </View>
        <Pressable onPress={dismiss} accessibilityRole="button" accessibilityLabel="Dismiss this week's review" hitSlop={8}>
          <Ionicons name="close" size={t.iconSize.sm} color={t.colors.inkSoft} />
        </Pressable>
      </View>
      <View style={{ gap: t.space[1.5] }}>
        {lines.map((l) => (
          <Text key={l} style={line}>
            {l}
          </Text>
        ))}
      </View>
      <Text style={question_}>{question}</Text>
    </Card>
  );
}

/** Tiny stable hash of the week id → rotates the question deterministically. */
function hashWeek(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h;
}
