import { ScrollView, type ScrollViewProps } from 'react-native';
import type { Ref } from 'react';

// ──────────────────────────────────────────────────────────────────────────────
// SheetScrollView — the scroll container every formSheet screen must use.
//
// Android formSheets are hosted by Google's BottomSheetBehavior, which finds the
// child it cooperates with via findScrollingChild(): it only accepts a view where
// ViewCompat.isNestedScrollingEnabled() is true. RN declares `nestedScrollEnabled`
// in ReactScrollViewManager WITHOUT a default, so omitting the prop applies FALSE
// and overrides android.widget.ScrollView's own constructor default of true. The
// behavior then finds no scrolling child and treats every downward drag as a sheet
// drag — so the sheet dismisses instead of scrolling the content back up, while
// upward drags still work (the sheet is already at its max detent). That asymmetry
// is the tell. Content short enough never to scroll hides the bug entirely, which
// is why it surfaced on the paywall first.
//
// `nestedScrollEnabled` is applied AFTER the spread deliberately: it is a
// correctness invariant of sheet scrolling, not a preference a caller may switch
// off. Plain <ScrollView> stays correct for tabs and fullScreenModals — there is
// no sheet behavior there to coordinate with.
//
// FlatList/ReorderableList-based sheets can't use this wrapper; they take the same
// prop directly (both forward it to their underlying ScrollView).
// ──────────────────────────────────────────────────────────────────────────────

export function SheetScrollView({ ref, ...props }: ScrollViewProps & { ref?: Ref<ScrollView> }) {
  return <ScrollView ref={ref} {...props} nestedScrollEnabled />;
}
