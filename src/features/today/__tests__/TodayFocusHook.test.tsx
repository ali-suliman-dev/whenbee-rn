import React from 'react';
import { render } from '@testing-library/react-native';
import { TodayFocusHook } from '../TodayFocusHook';
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';

jest.mock('@/src/features/planner/useLearnedFocusWindow', () => ({
  useLearnedFocusWindow: jest.fn(),
}));
jest.mock('@/src/features/paywall/useEntitlement', () => ({
  useEntitlement: (sel: (s: Record<string, unknown>) => unknown) => sel({ isPro: false }),
}));
jest.mock('@/src/stores/tasksStore', () => ({
  useTasksStore: (sel: (s: Record<string, unknown>) => unknown) => sel({ tasks: [{ id: '1', status: 'queued' }] }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/src/stores/settingsStore', () => ({
  useSettingsStore: (sel: (s: Record<string, unknown>) => unknown) => sel({ colorMode: 'light', windowStartMin: 540, windowEndMin: 1440 }),
}));

const PRIOR_WINDOW = {
  startMin: 540, endMin: 690, basis: 'prior' as const,
  confidence: 0.3, scoreByBin: new Array(38).fill(0.3), sampleCount: 5, distinctDays: 3, held: false,
};
const PERSONAL_WINDOW = {
  startMin: 540, endMin: 1440, basis: 'personal' as const,
  confidence: 0.8, scoreByBin: new Array(38).fill(0.5), sampleCount: 20, distinctDays: 12, held: false,
};

test('renders nothing when window is still prior', () => {
  jest.mocked(useLearnedFocusWindow).mockReturnValue(PRIOR_WINDOW);
  const { toJSON } = render(<TodayFocusHook nowMs={0} />);
  expect(toJSON()).toBeNull();
});

test('renders teaser row when window is personal', () => {
  jest.mocked(useLearnedFocusWindow).mockReturnValue(PERSONAL_WINDOW);
  // nowMs = 0 = midnight (00:00), windowEndMin = 1440 (24:00) so condition passes
  const { queryByText } = render(<TodayFocusHook nowMs={0} />);
  expect(queryByText(/focus window/i)).toBeTruthy();
});
