import { useColorScheme } from 'react-native';
import { useSettingsStore } from '@/src/stores/settingsStore';
export type ColorMode = 'light' | 'dark';
export function useColorMode(): ColorMode {
  const pref = useSettingsStore((s) => s.colorMode);
  const system = useColorScheme() ?? 'light';
  return pref === 'system' ? (system as ColorMode) : pref;
}
