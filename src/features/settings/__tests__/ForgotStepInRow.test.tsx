import { render, fireEvent } from '@testing-library/react-native';
import { ForgotStepInRow } from '../ForgotStepInRow';
import { useSettingsStore } from '@/src/stores/settingsStore';

describe('ForgotStepInRow', () => {
  it('reflects and updates the preset', () => {
    useSettingsStore.getState().setForgotStepIn('balanced');
    const { getByText } = render(<ForgotStepInRow />);
    fireEvent.press(getByText('Step in early'));
    expect(useSettingsStore.getState().forgotStepIn).toBe('early');
  });
});
