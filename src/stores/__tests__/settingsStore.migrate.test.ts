// src/stores/__tests__/settingsStore.migrate.test.ts
// Guards the persist migration that flips startByEnabled's default from
// true (pre-v1) to false (v1+). Without this migrate, existing users who had
// the old `true` default persisted would be silently opted into start-by
// notifications when the foundation change shipped.
import { useSettingsStore } from '@/src/stores/settingsStore';

describe('settingsStore — persist migration', () => {
  it('is versioned at 1', () => {
    expect(useSettingsStore.persist.getOptions().version).toBe(1);
  });

  it('forces startByEnabled to false for a pre-v1 persisted blob that had it true', () => {
    const { migrate } = useSettingsStore.persist.getOptions();
    expect(migrate).toBeDefined();

    const persisted = { startByEnabled: true, colorMode: 'dark', quickStartEnabled: true };
    const result = migrate!(persisted, 0) as typeof persisted;

    expect(result.startByEnabled).toBe(false);
  });

  it('preserves every other persisted field through the v0 migration', () => {
    const { migrate } = useSettingsStore.persist.getOptions();
    const persisted = {
      startByEnabled: true,
      colorMode: 'light',
      displayName: 'Ali',
      dayEndMin: 1200,
      quietHours: { enabled: false, startMin: 100, endMin: 200 },
    };
    const result = migrate!(persisted, 0) as typeof persisted;

    expect(result).toEqual({ ...persisted, startByEnabled: false });
  });

  it('no-ops (passes the blob through unchanged) when already at v1', () => {
    const { migrate } = useSettingsStore.persist.getOptions();
    const persisted = { startByEnabled: true, colorMode: 'dark' };
    const result = migrate!(persisted, 1) as typeof persisted;

    expect(result).toEqual(persisted);
  });

  it('handles a null/undefined persisted blob (fresh install) without throwing', () => {
    const { migrate } = useSettingsStore.persist.getOptions();
    expect(() => migrate!(undefined, 0)).not.toThrow();
    const result = migrate!(undefined, 0) as { startByEnabled?: boolean };
    expect(result.startByEnabled).toBe(false);
  });

  it('fresh install defaults startByEnabled to false (no persisted blob at all)', () => {
    useSettingsStore.getState().reset();
    expect(useSettingsStore.getState().startByEnabled).toBe(false);
  });
});
