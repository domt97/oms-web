import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type DependencyList } from 'react';
import { toAppError, type AppError } from '../../domain/errors';
import type { Observable } from '../../ports';

// Data hooks (ADR 0001). Swap for TanStack Query when caching/invalidation across pages is needed.

export interface AsyncState<T> {
  data: T | undefined;
  error: AppError | undefined;
  loading: boolean;
  reload: () => void;
  setData: (data: T) => void;
}

/** Loads when deps change; results of stale calls are ignored. */
export function useAsync<T>(load: () => Promise<T>, deps: DependencyList, enabled = true): AsyncState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<AppError>();
  const [loading, setLoading] = useState(enabled);
  const [tick, setTick] = useState(0);
  const callId = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const id = ++callId.current;
    setLoading(true);
    setError(undefined);
    load()
      .then((result) => id === callId.current && setData(result))
      .catch((e) => id === callId.current && setError(toAppError(e)))
      .finally(() => id === callId.current && setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, enabled]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}

export interface ActionState<A extends unknown[], R> {
  run: (...args: A) => Promise<R | undefined>;
  pending: boolean;
  error: AppError | undefined;
  reset: () => void;
}

/** Wraps a write: tracks pending + error, ignores a second call while one is pending (double submit). */
export function useAction<A extends unknown[], R>(action: (...args: A) => Promise<R>): ActionState<A, R> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AppError>();
  const busy = useRef(false);
  const run = useCallback(
    async (...args: A) => {
      if (busy.current) return undefined;
      busy.current = true;
      setPending(true);
      setError(undefined);
      try {
        return await action(...args);
      } catch (e) {
        setError(toAppError(e));
        return undefined;
      } finally {
        busy.current = false;
        setPending(false);
      }
    },
    [action],
  );
  return { run, pending, error, reset: () => setError(undefined) };
}

/** Subscribes a component to an adapter-owned Observable (cart, session, workspace…). */
export function useObservable<T>(source: Observable<T>): T {
  return useSyncExternalStore(source.subscribe, source.get);
}
