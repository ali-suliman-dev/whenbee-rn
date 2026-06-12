import { Platform } from 'react-native';
import { Host, Picker } from '@expo/ui/swift-ui';
import { isExpoGo } from '@/src/lib/isExpoGo';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// GuessWheel — a native iOS minutes wheel (SwiftUI Picker, drag up/down) that
// pairs with the preset TimeChips. Both write the same useAddTask().setGuessMin,
// so the wheel follows a tapped chip and the chip highlight clears when the wheel
// lands on a non-preset value (TimeChips' `selected={value === min}` handles that).
//
// Native-only: @expo/ui needs the New-Arch native build, so it renders nothing on
// Android or in Expo Go — the chips remain the input there (graceful fallback).
//
// The SwiftUI Picker's wheel text uses the host's colorScheme. Without forcing it,
// the host inherits the *device's* system appearance, not the app's — so on a
// light-mode device the wheel draws near-black numbers that vanish against our
// dark sheet (invisible on device, fine on a dark-mode sim). We pin colorScheme
// to the app's own mode so the numbers always read against our background.
// ──────────────────────────────────────────────────────────────────────────────

const MAX_MINUTES = 180;
const WHEEL_HEIGHT = 120;

// Fine drag control: every whole minute from 1 to 180.
const MINUTES: number[] = Array.from({ length: MAX_MINUTES }, (_, i) => i + 1);

function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const hours = Math.floor(min / 60);
  const mins = min % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

const OPTIONS: string[] = MINUTES.map(formatMinutes);

export function GuessWheel({ value, onChange }: { value: number; onChange: (min: number) => void }) {
  const t = useTheme();
  if (Platform.OS !== 'ios' || isExpoGo) return null;

  // Off-list values (e.g. a future preset outside 1–180) fall back to the top.
  const selectedIndex = Math.max(0, MINUTES.indexOf(value));

  return (
    <Host style={{ height: WHEEL_HEIGHT }} colorScheme={t.mode}>
      <Picker
        variant="wheel"
        options={OPTIONS}
        selectedIndex={selectedIndex}
        onOptionSelected={({ nativeEvent: { index } }) => {
          const minutes = MINUTES[index];
          if (minutes !== undefined) onChange(minutes);
        }}
      />
    </Host>
  );
}
