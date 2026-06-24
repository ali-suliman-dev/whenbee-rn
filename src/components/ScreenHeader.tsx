import { useTheme } from '@/src/theme/useTheme';
import type { ReactNode } from 'react';
import { View } from 'react-native';
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
  eyebrow,
  largeTitle = false,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  eyebrow?: ReactNode;
  /** Bump the title one step up the scale (2xl → 3xl). Today only. */
  largeTitle?: boolean;
}) {
  const t = useTheme();
  const titleSize = largeTitle ? t.fontSize['3xl'] : t.fontSize['2xl'];
  return (
    <View
      style={{
        paddingTop: t.space[1],
        paddingBottom: t.space[3],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {/* The whole text column is the left flex child — so the tall `right`
          (honey ring or gear) only centers the column as a block, never
          inflates the title row. The column keeps its own tight rhythm. */}
      <View style={{ gap: t.space[1], flexShrink: 1 }}>
        {eyebrow ? (
          typeof eyebrow === 'string' ? (
            <AppText variant="caption" style={{ color: t.colors.inkSoft }}>
              {eyebrow}
            </AppText>
          ) : (
            eyebrow
          )
        ) : null}
        <AppText
          variant="display"
          style={{
            color: t.colors.ink,
            fontSize: titleSize,
            lineHeight: titleSize * t.lineHeight.tight,
          }}
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" style={{ color: t.colors.inkSoft }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ?? null}
    </View>
  );
}
