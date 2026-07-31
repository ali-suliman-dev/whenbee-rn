// src/stores/__tests__/settingsStore.migrate.test.ts
import { useSettingsStore } from '@/src/stores/settingsStore';

describe('settingsStore — persist migration (startByEnabled opt-out)', () => {
  it('migrates a pre-v1 persisted true to false, preserving other fields', async () => {
    const { migrate } = useSettingsStore.persist.getOptions();
    expect(migrate).toBeDefined();
    const persisted = { startByEnabled: true, colorMode: 'dark', displayName: 'Ali' };
    const migrated = (await migrate!(persisted, 0)) as typeof persisted;
    expect(migrated.startByEnabled).toBe(false);
    expect(migrated.colorMode).toBe('dark');
    expect(migrated.displayName).toBe('Ali');
  });

  it('is a no-op at v1 — a persisted true survives (user has already opted in post-fix)', async () => {
    const { migrate } = useSettingsStore.persist.getOptions();
    const persisted = { startByEnabled: true };
    const migrated = (await migrate!(persisted, 1)) as typeof persisted;
    expect(migrated.startByEnabled).toBe(true);
  });

  it('handles a nullish persisted blob at v0 without throwing', async () => {
    const { migrate } = useSettingsStore.persist.getOptions();
    const migrated = (await migrate!(undefined, 0)) as { startByEnabled: boolean };
    expect(migrated.startByEnabled).toBe(false);
  });

  it('a fresh install (no persisted blob) defaults startByEnabled to false', () => {
    useSettingsStore.getState().reset();
    expect(useSettingsStore.getState().startByEnabled).toBe(false);
  });
});
