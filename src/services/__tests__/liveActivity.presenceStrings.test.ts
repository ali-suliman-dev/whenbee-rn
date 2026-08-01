import i18n from '@/src/i18n';
import { startFinishTimeActivity, updateFinishTimeActivity } from '@/src/services/liveActivity';

// ──────────────────────────────────────────────────────────────────────────────
// The Android running-timer notification renders text the user reads on the lock
// screen: the body, the status-bar chip and the "Stop & log" action. Those words
// CANNOT come from `res/values-sv/` — Android string resources follow the SYSTEM
// locale, while this app's language comes from its own in-app picker (i18next).
// A Swedish phone with the app set to English must show English on the lock screen.
//
// So JS sends the already-translated strings across the bridge and native persists
// them (the AlarmManager progress re-post and the overrun flip both fire with no JS
// alive). This suite guards that contract: if a string stops being translated, or
// the payload stops being sent, the lock screen silently reverts to English on a
// Swedish device and nothing else in the suite would notice.
//
// Both resolution seams are mocked (`loadAndroidPresence` on Android, the native
// module elsewhere) so the test does not depend on the platform jest reports.
// ──────────────────────────────────────────────────────────────────────────────

const mockStart = jest.fn();
const mockUpdate = jest.fn();

const mockPresence = {
  isStub: false,
  writeWidgetData: jest.fn(),
  clearWidgetData: jest.fn(),
  writeSnapshot: jest.fn(),
  clearSnapshot: jest.fn(),
  startLiveActivity: (a: unknown) => mockStart(a),
  updateLiveActivity: (s: unknown) => mockUpdate(s),
  endLiveActivity: jest.fn(),
};

jest.mock('@/src/lib/isExpoGo', () => ({ isExpoGo: false }));
jest.mock('@/src/services/analytics', () => ({ analytics: { capture: jest.fn() } }));
jest.mock('@/src/services/presence/androidPresence', () => ({
  loadAndroidPresence: () => mockPresence,
}));
jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: () => mockPresence }));

const ATTRS = {
  taskLabel: 'Write the report',
  finishEpoch: 3700,
  startEpoch: 1000,
  guessFinishEpoch: 3400,
  isProRich: true,
};

/** The five strings the native notification renders. */
const KEYS = ['finish', 'overrun', 'guessSuffix', 'chipOver', 'stopAction'] as const;

async function startIn(lang: 'en' | 'sv'): Promise<Record<string, string>> {
  await i18n.changeLanguage(lang);
  startFinishTimeActivity(ATTRS);
  const call = mockStart.mock.calls.at(-1)?.[0] as { strings?: Record<string, string> } | undefined;
  return call?.strings ?? {};
}

describe('Android presence notification strings', () => {
  beforeEach(() => {
    mockStart.mockClear();
    mockUpdate.mockClear();
  });

  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  it('sends every notification string, non-empty', async () => {
    const strings = await startIn('en');
    for (const key of KEYS) {
      expect(typeof strings[key]).toBe('string');
      expect(strings[key]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('keeps the {clock} placeholder so native formats the time itself (12/24h)', async () => {
    const strings = await startIn('en');
    expect(strings.finish).toContain('{clock}');
    expect(strings.overrun).toContain('{clock}');
    expect(strings.guessSuffix).toContain('{clock}');
  });

  it('sends SWEDISH strings when the app language is Swedish', async () => {
    const en = await startIn('en');
    const sv = await startIn('sv');
    for (const key of KEYS) {
      expect(sv[key]?.length ?? 0).toBeGreaterThan(0);
      // All five differ between the languages, so an untranslated or hardcoded
      // string surfaces here as an equality.
      expect(sv[key]).not.toBe(en[key]);
    }
    expect(sv.stopAction).toBe('Stoppa & logga');
    expect(sv.finish).toContain('{clock}');
  });

  it('carries the strings on update too, so a mid-timer language switch repaints', async () => {
    await i18n.changeLanguage('sv');
    updateFinishTimeActivity({ isOverrun: true });
    const state = mockUpdate.mock.calls.at(-1)?.[0] as {
      isOverrun: boolean;
      strings?: Record<string, string>;
    };
    expect(state.isOverrun).toBe(true);
    expect(state.strings?.stopAction).toBe('Stoppa & logga');
  });
});
