import { useCallback, useRef } from 'react';

/** Wraps a handler so it fires at most once per mount. router.push does not
 *  dedupe, so a double-tap stacks duplicate screens — and on a terminal CTA it
 *  double-fires analytics. Guard every nav CTA with this. */
export function useOnce(fn: () => void): () => void {
  const fired = useRef(false);
  return useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    fn();
  }, [fn]);
}
