import { useState, useCallback } from "react";

/**
 * Drop-in replacement for useState that persists to sessionStorage.
 * Data survives navigation but clears when the tab closes.
 */
export function useSessionState<T>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void, () => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored !== null) {
        return JSON.parse(stored) as T;
      }
    } catch {
      // ignore parse errors
    }
    return initialValue;
  });

  const setPersistedState = useCallback(
    (val: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next = val instanceof Function ? val(prev) : val;
        try {
          sessionStorage.setItem(key, JSON.stringify(next));
        } catch {
          // storage full — ignore
        }
        return next;
      });
    },
    [key]
  );

  const clear = useCallback(() => {
    sessionStorage.removeItem(key);
    setState(initialValue);
  }, [key, initialValue]);

  return [state, setPersistedState, clear];
}

/** Remove all session keys matching a prefix */
export function clearSessionKeys(prefix: string) {
  const toRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k?.startsWith(prefix)) toRemove.push(k);
  }
  toRemove.forEach((k) => sessionStorage.removeItem(k));
}
