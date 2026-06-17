import { useVocabStore } from '../vocabStore';
import { guessCategory } from '@/src/features/shared/categoryGuess';

describe('vocabStore', () => {
  beforeEach(() => useVocabStore.setState({ map: {}, seq: 0 }));

  it('banks a title under a category and ticks seq', () => {
    useVocabStore.getState().bank('fold the laundry', 'cleaning');
    const { map, seq } = useVocabStore.getState();
    expect(seq).toBe(1);
    expect(map.laundry?.cleaning).toEqual({ count: 1, lastSeq: 1 });
  });

  it('accumulates counts across banks and advances seq each call', () => {
    const { bank } = useVocabStore.getState();
    bank('gym', 'fitness');
    bank('gym', 'fitness');
    const { map, seq } = useVocabStore.getState();
    expect(seq).toBe(2);
    expect(map.gym?.fitness).toEqual({ count: 2, lastSeq: 2 });
  });

  it('resolves conflicts by count, then by most recent seq', () => {
    const { bank } = useVocabStore.getState();
    bank('walk', 'errands'); // seq 1
    bank('walk', 'getting_ready'); // seq 2 — equal count, more recent
    const guess = guessCategory('walk', {
      learned: useVocabStore.getState().map,
      availableIds: ['errands', 'getting_ready'],
    });
    expect(guess).toBe('getting_ready');
  });
});
