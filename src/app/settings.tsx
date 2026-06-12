import { View } from 'react-native';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { Chip } from '@/src/components/Chip';
import { useSettingsStore, type ColorModePref } from '@/src/stores/settingsStore';

const modes: ColorModePref[] = ['system', 'light', 'dark'];

export default function Settings() {
  const { colorMode, setColorMode } = useSettingsStore();
  return (
    <Screen>
      <View style={{ gap: 12, paddingTop: 16 }}>
        <AppText variant="label">Appearance</AppText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {modes.map((m) => (
            <Chip key={m} label={m} selected={colorMode === m} onPress={() => setColorMode(m)} />
          ))}
        </View>
      </View>
    </Screen>
  );
}
