import type { TFunction } from 'i18next';
import i18n from '@/src/i18n';
import { capabilityFor } from '@/src/engine';
import type { CompanionStage } from '@/src/engine';
import { capabilityLabel } from '../capabilityCopy';

/** The real whenbee-namespace translator (jest.setup initializes i18n in English). */
const tr = i18n.getFixedT(null, 'whenbee') as TFunction<'whenbee'>;

const STAGES: CompanionStage[] = [1, 2, 3, 4, 5, 6];

test.each(STAGES)('stage %d resolves to real, non-fallback whenbee:ladder.* copy', (stage) => {
  const { id } = capabilityFor(stage);
  const label = capabilityLabel(id, tr);

  expect(label.length).toBeGreaterThan(0);
  // i18next returns the key itself when a lookup misses — guard against a
  // silently-missing entry in en/whenbee.json's `ladder` block.
  expect(label.startsWith('ladder.')).toBe(false);
});

test('capabilityLabel is a real i18n lookup, not a passthrough of the id', () => {
  const stage1 = capabilityFor(1);
  expect(capabilityLabel(stage1.id, tr)).toBe(tr('ladder.runningFinishTime'));
  expect(capabilityLabel(stage1.id, tr)).not.toBe(stage1.id);
});
