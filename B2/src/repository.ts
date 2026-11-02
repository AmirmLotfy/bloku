import { migrateStorage, validateState, V2_STORAGE_KEY, type LocalStorage } from './migration';
import type { StateV2 } from './model';
/** A single queue protects settings against concurrent popup, alarm and context-menu writes. */
export function createRepository(storage: LocalStorage) {
  let queue: Promise<unknown> = Promise.resolve();
  let loaded: StateV2 | null = null;
  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation, operation);
    queue = result.catch(() => undefined);
    return result;
  }
  async function load() { loaded ??= await migrateStorage(storage); return structuredClone(loaded); }
  return {
    get: () => serialize(load),
    update: (change: (state: StateV2) => StateV2 | Promise<StateV2>) => serialize(async () => {
      const previous = await load();
      const next = await change(structuredClone(previous));
      validateState(next);
      await storage.set({[V2_STORAGE_KEY]:next});
      loaded = structuredClone(next);
      return structuredClone(next);
    }),
  };
}
