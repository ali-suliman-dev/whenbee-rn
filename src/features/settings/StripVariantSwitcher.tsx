// src/features/settings/StripVariantSwitcher.tsx
// TEMP A/B switcher (remove after the calendar-strip decision). A segmented
// control — mirroring the Today List/Timeline ViewToggle — that flips the live
// calendar-strip design. Pure persisted state (settingsStore.stripVariant), so it
// works identically in dev and device builds and updates the Today strip instantly.
// See docs/product/specs/2026-06-25-calendar-strip-ab.md.

import React from 'react';
import { Pressable, View, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/src/components/AppText';
import { haptics } from '@/src/lib/haptics';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useTheme } from '@/src/theme/useTheme';
import type { StripVariant } from '@/src/features/today/calendarStrip/stripVariant';

const OPTION_VALUES: readonly StripVariant[] = ['segment', 'lens'];

export function StripVariantSwitcher() {
  const t = useTheme();
  const { t: tr } = useTranslation('settings');
  const variant = useSettingsStore((s) => s.stripVariant);
  const setStripVariant = useSettingsStore((s) => s.setStripVariant);

  const OPTIONS: readonly { value: StripVariant; label: string; note: string }[] =
    OPTION_VALUES.map((value) => ({
      value,
      label: tr(`stripSwitcher.${value}.label`),
      note: tr(`stripSwitcher.${value}.note`),
    }));

  const activeNote =
    OPTIONS.find((o) => o.value === variant)?.note ?? tr('stripSwitcher.fallbackNote');

  function labelStyle(on: boolean): TextStyle {
    return {
      fontSize: t.fontSize.sm,
      fontWeight: on ? t.fontWeight.semibold : t.fontWeight.regular,
      color: on ? t.colors.ink : t.colors.inkSoft,
      fontFamily: t.fontFamily.ui,
    };
  }

  return (
    <View style={{ gap: t.space[3] }}>
      <AppText variant="label">{tr('stripSwitcher.label')}</AppText>

      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: 'row',
          backgroundColor: t.colors.surfaceSunken,
          borderRadius: t.radii.full,
          padding: 3,
        }}
      >
        {OPTIONS.map((o) => {
          const on = o.value === variant;
          return (
            <Pressable
              key={o.value}
              onPress={() => {
                if (!on) haptics.selection();
                setStripVariant(o.value);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={tr('stripSwitcher.tabA11y', { label: o.label })}
              style={{ flex: 1 }}
              hitSlop={4}
            >
              <View
                style={{
                  alignItems: 'center',
                  paddingVertical: t.space[2],
                  borderRadius: t.radii.full,
                  borderCurve: 'continuous',
                  backgroundColor: on ? t.colors.surface : 'transparent',
                }}
              >
                <AppText style={labelStyle(on)}>{o.label}</AppText>
              </View>
            </Pressable>
          );
        })}
      </View>

      <AppText variant="caption" style={{ color: t.colors.inkFaint }}>
        {tr('stripSwitcher.caption', { note: activeNote })}
      </AppText>
    </View>
  );
}
