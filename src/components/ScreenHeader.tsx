import { View } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from './AppText';

// ──────────────────────────────────────────────────────────────────────────────
// ScreenHeader — the single in-app navigation header.
//
// Title is always hard-left at the top of the screen (no native centered header).
// `right` holds an optional trailing action (e.g. the settings gear); `subtitle`
// is a muted caption under the title. One style, used across every screen.
// ──────────────────────────────────────────────────────────────────────────────

export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={{ paddingTop: t.space[1], paddingBottom: t.space[3], gap: 2 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <AppText variant="display" style={{ color: t.colors.ink }}>
          {title}
        </AppText>
        {right ?? null}
      </View>
      {subtitle ? (
        <AppText variant="caption" style={{ color: t.colors.inkSoft }}>
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}
