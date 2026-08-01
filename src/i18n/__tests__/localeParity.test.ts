import { resources, SUPPORTED_LANGS, FALLBACK_LANG, NAMESPACES } from '../resources';

const flatten = (obj: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object'
      ? flatten(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );

const valueAt = (ns: Record<string, unknown>, key: string): unknown =>
  key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], ns);

/** `{{name}}` interpolation tokens in a string, deduped and sorted.
 *  Formatting suffixes (`{{n, number}}`) are ignored — only the NAME matters. */
const placeholdersIn = (s: string): string[] =>
  [...new Set([...s.matchAll(/\{\{\s*([\w.]+)[^}]*\}\}/g)].map((m) => m[1] as string))].sort();

/** `<tag>` components handed to <Trans> — the other half of a translatable
 *  sentence's contract. A translation that renames or drops one renders the
 *  markup as literal text. Self-closing and paired tags both count. */
const tagsIn = (s: string): string[] =>
  [...new Set([...s.matchAll(/<\s*([a-zA-Z][\w]*)\s*\/?>/g)].map((m) => m[1] as string))].sort();

// The plural suffixes i18next resolves at lookup time. A base key may legitimately
// exist in one language as `_one`/`_other` and in another with more forms, so
// plural siblings are compared as a GROUP, not one-to-one.
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
const baseKeyOf = (key: string): string => key.replace(PLURAL_SUFFIX, '');

describe('locale parity', () => {
  const base = resources[FALLBACK_LANG];
  const namespaces = Object.keys(base);

  it('derives NAMESPACES from the fallback bundle', () => {
    expect([...NAMESPACES].sort()).toEqual(namespaces.sort());
  });

  it.each(SUPPORTED_LANGS)('language %s has every namespace', (lang) => {
    expect(Object.keys(resources[lang]).sort()).toEqual(namespaces.sort());
  });

  it.each(SUPPORTED_LANGS)('language %s has every key with a non-empty value', (lang) => {
    for (const ns of namespaces) {
      const baseKeys = flatten(base[ns as keyof typeof base] as Record<string, unknown>).sort();
      const langNs = resources[lang][ns as keyof (typeof resources)[typeof lang]] as Record<
        string,
        unknown
      >;
      const langKeys = flatten(langNs).sort();
      expect(langKeys).toEqual(baseKeys); // same keys, no missing/extra
      for (const key of langKeys) {
        const value = valueAt(langNs, key);
        expect(typeof value === 'string' && value.length > 0).toBe(true);
      }
    }
  });

  // The parity check above proves a translation EXISTS. These two prove it is
  // still WIRED: a string that drops `{{duration}}` or renames a <Trans> tag
  // passes every other check and then renders a broken sentence at runtime.
  it.each(SUPPORTED_LANGS)('language %s carries the same interpolation tokens', (lang) => {
    const mismatches: string[] = [];
    for (const ns of namespaces) {
      const baseNs = base[ns as keyof typeof base] as Record<string, unknown>;
      const langNs = resources[lang][ns as keyof (typeof resources)[typeof lang]] as Record<
        string,
        unknown
      >;
      // Group plural siblings so `_one` and `_other` are allowed to differ from
      // each other, but the group must offer the same tokens the base group does.
      const groups = new Map<string, string[]>();
      for (const key of flatten(baseNs)) {
        const g = groups.get(baseKeyOf(key)) ?? [];
        g.push(key);
        groups.set(baseKeyOf(key), g);
      }
      for (const [group, keys] of groups) {
        const expected = [
          ...new Set(keys.flatMap((k) => placeholdersIn(String(valueAt(baseNs, k) ?? '')))),
        ].sort();
        const actual = [
          ...new Set(keys.flatMap((k) => placeholdersIn(String(valueAt(langNs, k) ?? '')))),
        ].sort();
        if (JSON.stringify(expected) !== JSON.stringify(actual)) {
          mismatches.push(`${ns}.${group} — expected [${expected}], got [${actual}]`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it.each(SUPPORTED_LANGS)('language %s carries the same <Trans> component tags', (lang) => {
    const mismatches: string[] = [];
    for (const ns of namespaces) {
      const baseNs = base[ns as keyof typeof base] as Record<string, unknown>;
      const langNs = resources[lang][ns as keyof (typeof resources)[typeof lang]] as Record<
        string,
        unknown
      >;
      for (const key of flatten(baseNs)) {
        const expected = tagsIn(String(valueAt(baseNs, key) ?? ''));
        const actual = tagsIn(String(valueAt(langNs, key) ?? ''));
        if (JSON.stringify(expected) !== JSON.stringify(actual)) {
          mismatches.push(`${ns}.${key} — expected [${expected}], got [${actual}]`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });
});
