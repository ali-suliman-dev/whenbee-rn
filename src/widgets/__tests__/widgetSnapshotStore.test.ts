import { widgetSnapshotStore } from '@/src/widgets/widgetSnapshotStore';
import { WIDGET_SNAPSHOT_KEY, type WidgetSnapshot } from '@/src/services/liveActivity';

const store: Record<string, string> = {};
jest.mock('@/src/lib/kv', () => ({
  kv: {
    set: (k: string, v: string) => { store[k] = v; },
    getString: (k: string) => (k in store ? store[k] : null),
    delete: (k: string) => { delete store[k]; },
  },
}));

const sample: WidgetSnapshot = {
  nextTaskLabel: 'Write the report',
  category: 'Deep work',
  honestFinishClock: '7:10',
  startDeepLink: 'whenbee://timer?taskId=1',
  updatedAtEpoch: 1000,
  honestFinishEpoch: 3700,
  isPro: true,
};

beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });

test('save then load round-trips the snapshot', () => {
  widgetSnapshotStore.save(sample);
  expect(store[WIDGET_SNAPSHOT_KEY]).toBeDefined();
  expect(widgetSnapshotStore.load()).toEqual(sample);
});

test('load returns null when nothing stored', () => {
  expect(widgetSnapshotStore.load()).toBeNull();
});

test('load returns null on corrupt JSON instead of throwing', () => {
  store[WIDGET_SNAPSHOT_KEY] = '{not json';
  expect(widgetSnapshotStore.load()).toBeNull();
});

test('clear removes the stored snapshot', () => {
  widgetSnapshotStore.save(sample);
  widgetSnapshotStore.clear();
  expect(widgetSnapshotStore.load()).toBeNull();
});
