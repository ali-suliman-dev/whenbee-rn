import { PRO_FEATURES, featuresByGroup, featuresByMoment } from '../proFeatures';
import en from '@/src/i18n/locales/en/paywall.json';

describe('proFeatures registry', () => {
  it('holds exactly 12 features with unique keys', () => {
    expect(PRO_FEATURES).toHaveLength(12);
    const keys = PRO_FEATURES.map((f) => f.key);
    expect(new Set(keys).size).toBe(12);
  });

  it('every feature has an icon and a label key that resolves in the bundle', () => {
    const labels = en.features as Record<string, string | undefined>;
    for (const f of PRO_FEATURES) {
      expect(f.icon.length).toBeGreaterThan(0);
      // Labels are translated at the render site, so the registry must only ever
      // carry a key — a raw English label here would ship untranslated copy.
      expect(f.labelKey).toBe(`features.${f.key}`);
      expect(labels[f.key]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('groups partition the set 4/4/4', () => {
    expect(featuresByGroup('plan')).toHaveLength(4);
    expect(featuresByGroup('run')).toHaveLength(4);
    expect(featuresByGroup('learn')).toHaveLength(4);
  });

  it('moments partition the set 2/3/2/1/4', () => {
    expect(featuresByMoment('morning')).toHaveLength(2);
    expect(featuresByMoment('deepwork')).toHaveLength(3);
    expect(featuresByMoment('midday')).toHaveLength(2);
    expect(featuresByMoment('evening')).toHaveLength(1);
    expect(featuresByMoment('week')).toHaveLength(4);
  });

  it('groups and moments together cover every feature exactly once', () => {
    const byGroups = (['plan', 'run', 'learn'] as const).flatMap(featuresByGroup);
    const byMoments = (['morning', 'deepwork', 'midday', 'evening', 'week'] as const).flatMap(
      featuresByMoment,
    );
    expect(byGroups.map((f) => f.key).sort()).toEqual(PRO_FEATURES.map((f) => f.key).sort());
    expect(byMoments.map((f) => f.key).sort()).toEqual(PRO_FEATURES.map((f) => f.key).sort());
  });
});
