import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PlanReminderChip } from '@/src/features/today/PlanReminderChip';
import { useStartByToggle } from '@/src/features/today/useStartByToggle';

jest.mock('@/src/features/today/useStartByToggle', () => ({
  useStartByToggle: jest.fn(),
}));

jest.mock('@/src/lib/haptics', () => ({
  haptics: { light: jest.fn() },
}));

describe('PlanReminderChip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing without a start-by clock', () => {
    (useStartByToggle as jest.Mock).mockReturnValue({ enabled: false, toggle: jest.fn() });
    const { toJSON } = render(<PlanReminderChip startByClock={null} />);
    expect(toJSON()).toBeNull();
  });

  it('shows the on copy with the clock when enabled', () => {
    (useStartByToggle as jest.Mock).mockReturnValue({ enabled: true, toggle: jest.fn() });
    const { getByText } = render(<PlanReminderChip startByClock="12:35 PM" />);
    expect(getByText(/12:35 PM/)).toBeTruthy();
  });

  it('toggles on press', () => {
    const toggle = jest.fn();
    (useStartByToggle as jest.Mock).mockReturnValue({ enabled: false, toggle });
    const { getByRole } = render(<PlanReminderChip startByClock="12:35 PM" />);
    fireEvent.press(getByRole('switch'));
    expect(toggle).toHaveBeenCalledWith(true);
  });
});
