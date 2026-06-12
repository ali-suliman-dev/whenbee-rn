import { View } from 'react-native';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { Chip } from '@/src/components/Chip';
import { useTheme } from '@/src/theme/useTheme';
import { useSettingsStore, type ColorModePref } from '@/src/stores/settingsStore';

const modes: ColorModePref[] = ['system', 'light', 'dark'];

export default function Settings() {
  const t = useTheme();
  const { colorMode, setColorMode } = useSettingsStore();
  return (
    <Screen>
      <View style={{ gap: t.space[3], paddingTop: t.space[4] }}>
        <AppText variant="label">Appearance</AppText>
        <View style={{ flexDirection: 'row', gap: t.space[2] }}>
          {modes.map((m) => (
            <Chip key={m} label={m} selected={colorMode === m} onPress={() => setColorMode(m)} />
          ))}
        </View>
      </View>
    </Screen>
  );
}
