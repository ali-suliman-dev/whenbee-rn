import { resources, SUPPORTED_LANGS } from '../resources';
import { REVIEW_REFLECTION_QUESTION_COUNT } from '@/src/engine';

// ──────────────────────────────────────────────────────────────────────────────
// The review recap is the one place where the pure engine picks a sentence it
// cannot write: it emits a verdict id and a reflection-question INDEX, and the
// bundle supplies the words. Those two contracts can drift silently (a language
// dropping a question renders `undefined`; a new verdict id renders a raw key),
// so they are asserted here rather than discovered on a Swedish device.
// ──────────────────────────────────────────────────────────────────────────────

const VERDICT_IDS = ['tight', 'loose', 'mixed'] as const;

const reviewNs = (lang: string) =>
  (resources[lang as keyof typeof resources] as Record<string, Record<string, unknown>>)
    .review as Record<string, Record<string, unknown>>;

describe('review bundle matches the engine contract', () => {
  it.each(SUPPORTED_LANGS)('%s carries every reflection question', (lang) => {
    const questions = reviewNs(lang).reflection?.questions;
    expect(Array.isArray(questions)).toBe(true);
    expect(questions as string[]).toHaveLength(REVIEW_REFLECTION_QUESTION_COUNT);
    for (const q of questions as string[]) expect(q.length).toBeGreaterThan(0);
  });

  it.each(SUPPORTED_LANGS)('%s words every week-read verdict id', (lang) => {
    const verdict = reviewNs(lang).weekRead?.verdict as Record<string, string> | undefined;
    expect(verdict).toBeDefined();
    for (const id of VERDICT_IDS) expect(verdict?.[id]?.length ?? 0).toBeGreaterThan(0);
  });

  it.each(SUPPORTED_LANGS)('%s words both data-specific reflections', (lang) => {
    const reflection = reviewNs(lang).reflection as Record<string, string>;
    for (const key of ['tightened', 'surprise']) {
      expect(reflection[key]).toContain('{{category}}');
    }
  });
});
