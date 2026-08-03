import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Keeps DOM-facing callbacks referentially stable while always invoking the
 * latest render's implementation. This lets large memoized UI regions ignore
 * unrelated parent state such as viewport position.
 */
export function useStableEvent<Arguments extends unknown[], Result>(
  handler: (...args: Arguments) => Result,
) {
  const handlerRef = useRef(handler);
  useLayoutEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  return useCallback((...args: Arguments) => handlerRef.current(...args), []);
}
