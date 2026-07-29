// The mic glyph must render on BOTH platforms. It used to be a bare SF Symbol
// (`SymbolView`), which exists only on iOS — on Android it drew nothing, leaving
// an invisible but still-tappable button beside every task-title field. These
// tests pin the platform split so that regression can't come back silently.

import { Platform } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { MicButton } from '@/src/components/voice/MicButton';

// The global @expo/vector-icons stub renders null, which nothing can query.
// Render a probe instead, carrying the glyph name so the idle/listening swap is
// visible to assertions.
// The probes live in their own module: a component defined inside a jest.mock
// factory picks up nativewind's `_ReactNativeCSSInterop`, which the factory is
// not allowed to reference. A factory that only requires a module sidesteps it —
// and jest.mock factories can't use `import`, hence the disables.
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('@expo/vector-icons', () => require('@/src/lib/testing/iconProbes').vectorIconsProbe);
jest.mock('expo-symbols', () => require('@/src/lib/testing/iconProbes').symbolsProbe);
/* eslint-enable @typescript-eslint/no-require-imports */

const setPlatform = (os: 'ios' | 'android') => {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
};

afterEach(() => setPlatform('ios'));

describe('MicButton draws a glyph on every platform', () => {
  it('uses the SF Symbol on iOS', () => {
    setPlatform('ios');
    render(<MicButton status="idle" onPress={jest.fn()} />);
    expect(screen.getByTestId('sf-mic')).toBeTruthy();
  });

  it('falls back to Ionicons on Android — never an empty box', () => {
    setPlatform('android');
    render(<MicButton status="idle" onPress={jest.fn()} />);
    expect(screen.getByTestId('ionicon-mic-outline')).toBeTruthy();
    expect(screen.queryByTestId('sf-mic')).toBeNull();
  });

  it('fills the glyph while listening, on both platforms', () => {
    setPlatform('ios');
    const ios = render(<MicButton status="listening" onPress={jest.fn()} />);
    expect(ios.getByTestId('sf-mic.fill')).toBeTruthy();

    setPlatform('android');
    render(<MicButton status="listening" onPress={jest.fn()} />);
    expect(screen.getByTestId('ionicon-mic')).toBeTruthy();
  });

  it('stays reachable by its label whatever it draws', () => {
    setPlatform('android');
    render(<MicButton status="idle" onPress={jest.fn()} />);
    expect(screen.getByLabelText('Speak your task')).toBeTruthy();
  });
});
