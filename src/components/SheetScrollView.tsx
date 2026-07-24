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
// iOS: the sheet couples its drag-to-dismiss to the FIRST descendant scroll view
// (RNSScrollViewFinder). With the default `bounces`, a downward drag while the
// scroll view is at the top rubber-bands the content DOWN instead of handing the
// translation to the sheet — so the drawer only dismissed from the bare side
// gutters and the area below the content, never by grabbing the content or the
// grabber itself. `bounces=false` (+ `alwaysBounceVertical=false`) pins the offset
// at 0, so at the top a downward drag falls straight through to the sheet and
// dismisses from anywhere; mid-scroll it still scrolls up normally. The wheel
// (TimeField) is a bounded Pan, not a scroll view, so it keeps its own gesture.
//
// These correctness props are applied AFTER the spread deliberately: they are
// invariants of sheet scrolling, not preferences a caller may switch off. Plain
// <ScrollView> stays correct for tabs and fullScreenModals — there is no sheet
// behavior there to coordinate with.
//
// FlatList/ReorderableList-based sheets can't use this wrapper; they take the same
// props directly (all forward to their underlying ScrollView).
// ──────────────────────────────────────────────────────────────────────────────

export function SheetScrollView({ ref, ...props }: ScrollViewProps & { ref?: Ref<ScrollView> }) {
  return (
    <ScrollView
      ref={ref}
      {...props}
      nestedScrollEnabled
      bounces={false}
      alwaysBounceVertical={false}
    />
  );
}
