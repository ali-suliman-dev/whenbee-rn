import { resources, SUPPORTED_LANGS, FALLBACK_LANG } from '../resources';

const flatten = (obj: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object'
      ? flatten(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );

describe('locale parity', () => {
  const base = resources[FALLBACK_LANG];
  const namespaces = Object.keys(base);

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
        const value = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], langNs);
        expect(typeof value === 'string' && value.length > 0).toBe(true);
      }
    }
  });
});
