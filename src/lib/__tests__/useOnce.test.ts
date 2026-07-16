import { renderHook, act } from '@testing-library/react-native';
import { useOnce } from '../useOnce';

it('runs the handler once, however many times it is called', () => {
  const fn = jest.fn();
  const { result } = renderHook(() => useOnce(fn));
  act(() => { result.current(); result.current(); result.current(); });
  expect(fn).toHaveBeenCalledTimes(1);
});

it('gives a fresh mount a fresh shot', () => {
  const fn = jest.fn();
  const a = renderHook(() => useOnce(fn));
  act(() => { a.result.current(); });
  a.unmount();
  const b = renderHook(() => useOnce(fn));
  act(() => { b.result.current(); });
  expect(fn).toHaveBeenCalledTimes(2);
});
