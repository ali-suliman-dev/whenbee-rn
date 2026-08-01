import { resources, SUPPORTED_LANGS } from '../resources';

// ──────────────────────────────────────────────────────────────────────────────
// The em dash (U+2014) is banned from user-facing copy in EVERY language
// (founder call, 2026-07-31). It is not a style preference to re-litigate per
// string: a translator or a generated draft reintroducing one should fail CI,
// not reach a device.
//
// The EN DASH (U+2013) is explicitly allowed and load-bearing — it separates
// numeric ranges (`{{low}}–{{high}}`, `15–21`) and stands in for a missing
// value. Only U+2014 is the offence.
// ──────────────────────────────────────────────────────────────────────────────

const EM_DASH = '—';

const flatten = (obj: Record<string, unknown>, prefix = ''): [string, string][] =>
  Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object'
      ? flatten(v as Record<string, unknown>, `${prefix}${k}.`)
      : ([[`${prefix}${k}`, String(v)]] as [string, string][]),
  );

describe('no em dashes in any locale bundle', () => {
  it.each(SUPPORTED_LANGS)('language %s is free of em dashes', (lang) => {
    const offenders: string[] = [];
    const bundle = resources[lang] as Record<string, Record<string, unknown>>;
    for (const ns of Object.keys(bundle)) {
      for (const [key, value] of flatten(bundle[ns] as Record<string, unknown>)) {
        if (value.includes(EM_DASH)) offenders.push(`${lang}/${ns}:${key} -> ${value}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
