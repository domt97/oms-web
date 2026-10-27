import type { Observable } from '../../ports';

// Browser storage for TEMPORARY adapters only. Keys are versioned (oms-web:v1:...): change the version
// and add a migration when the stored shape changes. Every access is guarded: storage may be unavailable
// (private mode, blocked site data) — the store then lives in memory only. Other tabs' writes are picked up
// through the `storage` event.

export const KEY_PREFIX = 'oms-web:v1:';

export interface PersistentStore<T> extends Observable<T> {
  set(next: T): void;
  update(fn: (current: T) => T): void;
}

function read<T>(key: string, initial: T, isValid: (v: unknown) => v is T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValid(parsed)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return initial;
}

export function createPersistentStore<T>(name: string, initial: T, isValid: (v: unknown) => v is T): PersistentStore<T> {
  const key = KEY_PREFIX + name;
  let value = read(key, initial, isValid);
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key !== key) return;
      value = read(key, initial, isValid);
      notify();
    });
  }

  const set = (next: T) => {
    value = next;
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(next));
    } catch {
      /* memory only */
    }
    notify();
  };

  return {
    get: () => value,
    set,
    // Re-read before writing so a change made in another tab is not overwritten.
    update: (fn) => set(fn(read(key, value, isValid))),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const isArray = <T>(v: unknown): v is T[] => Array.isArray(v);
export const isObject = <T>(v: unknown): v is T => typeof v === 'object' && v !== null && !Array.isArray(v);

export { newId } from '../../domain/ids';
