import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, sep } from 'node:path';

// ──────────────────────────────────────────────────────────────────────────────
// copyProps — the other half of the i18n guardrail.
//
// `i18next/no-literal-string` runs in `jsx-text-only` mode, which sees only text
// BETWEEN tags. It is blind to copy passed as a JSX ATTRIBUTE:
//
//   <AppButton label="Save & start" />          ← ships untranslated
//   <Pressable accessibilityLabel="Dismiss" />  ← screen-reader copy, untranslated
//   <TextInput placeholder="Name it…" />        ← untranslated
//
// The plugin's `jsx-only` mode would cover these, but it also flags the KEY
// string inside every `t('some.key')` call, which makes it unusable. So this
// test enforces the attribute half directly: any of the copy-bearing props below
// holding a bare string literal that looks like a sentence is a failure.
//
// If this fails, the fix is to move the string into a locale file — not to widen
// the ignore list. Add to IGNORED_VALUES only for a provable non-copy value.
// ──────────────────────────────────────────────────────────────────────────────

const SRC = join(__dirname, '..', '..');

/** Props whose value a user reads or hears. */
const COPY_PROPS = [
  'accessibilityLabel',
  'accessibilityHint',
  'placeholder',
  'label',
  'title',
  'subtitle',
  'message',
  'note',
  'heading',
  'caption',
  'cta',
  'confirmLabel',
  'cancelLabel',
  'valueText',
  'leavingLabel',
  'startingLabel',
] as const;

/**
 * Values that are legitimately bare strings: the untranslated brand name, and
 * short enum-ish tokens that happen to sit in a copy-named prop.
 */
const IGNORED_VALUES = new Set(['Whenbee', 'Pro', 'Whenbee Pro']);

const propPattern = new RegExp(`\\b(${COPY_PROPS.join('|')})=(["'])([^"']*)\\2`, 'g');

function listSourceFiles(): string[] {
  let files: string[];
  try {
    const out = execFileSync('git', ['ls-files', 'src/**/*.ts', 'src/**/*.tsx'], {
      cwd: join(SRC, '..'),
      encoding: 'utf8',
    });
    files = out
      .split('\n')
      .filter(Boolean)
      .map((p) => join(SRC, '..', p));
  } catch {
    files = walk(SRC);
  }
  return files.filter((f) => {
    const norm = f.split(sep).join('/');
    if (/\.(test|spec)\.tsx?$/.test(norm)) return false;
    if (norm.includes('/__tests__/')) return false;
    return existsSync(f);
  });
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return /\.tsx?$/.test(e.name) ? [full] : [];
  });
}

/** Prose = starts with a capital or contains a space. Rules out enum-ish values
 *  ("primary", "sm") that legitimately land in a loosely-named prop. */
function looksLikeCopy(value: string): boolean {
  if (value.length < 2) return false;
  if (IGNORED_VALUES.has(value)) return false;
  return /^[A-Z]/.test(value) || value.includes(' ');
}

describe('copy props', () => {
  it('passes no hardcoded user-facing string to a copy-bearing JSX prop', () => {
    const hits: string[] = [];
    for (const file of listSourceFiles()) {
      const source = readFileSync(file, 'utf8');
      source.split('\n').forEach((line, i) => {
        const trimmed = line.trimStart();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
        for (const m of line.matchAll(propPattern)) {
          const [, prop, , value] = m as unknown as [string, string, string, string];
          if (!looksLikeCopy(value)) continue;
          hits.push(`${file.split('/Whenbee/')[1]}:${i + 1} — ${prop}="${value}"`);
        }
      });
    }
    expect(hits).toEqual([]);
  });

  // The lint rule reads JSX TEXT and the check above reads JSX ATTRIBUTES.
  // Neither sees a string literal inside a JSX EXPRESSION:
  //
  //   <Text>{isMonth ? 'YOUR HONEST MONTH' : 'YOUR HONEST WEEK'}</Text>
  //
  // which is how a hardcoded eyebrow survived a full extraction pass. A ternary
  // picking between two sentences is copy; make it a key with a variant instead.
  it('renders no hardcoded user-facing string from a JSX ternary', () => {
    // `{ … ? '…' : '…' }` where at least one branch reads like a sentence.
    const ternary = /\{[^{}]*\?[^{}]*?(['"])([^'"]{2,})\1[^{}]*:[^{}]*?(['"])([^'"]{2,})\3[^{}]*\}/g;
    const hits: string[] = [];
    for (const file of listSourceFiles()) {
      if (!file.endsWith('.tsx')) continue;
      const source = readFileSync(file, 'utf8');
      source.split('\n').forEach((line, i) => {
        const trimmed = line.trimStart();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
        for (const m of line.matchAll(ternary)) {
          const [, , left, , right] = m as unknown as [string, string, string, string, string];
          if (!looksLikeCopy(left) && !looksLikeCopy(right)) continue;
          hits.push(`${file.split('/Whenbee/')[1]}:${i + 1} — '${left}' / '${right}'`);
        }
      });
    }
    expect(hits).toEqual([]);
  });
});
