import { archetypeTraits } from '@/src/features/patterns/archetypeTraits';

describe('archetypeTraits', () => {
  it('builds all three rows from full answers', () => {
    const rows = archetypeTraits({ pace: 'bit', mid: 'track', focus: 'morning' }, 1.1);
    expect(rows).toEqual([
      { label: 'Runs', value: '1.1× long', amber: true },
      { label: 'Mid-task', value: 'Stays on track' },
      { label: 'Sharpest', value: 'Mornings' },
    ]);
  });

  it('drops rows for missing enrichment answers', () => {
    const rows = archetypeTraits({ pace: 'lot' }, 1.4);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ label: 'Runs', value: '1.4× long', amber: true });
  });

  it('maps rabbit + evening + varies', () => {
    expect(archetypeTraits({ pace: 'about', mid: 'rabbit' }, 2.1)[1]?.value).toBe(
      'Falls down rabbit holes',
    );
    expect(archetypeTraits({ pace: 'about', focus: 'evening' }, 2.1)[1]?.value).toBe('Evenings');
    expect(archetypeTraits({ pace: 'about', focus: 'varies' }, 2.1)[1]?.value).toBe('Varies');
  });
});
