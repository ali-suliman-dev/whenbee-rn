// src/features/settings/LanguagePicker.tsx
// Settings row + sheet for choosing the app language: System default / English /
// Svenska. Selecting an option persists the preference and calls
// `i18n.changeLanguage`, which re-renders every `useTranslation`/
// `useLocalizedFormat` subscriber immediately — no restart needed.

import { useState } from 'react';
import { Modal, Pressable, View, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import i18n from '@/src/i18n';
import { getLanguagePreference, setLanguagePreference, type LanguagePreference } from '@/src/i18n/languagePreference';
import { detectLanguage } from '@/src/i18n/detectLanguage';
import { AppText } from '@/src/components/AppText';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

const OPTION_VALUES: readonly LanguagePreference[] = ['system', 'en', 'sv'];

export function LanguagePicker() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { t: tr } = useTranslation('settings');
  const [open, setOpen] = useState(false);
  const [preference, setPreference] = useState<LanguagePreference>(() => getLanguagePreference());

  const currentLabel = tr(`language.${preference}`);

  function choose(value: LanguagePreference) {
    setLanguagePreference(value);
    setPreference(value);
    i18n.changeLanguage(value === 'system' ? detectLanguage() : value);
    setOpen(false);
  }

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    minHeight: t.size.control.lg,
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.hairline,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[3],
  };
  const titleStyle: TextStyle = { ...(type.bodySmBold as unknown as TextStyle), color: t.colors.ink };
  const noteStyle: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };

  const sheet: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: t.radii.sheet,
    borderTopRightRadius: t.radii.sheet,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[5],
    paddingTop: t.space[3],
    paddingBottom: insets.bottom + t.space[5],
    gap: t.space[4],
  };
  const optionRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: t.size.control.lg,
    paddingHorizontal: t.space[4],
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
  };
  const optionLabel: TextStyle = { ...(type.bodySmBold as unknown as TextStyle), color: t.colors.ink };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={tr('language.rowA11y', { name: currentLabel })}
        style={row}
      >
        <Ionicons name="language-outline" size={t.iconSize.md} color={t.colors.inkSoft} />
        <View style={{ flex: 1, gap: t.space[0.5] }}>
          <AppText style={titleStyle}>{tr('language.title')}</AppText>
          <AppText style={noteStyle}>{currentLabel}</AppText>
        </View>
        <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkSoft} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.colors.scrim }}
            accessibilityLabel={tr('dismissA11y')}
            onPress={() => setOpen(false)}
          />
          <View style={sheet}>
            <SheetGrabber />
            <AppText variant="title" style={{ color: t.colors.ink }}>
              {tr('language.sheetTitle')}
            </AppText>
            <View style={{ gap: t.space[1] }}>
              {OPTION_VALUES.map((value) => {
                const selected = value === preference;
                const label = tr(`language.${value}`);
                return (
                  <Pressable
                    key={value}
                    onPress={() => choose(value)}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected }}
                    style={optionRow}
                  >
                    <AppText style={optionLabel}>{label}</AppText>
                    {selected ? (
                      <Ionicons name="checkmark" size={t.iconSize.md} color={t.colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
