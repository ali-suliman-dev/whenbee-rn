// Today's category labels resolve through the ONE shared resolver — the engine's
// CATEGORY_NAMES map is English-only, so reading it here rendered "Getting ready"
// to Swedish users on every task row, focus card and widget snapshot.
// Re-exported (rather than removed) so the today-local import path keeps working.
export { categoryName } from '@/src/features/shared/categoryName';
