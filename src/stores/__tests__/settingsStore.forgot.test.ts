import { useSettingsStore } from '../settingsStore';
import { DEFAULT_FORGOT_STEP_IN } from '@/src/engine/constants';

describe('settingsStore forgot-to-stop protection', () => {
  it('defaults to the balanced preset and unseen', () => {
    const s = useSettingsStore.getState();
    expect(s.forgotStepIn).toBe(DEFAULT_FORGOT_STEP_IN);
    expect(s.forgotProtectSeen).toBe(false);
  });

  it('setForgotStepIn updates the preset', () => {
    useSettingsStore.getState().setForgotStepIn('early');
    expect(useSettingsStore.getState().forgotStepIn).toBe('early');
  });

  it('markForgotProtectSeen latches true', () => {
    useSettingsStore.getState().markForgotProtectSeen();
    expect(useSettingsStore.getState().forgotProtectSeen).toBe(true);
  });
});
