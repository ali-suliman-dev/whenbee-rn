import { CATEGORY_NAMES } from '@/src/engine';
import i18n from '@/src/i18n';

/** Title-case a custom-category slug (e.g. "deep_work" → "Deep Work"). */
function titleCaseSlug(slug: string): string {
  return slug
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Human display name for a category id: localized name for the 10 built-in
 *  ids (via the `categories` namespace), else the engine's English seed name,
 *  else a title-cased slug for a user-authored custom category (never
 *  translated — only the built-in ids have catalog entries). */
export function categoryName(id: string): string {
  // `id` is an arbitrary runtime string (built-in or user-authored), so it can't
  // narrow to the typed key union `t()` expects — the `exists()` guard above is
  // the real safety check.
  const key = `categories:${id}` as never;
  return i18n.exists(key) ? i18n.t(key) : (CATEGORY_NAMES[id] ?? titleCaseSlug(id));
}
