import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { Chip } from '@/src/components/Chip';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useSettingsStore, type ColorModePref } from '@/src/stores/settingsStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';

const modes: ColorModePref[] = ['system', 'light', 'dark'];

export default function Settings() {
  const t = useTheme();
  const { colorMode, setColorMode } = useSettingsStore();
  const isPro = useEntitlement((s) => s.isPro);

  function openPaywall() {
    router.push({ pathname: '/(modals)/paywall', params: { trigger: 'settings_upgrade' } });
  }

  function openHonestDay() {
    router.push('/(modals)/honest-day');
  }

  const upgradeRow: ViewStyle = {
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
  const upgradeTitle: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const upgradeNote: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };

  return (
    <Screen>
      <View style={{ gap: t.space[6], paddingTop: t.space[4] }}>
        <View style={{ gap: t.space[3] }}>
          <AppText variant="label">Whenbee Pro</AppText>
          <Pressable
            onPress={isPro ? openHonestDay : openPaywall}
            accessibilityRole="button"
            accessibilityLabel={
              isPro ? 'Make my whole day honest' : 'Go Pro and make your whole day honest'
            }
            style={upgradeRow}
          >
            <Ionicons name="time-outline" size={t.iconSize.md} color={t.colors.accent} />
            <View style={{ flex: 1, gap: t.space[0.5] }}>
              <Text style={upgradeTitle}>Make my whole day honest</Text>
              <Text style={upgradeNote}>
                {isPro
                  ? "Map your real buffers onto today's calendar."
                  : 'Auto-pad your calendar with your real buffers.'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkSoft} />
          </Pressable>
        </View>

        <View style={{ gap: t.space[3] }}>
          <AppText variant="label">Appearance</AppText>
          <View style={{ flexDirection: 'row', gap: t.space[2] }}>
            {modes.map((m) => (
              <Chip key={m} label={m} selected={colorMode === m} onPress={() => setColorMode(m)} />
            ))}
          </View>
        </View>
      </View>
    </Screen>
  );
}
