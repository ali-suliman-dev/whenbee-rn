import React from 'react';
import { render } from '@testing-library/react-native';
import { FocusMode } from '../FocusMode';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useLearnedFocusWindow } from '../useLearnedFocusWindow';

// Mock router
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useRouter: () => ({ push: jest.fn() }) }));

// Mock FocusCurve (SVG hard to render in tests)
jest.mock('../FocusCurve', () => ({
  FocusCurve: ({ variant }: { variant: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View } = require('react-native');
    return <View testID={`focus-curve-${variant}`} />;
  },
}));

// Mock FocusWindowCard
jest.mock('../FocusWindowCard', () => ({
  FocusWindowCard: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View } = require('react-native');
    return <View testID="focus-window-card" />;
  },
}));

// Mock FocusWindowEditorSheet
jest.mock('../FocusWindowEditorSheet', () => ({
  FocusWindowEditorSheet: () => null,
}));

// Mock useSettingsStore
jest.mock('@/src/stores/settingsStore', () => ({
  useSettingsStore: (sel: (s: Record<string, unknown>) => unknown) => sel({ colorMode: 'light', windowStartMin: 540, windowEndMin: 690, focusWindowUserSet: false, focusShownStartMin: null, focusShownEndMin: null, focusLastMoveAtMs: null, setLearnedFocusWindow: jest.fn(), setFocusWindow: jest.fn(), reset: jest.fn() }),
}));

// Mock analytics
jest.mock('@/src/services/analytics', () => ({ analytics: { capture: jest.fn() } }));

jest.mock('../useLearnedFocusWindow', () => ({
  useLearnedFocusWindow: jest.fn(),
}));

const PERSONAL_WINDOW = {
  startMin: 540, endMin: 690, basis: 'personal' as const,
  confidence: 0.8, scoreByBin: new Array(38).fill(0.5), sampleCount: 20, distinctDays: 12, held: false,
};
const PRIOR_WINDOW = {
  startMin: 540, endMin: 690, basis: 'prior' as const,
  confidence: 0.3, scoreByBin: new Array(38).fill(0.3), sampleCount: 5, distinctDays: 3, held: false,
};

describe('FocusMode', () => {
  test('free + learned: renders exactly one filled/indigo CTA', () => {
    useEntitlement.setState({ isPro: false, ready: true });
    jest.mocked(useLearnedFocusWindow).mockReturnValue(PERSONAL_WINDOW);

    const { getAllByRole } = render(<FocusMode />);
    const buttons = getAllByRole('button');
    const unlockButtons = buttons.filter(
      (b) => b.props.accessibilityLabel === 'Unlock my focus window',
    );
    expect(unlockButtons).toHaveLength(1);
  });

  test('forming state: renders curve and ghost button only', () => {
    useEntitlement.setState({ isPro: false, ready: true });
    jest.mocked(useLearnedFocusWindow).mockReturnValue(PRIOR_WINDOW);

    const { getByTestId, queryByText } = render(<FocusMode />);
    expect(getByTestId('focus-curve-forming')).toBeTruthy();
    expect(queryByText('Set my hours myself')).toBeTruthy();
    expect(queryByText('Unlock my focus window')).toBeNull();
  });

  test('pro + learned: renders learned curve and card, no unlock CTA', () => {
    useEntitlement.setState({ isPro: true, ready: true });
    jest.mocked(useLearnedFocusWindow).mockReturnValue(PERSONAL_WINDOW);

    const { getByTestId, queryByText } = render(<FocusMode />);
    expect(getByTestId('focus-curve-learned')).toBeTruthy();
    expect(getByTestId('focus-window-card')).toBeTruthy();
    expect(queryByText('Unlock my focus window')).toBeNull();
  });
});
