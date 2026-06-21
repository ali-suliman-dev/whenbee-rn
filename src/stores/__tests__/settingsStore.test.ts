import { useSettingsStore } from '../settingsStore';

beforeEach(() => useSettingsStore.getState().reset());

it('stores and clears a display name', () => {
  useSettingsStore.getState().setDisplayName('Ali');
  expect(useSettingsStore.getState().displayName).toBe('Ali');
  useSettingsStore.getState().setDisplayName(undefined);
  expect(useSettingsStore.getState().displayName).toBeUndefined();
});

it('stores an archetype seed and reset clears both', () => {
  useSettingsStore.getState().setArchetypeSeed({ m0: 2.1, source: 'quiz', tookAt: 1 });
  useSettingsStore.getState().setDisplayName('Ali');
  useSettingsStore.getState().reset();
  expect(useSettingsStore.getState().archetypeSeed).toBeUndefined();
  expect(useSettingsStore.getState().displayName).toBeUndefined();
});
