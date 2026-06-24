// src/stores/__tests__/settingsStore.notify.test.ts
import { useSettingsStore } from '@/src/stores/settingsStore';

describe('settingsStore — notification keys', () => {
  beforeEach(() => useSettingsStore.getState().reset());

  it('has calm defaults', () => {
    const s = useSettingsStore.getState();
    expect(s.quietHours).toEqual({ enabled: true, startMin: 1260, endMin: 480 });
    expect(s.notificationSound).toBe('default');
    expect(s.honestReachedEnabled).toBe(true);
    expect(s.startByEnabled).toBe(true);
  });

  it('sets and resets quiet hours + sound + per-type toggles', () => {
    const s = useSettingsStore.getState();
    s.setQuietHours({ enabled: false, startMin: 0, endMin: 0 });
    s.setNotificationSound('honey');
    s.setHonestReachedEnabled(false);
    s.setStartByEnabled(false);
    expect(useSettingsStore.getState().quietHours.enabled).toBe(false);
    expect(useSettingsStore.getState().notificationSound).toBe('honey');
    expect(useSettingsStore.getState().honestReachedEnabled).toBe(false);

    useSettingsStore.getState().reset();
    expect(useSettingsStore.getState().quietHours.enabled).toBe(true);
    expect(useSettingsStore.getState().honestReachedEnabled).toBe(true);
  });
});
