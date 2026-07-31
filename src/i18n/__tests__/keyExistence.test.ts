import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { resources, FALLBACK_LANG } from '../resources';

// ──────────────────────────────────────────────────────────────────────────────
// keyExistence — every translation key referenced in code must exist in the
// fallback bundle.
//
// The parity test compares en against sv, so a key that is missing from BOTH
// passes it — and i18next does not throw on a miss, it renders the key string.
// The result is a screen reading "ready.headline" that no test complains about.
// This closes that: source is the source of truth for which keys must exist.
//
// Only STATIC keys can be checked. A key built from a variable
// (`t(\`buckets.${id}\`)`) is skipped and counted — those are covered by the
// runtime fallbacks in their helpers.
// ──────────────────────────────────────────────────────────────────────────────

const SRC = join(__dirname, '..', '..');
const base = resources[FALLBACK_LANG] as Record<string, unknown>;

function listSourceFiles(): string[] {
  const out = execFileSync('git', ['ls-files', 'src/**/*.ts', 'src/**/*.tsx'], {
    cwd: join(SRC, '..'),
    encoding: 'utf8',
  });
  return out
    .split('\n')
    .filter(Boolean)
    .map((p) => join(SRC, '..', p))
    .filter((f) => {
      const norm = f.split(sep).join('/');
      if (/\.(test|spec)\.tsx?$/.test(norm)) return false;
      if (norm.includes('/__tests__/')) return false;
      return existsSync(f);
    });
}

/** Resolve `ns` + dotted key against the fallback bundle. */
function exists(ns: string, dotted: string): boolean {
  const nsRoot = base[ns];
  if (nsRoot === undefined) return false;
  const direct = dotted
    .split('.')
    .reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], nsRoot);
  // A string, or an array of strings read with `returnObjects` (day letters,
  // rotating headlines, sample steps).
  if (typeof direct === 'string') return true;
  if (Array.isArray(direct)) return true;
  // Plural keys live as `<key>_one` / `<key>_other`; the call site uses the base.
  const parts = dotted.split('.');
  const leaf = parts.pop() as string;
  const parent = parts.reduce<unknown>(
    (o, k) => (o as Record<string, unknown> | undefined)?.[k],
    nsRoot,
  ) as Record<string, unknown> | undefined;
  if (parent === undefined) return false;
  return Object.keys(parent).some((k) => k.startsWith(`${leaf}_`));
}

/** Which namespace each `t`-alias in a file is bound to. */
function aliasNamespaces(source: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of source.matchAll(
    /const \{\s*t:\s*(\w+)\s*\}\s*=\s*useTranslation\((?:'([^']+)')?\)/g,
  )) {
    map.set(m[1] as string, (m[2] as string | undefined) ?? 'common');
  }
  // `const { t } = useTranslation('ns')` — the alias is literally `t`.
  for (const m of source.matchAll(/const \{\s*t\s*\}\s*=\s*useTranslation\((?:'([^']+)')?\)/g)) {
    map.set('t', (m[1] as string | undefined) ?? 'common');
  }
  return map;
}

describe('translation key existence', () => {
  it('resolves every statically-written key against the fallback bundle', () => {
    const missing: string[] = [];
    let dynamic = 0;

    for (const file of listSourceFiles()) {
      const source = readFileSync(file, 'utf8');
      const rel = file.split('/Whenbee/')[1] ?? file;
      const aliases = aliasNamespaces(source);

      // 1. alias('some.key') — namespace comes from the alias binding.
      for (const m of source.matchAll(/\b(\w+)\(\s*'([\w.]+)'/g)) {
        const [, alias, key] = m as unknown as [string, string, string];
        const ns = aliases.get(alias);
        if (ns === undefined) continue; // not a translator call
        if (!exists(ns, key)) missing.push(`${rel} — ${alias}('${key}') → ${ns}:${key}`);
      }

      // 2. i18n.t('ns:some.key') — namespace is inline.
      for (const m of source.matchAll(/i18n\.t\(\s*'([\w]+):([\w.]+)'/g)) {
        const [, ns, key] = m as unknown as [string, string, string];
        if (!exists(ns, key)) missing.push(`${rel} — i18n.t('${ns}:${key}')`);
      }

      // 3. <Trans i18nKey="some.key" ns="namespace" />
      for (const m of source.matchAll(/i18nKey="([\w.]+)"[\s\S]{0,200}?ns="(\w+)"/g)) {
        const [, key, ns] = m as unknown as [string, string, string];
        if (!exists(ns, key)) missing.push(`${rel} — <Trans ${ns}:${key}>`);
      }

      // Template-literal keys can't be resolved statically.
      dynamic += [...source.matchAll(/\b\w+\(\s*`[^`]*\$\{/g)].length;
    }

    if (dynamic > 0) {
      // Informational: these rely on their helper's own fallback.

      console.log(`(${dynamic} dynamic key call sites skipped — checked at runtime)`);
    }
    expect(missing).toEqual([]);
  });
});
