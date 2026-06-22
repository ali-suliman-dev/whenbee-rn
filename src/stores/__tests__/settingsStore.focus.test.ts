import { useSettingsStore } from '../settingsStore';

beforeEach(() => useSettingsStore.getState().reset());

describe('settingsStore focus window — learned window state', () => {
  it('defaults all learned focus fields to initial values', () => {
    const s = useSettingsStore.getState();
    expect(s.focusWindowUserSet).toBe(false);
    expect(s.focusShownStartMin).toBeNull();
    expect(s.focusShownEndMin).toBeNull();
    expect(s.focusLastMoveAtMs).toBeNull();
  });

  it('learned setter records shown window; does NOT set userSet', () => {
    useSettingsStore.getState().setLearnedFocusWindow(540, 690, 1000);
    const s = useSettingsStore.getState();
    expect(s.focusShownStartMin).toBe(540);
    expect(s.focusShownEndMin).toBe(690);
    expect(s.focusLastMoveAtMs).toBe(1000);
    // Also writes through to the packer's windowStartMin/EndMin
    expect(s.windowStartMin).toBe(540);
    expect(s.windowEndMin).toBe(690);
    // userSet stays false — this was auto-learned, not a manual user action
    expect(s.focusWindowUserSet).toBe(false);
  });

  it('manual setFocusWindow marks userSet = true', () => {
    useSettingsStore.getState().setFocusWindow(480, 600);
    expect(useSettingsStore.getState().focusWindowUserSet).toBe(true);
  });

  it('reset clears all learned focus fields', () => {
    useSettingsStore.getState().setLearnedFocusWindow(540, 690, 1000);
    useSettingsStore.getState().setFocusWindow(480, 600);
    useSettingsStore.getState().reset();
    const s = useSettingsStore.getState();
    expect(s.focusWindowUserSet).toBe(false);
    expect(s.focusShownStartMin).toBeNull();
    expect(s.focusShownEndMin).toBeNull();
    expect(s.focusLastMoveAtMs).toBeNull();
  });
});
