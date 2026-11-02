import { EnginePolicyError, normalizeInput } from './policy';
import type { EngineInput, EngineStatus, EngineStorage, PackagedList } from './types';

export interface EngineDriver {
  initialize(): Promise<void>;
  preflight(input: EngineInput): Promise<void>;
  configure(input: EngineInput): Promise<void>;
}
export const CONFIRMED_STORAGE_KEY = 'bloku.engine.confirmed.v2';

/** Serializes every engine mutation, acknowledges only verified configurations,
 * and restores the last verified state after conversion/API/quota failure. */
export class EngineTransaction {
  private queue: Promise<unknown> = Promise.resolve();
  private initial?: Promise<void>;
  private status: EngineStatus = { ok: false, state: null, errors: [], restored: false, revision: 0 };

  constructor(private driver: EngineDriver, private lists: PackagedList[], private storage?: EngineStorage) {}

  getStatus(): EngineStatus { return structuredClone(this.status); }

  apply(input: EngineInput): Promise<EngineStatus> {
    const snapshot = structuredClone(input);
    const operation = this.queue.then(() => this.applyOne(snapshot));
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  private async initialize(): Promise<void> {
    await this.driver.initialize();
    const saved = await this.storage?.get(CONFIRMED_STORAGE_KEY);
    if (saved) {
      try { this.status.state = normalizeInput(saved as EngineInput, this.lists); } catch { /* Invalid legacy data is never applied. */ }
    }
  }

  private async applyOne(raw: EngineInput): Promise<EngineStatus> {
    let mutated = false;
    try {
      this.initial ??= this.initialize();
      await this.initial;
      const input = normalizeInput(raw, this.lists);
      await this.driver.preflight(input);
      mutated = true;
      await this.driver.configure(input);
      await this.storage?.set(CONFIRMED_STORAGE_KEY, input);
      this.status = { ok: true, state: input, errors: [], restored: false, revision: this.status.revision + 1 };
    } catch (error) {
      const issue = error instanceof EnginePolicyError
        ? { code: error.code, message: error.message, line: error.line }
        : { code: 'engine-apply-failed', message: error instanceof Error ? error.message : 'Engine configuration failed.' };
      let restored = !mutated && this.status.state !== null;
      const errors = [issue];
      if (mutated && this.status.state) {
        try { await this.driver.configure(this.status.state); restored = true; } catch {
          errors.push({ code: 'engine-restore-failed', message: 'The previous filtering state could not be verified. Protection needs attention.' });
          this.status.state = null;
        }
      }
      this.status = { ...this.status, ok: false, errors, restored };
    }
    return this.getStatus();
  }
}
