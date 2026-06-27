// src/features/today/calendarStrip/WeekPager.tsx
// Generic horizontal, paging FlatList of week pages — the variant-agnostic shell
// both strip designs render through. It owns only the paging mechanics; the look
// of a week (and its container chrome) belongs to each variant via `renderWeek`.

import React, { useCallback } from 'react';
import { FlatList, type ListRenderItemInfo } from 'react-native';

import { TODAY_INDEX, type CalendarStripData } from './useCalendarStripData';

interface WeekPagerProps {
  data: CalendarStripData;
  /** Renders one week page (exactly `data.pageWidth` wide). */
  renderWeek: (anchor: string) => React.ReactElement;
}

export function WeekPager({ data, renderWeek }: WeekPagerProps) {
  const { weekAnchors, pageWidth, listRef, getItemLayout, onScrollToIndexFailed } = data;

  const renderItem = useCallback(
    ({ item: anchor }: ListRenderItemInfo<string>) => renderWeek(anchor),
    [renderWeek],
  );
  const keyExtractor = useCallback((anchor: string) => anchor, []);

  return (
    <FlatList
      ref={listRef}
      data={weekAnchors}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      getItemLayout={getItemLayout}
      initialScrollIndex={TODAY_INDEX}
      removeClippedSubviews
      decelerationRate="fast"
      // No bounce on the strip (animation rule: ease-out, no overshoot).
      bounces={false}
      overScrollMode="never"
      initialNumToRender={3}
      maxToRenderPerBatch={3}
      windowSize={5}
      onScrollToIndexFailed={onScrollToIndexFailed}
      style={{ width: pageWidth }}
    />
  );
}
