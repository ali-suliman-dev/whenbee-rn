import { CATEGORY_NAMES } from '@/src/engine';
import i18n from '@/src/i18n';
import { SUPPORTED_LANGS, resources } from '@/src/i18n/resources';

// ──────────────────────────────────────────────────────────────────────────────
// The ONE category-name resolver. `src/engine/**` is pure and ships its names in
// English (CATEGORY_NAMES) — translating happens here, at the UI boundary, and
// nowhere else. Every surface that shows a category to a human comes through
// this file so a Swedish user never reads "Getting ready".
// ──────────────────────────────────────────────────────────────────────────────

/** Title-case a custom-category slug (e.g. "deep_work" → "Deep Work"). */
function titleCaseSlug(slug: string): string {
  return slug
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Human display name for a category id: localized name for the built-in ids
 *  (via the `categories` namespace), else the engine's English seed name, else a
 *  title-cased slug for a user-authored custom category (never translated — only
 *  the built-in ids have catalog entries). */
export function categoryName(id: string): string {
  // `id` is an arbitrary runtime string (built-in or user-authored), so it can't
  // narrow to the typed key union `t()` expects — the `exists()` guard above is
  // the real safety check.
  const key = `categories:${id}` as never;
  return i18n.exists(key) ? i18n.t(key) : (CATEGORY_NAMES[id] ?? titleCaseSlug(id));
}

/** True when `id` is one of the built-in ids that ships a translated name. */
export function isBuiltInCategory(id: string): boolean {
  return i18n.exists(`categories:${id}` as never) || id in CATEGORY_NAMES;
}

/** Every name a built-in id has ever been stored under by the app itself: the
 *  engine's English seed plus the catalog entry in each shipped language. */
function shippedNamesFor(id: string): string[] {
  const names: string[] = [];
  const seed = CATEGORY_NAMES[id];
  if (seed) names.push(seed);
  for (const lang of SUPPORTED_LANGS) {
    const catalog = resources[lang].categories as Record<string, string | undefined>;
    const name = catalog[id];
    if (name) names.push(name);
  }
  return names;
}

/**
 * Display name for a TRACKED category, honouring a stored label.
 *
 * `categoriesStore` persists a `name` alongside the id, snapshotted whenever the
 * category was first picked — so a built-in id picked in English keeps reading
 * "Admin & email" forever, in every language. That stored label is only ever a
 * projection: when it matches a name the app itself shipped (in ANY language),
 * it is a default and gets re-localized. Anything else is a name the user typed
 * — a custom category or a deliberate rename — and passes through untouched.
 *
 * No migration needed: existing rows are re-projected on read.
 */
export function categoryDisplayName(id: string, storedName?: string | null): string {
  const stored = storedName?.trim();
  if (!stored) return categoryName(id);
  if (shippedNamesFor(id).includes(stored)) return categoryName(id);
  return stored;
}
