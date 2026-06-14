import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

// ──────────────────────────────────────────────────────────────────────────────
// copyAudit — a durable guardrail for Whenbee's "no guilt, ever" product invariant.
//
// It scans every source file under src/ for two classes of regression:
//
//   1. Banned guilt/shame mechanics in USER-FACING copy (streaks, "missed",
//      "days in a row", shame words aimed at the user, etc.).
//   2. RED-as-state: a `danger`/`error` colour token used OUTSIDE genuine
//      system-error messaging (amber-never-red invariant). `danger` is allowed
//      only on an explicit allow-list of real error sites (e.g. a failed purchase
//      or restore on the paywall).
//
// What it scans / skips (kept deliberately simple so it stays reliable, not flaky):
//   • Files:  src/**/*.ts and src/**/*.tsx, EXCLUDING any `.test.`/`.spec.` file
//             and anything under a `__tests__` directory (this file included).
//   • Lines:  whole-line `//` comments and block-comment continuation lines
//             (` * …`) are skipped; an inline `// …` trailer is stripped before
//             matching, so prose in comments never triggers a failure.
//   • Reframing is allowed:  a banned mechanic preceded by a negation within a
//             short window ("no streak to break", "you're not lazy") is the
//             invariant being *stated*, not violated — it passes.
//
// If this test fails, the fix is the COPY, not the test. Only loosen a matcher
// when it is a provable false positive.
// ──────────────────────────────────────────────────────────────────────────────

const SRC = join(__dirname, '..', '..');

function listSourceFiles(): string[] {
  // Prefer git (fast, respects .gitignore); fall back to a recursive walk so the
  // test still runs outside a checkout.
  let files: string[];
  try {
    // No shell, static args — no injection surface (also satisfies execFile guidance).
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
    return true;
  });
}

function walk(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    if (/\.tsx?$/.test(e.name)) return [full];
    return [];
  });
}

/** Strip whole-line and trailing comments so prose in comments never matches. */
function codeLines(source: string): { line: string; n: number }[] {
  return source.split('\n').map((raw, i) => {
    const trimmed = raw.trimStart();
    // Whole-line `//` comment or a block-comment body/continuation line.
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      return { line: '', n: i + 1 };
    }
    // Strip an inline `// …` trailer (good enough: our strings never contain `//`).
    const inline = raw.indexOf('//');
    return { line: inline >= 0 ? raw.slice(0, inline) : raw, n: i + 1 };
  });
}

interface Rule {
  name: string;
  /** Matches the banned token. Use a capture-free global regex. */
  pattern: RegExp;
  /**
   * If true, a negation ("no", "not", "never", "without", "n't") within
   * NEGATION_WINDOW chars before the hit is treated as the invariant being
   * stated, not violated — the line passes.
   */
  allowNegated?: boolean;
}

const NEGATION_WINDOW = 40;
const NEGATION = /\b(no|not|never|without|n't|nor)\b[^.?!]*$/i;

const BANNED: Rule[] = [
  { name: 'streak mechanic', pattern: /\bstreaks?\b/i, allowNegated: true },
  { name: '"missed" (guilt)', pattern: /\bmissed\b/i, allowNegated: true },
  { name: '"don\'t lose" (loss framing)', pattern: /\bdon'?t lose\b/i },
  { name: '"days in a row" (streak)', pattern: /\bdays in a row\b/i, allowNegated: true },
  { name: '"saved you" (unqualified overclaim)', pattern: /\bsaved you\b/i },
  { name: '"keep going" (guilt trap)', pattern: /\bkeep going\b/i, allowNegated: true },
  { name: 'shame word "lazy"', pattern: /\blazy\b/i, allowNegated: true },
  { name: 'shame word "failure"', pattern: /\bfailure\b/i, allowNegated: true },
  { name: '"you failed"', pattern: /\byou failed\b/i, allowNegated: true },
];

function negatedBefore(line: string, hitIndex: number): boolean {
  const before = line.slice(Math.max(0, hitIndex - NEGATION_WINDOW), hitIndex);
  return NEGATION.test(before);
}

describe('no-guilt copy audit', () => {
  const files = listSourceFiles();

  it('finds source files to scan', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('contains no banned guilt/shame mechanics in user-facing copy', () => {
    const hits: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const rel = relative(join(SRC, '..'), file).split(sep).join('/');
      for (const { line, n } of codeLines(source)) {
        if (!line) continue;
        for (const rule of BANNED) {
          const re = new RegExp(rule.pattern.source, 'gi');
          let m: RegExpExecArray | null;
          while ((m = re.exec(line)) !== null) {
            if (rule.allowNegated && negatedBefore(line, m.index)) continue;
            hits.push(`${rel}:${n} — ${rule.name}: …${line.trim().slice(0, 80)}…`);
          }
        }
      }
    }
    expect(hits).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// RED-as-state audit. `danger`/`error` colour tokens must only appear in genuine
// system-error messaging. Anything in a honey/reward/today/whenbee/patterns/
// honeycomb/timer surface fails. The allow-list is explicit so the test is
// precise, not broad.
// ──────────────────────────────────────────────────────────────────────────────

// Files where a `danger`/`error` colour token is legitimate — real system errors
// only (failed purchase / restore). Add a path here ONLY for genuine error UI.
const DANGER_ALLOW: readonly string[] = [
  'src/features/paywall/Paywall.tsx', // purchase/restore failure message
];

// Surfaces that must NEVER use a red/danger colour as a state (amber-never-red).
const PROTECTED_SURFACE =
  /\/(honey|honeycomb|reward|today|whenbee|patterns|timer)\b|honeycomb|ReclaimHero/i;

// The colour-token reference we forbid: `colors.danger` / `colors.error` (theme
// access). The token DEFINITION in tokens.ts (`danger:` / `error:`) is exempt.
const DANGER_TOKEN = /\bcolors\.(danger|error)\b/i;

describe('amber-never-red colour audit', () => {
  const files = listSourceFiles();

  it('uses no danger/error colour token outside allow-listed error sites', () => {
    const hits: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const rel = relative(join(SRC, '..'), file).split(sep).join('/');
      if (DANGER_ALLOW.includes(rel)) continue;
      for (const { line, n } of codeLines(source)) {
        if (!line) continue;
        const m = DANGER_TOKEN.exec(line);
        if (m) {
          hits.push(
            `${rel}:${n} — danger/error colour token used outside an allow-listed error site: ${line.trim().slice(0, 80)}`,
          );
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('keeps protected reward/honey/timer surfaces free of danger/error tokens even if allow-listed elsewhere', () => {
    const hits: string[] = [];
    for (const file of files) {
      const rel = relative(join(SRC, '..'), file).split(sep).join('/');
      if (!PROTECTED_SURFACE.test(rel)) continue;
      const source = readFileSync(file, 'utf8');
      for (const { line, n } of codeLines(source)) {
        if (!line) continue;
        if (DANGER_TOKEN.test(line)) {
          hits.push(
            `${rel}:${n} — danger/error colour token on a protected (amber-never-red) surface: ${line.trim().slice(0, 80)}`,
          );
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
