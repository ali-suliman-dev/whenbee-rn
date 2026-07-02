// Home-screen widget UI, declared in JSX and rendered to Android RemoteViews by
// react-native-android-widget. Presentation-only: all math/formatting is done in
// JS before the snapshot is written (mirrors the iOS NextTaskWidget.swift split).
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { arcFraction } from '@/src/engine/presence';
import type { WidgetSnapshot } from '@/src/services/liveActivity';
import { widgetTheme as t } from '@/src/widgets/widgetTheme';

const STALE_AFTER_SEC = 6 * 60 * 60; // 6h — matches SharedStore.swift staleness gate

type Props = { snapshot: WidgetSnapshot | null; nowSec: number };

export function NextTaskWidget({ snapshot, nowSec }: Props) {
  const hasTask = snapshot != null && snapshot.nextTaskLabel !== '';
  const isStale = snapshot != null && nowSec - snapshot.updatedAtEpoch > STALE_AFTER_SEC;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: t.surface,
        borderRadius: t.radius,
        padding: t.padding,
      }}
      clickAction="OPEN_START"
    >
      <TextWidget text="● Whenbee" style={{ fontSize: t.wordmarkSize, color: t.accent }} />

      {hasTask ? (
        <FlexWidget style={{ flexDirection: 'column' }}>
          <TextWidget
            text={snapshot!.nextTaskLabel}
            maxLines={2}
            style={{ fontSize: t.labelSize, color: t.ink }}
          />
          <TextWidget
            text={isStale ? snapshot!.honestFinishClock : `Honest finish ${snapshot!.honestFinishClock}`}
            style={{ fontSize: t.captionSize, color: t.inkMuted, marginTop: 4 }}
          />
          {snapshot!.isPro ? <ProgressBar snapshot={snapshot!} nowSec={nowSec} /> : null}
        </FlexWidget>
      ) : (
        <TextWidget text="No task queued" style={{ fontSize: t.captionSize, color: t.inkMuted }} />
      )}

      <TextWidget
        text="Start"
        clickAction="OPEN_START"
        style={{
          fontSize: t.captionSize,
          color: t.surface,
          backgroundColor: t.accent,
          borderRadius: 999,
          paddingHorizontal: 14,
          paddingVertical: 6,
          textAlign: 'center',
        }}
      />
    </FlexWidget>
  );
}

// RemoteViews has no percentage-width style (this library's `SizeStyleProps.width`
// only accepts 'wrap_content' | 'match_parent' | number — no `'NN%'` string), so
// the Pro "ring" becomes a horizontal fill bar built from two flex-weighted
// segments rather than a literal CSS width. The weights are the SAME arcFraction
// the iOS ring uses — one shared formula, just applied via flex instead of width.
function ProgressBar({ snapshot, nowSec }: { snapshot: WidgetSnapshot; nowSec: number }) {
  const frac = arcFraction(snapshot.updatedAtEpoch, snapshot.honestFinishEpoch, nowSec);
  const filled = Math.max(frac, 0.001); // keep a sliver of flex so the segment never fully collapses
  const remaining = 1 - filled;
  return (
    <FlexWidget
      style={{
        flexDirection: 'row',
        height: 4,
        width: 'match_parent',
        backgroundColor: t.ringTrack,
        borderRadius: 999,
        marginTop: 8,
      }}
    >
      <FlexWidget style={{ flex: filled, height: 4, backgroundColor: t.accent, borderRadius: 999 }} />
      {remaining > 0 ? <FlexWidget style={{ flex: remaining, height: 4 }} /> : null}
    </FlexWidget>
  );
}
