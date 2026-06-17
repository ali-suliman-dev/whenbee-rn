import { useCategoriesStore, slugifyCategory, type CategoryEntry } from '../categoriesStore';

function seed(...names: string[]) {
  const list: CategoryEntry[] = names.map((name) => ({
    id: slugifyCategory(name),
    name,
    adaptSpeed: 'balanced',
  }));
  useCategoriesStore.setState({ categories: list });
}

describe('categoriesStore', () => {
  beforeEach(() => useCategoriesStore.setState({ categories: [] }));

  it('addCategory slugifies the name and avoids duplicates', () => {
    const id = useCategoriesStore.getState().addCategory('Deep Work');
    expect(id).toBe('deep_work');
    expect(useCategoriesStore.getState().categories).toHaveLength(1);

    const again = useCategoriesStore.getState().addCategory('deep work');
    expect(again).toBe('deep_work');
    expect(useCategoriesStore.getState().categories).toHaveLength(1);
  });

  it('renameCategory changes the label but keeps the id (stats stay attached)', () => {
    seed('Cleaning');
    useCategoriesStore.getState().renameCategory('cleaning', 'Tidying');

    const [cat] = useCategoriesStore.getState().categories;
    expect(cat?.id).toBe('cleaning');
    expect(cat?.name).toBe('Tidying');
  });

  it('renameCategory ignores a blank name', () => {
    seed('Cleaning');
    useCategoriesStore.getState().renameCategory('cleaning', '   ');
    expect(useCategoriesStore.getState().categories[0]?.name).toBe('Cleaning');
  });

  it('removeCategory drops the category', () => {
    seed('Cleaning', 'Admin');
    useCategoriesStore.getState().removeCategory('cleaning');

    const { categories } = useCategoriesStore.getState();
    expect(categories).toHaveLength(1);
    expect(categories[0]?.id).toBe('admin');
  });

  it('removeCategory refuses to empty the list (keeps the last one)', () => {
    seed('Cleaning');
    useCategoriesStore.getState().removeCategory('cleaning');
    expect(useCategoriesStore.getState().categories).toHaveLength(1);
  });
});
