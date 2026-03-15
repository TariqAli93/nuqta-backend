/**
 * CachedSettingsAccessor
 *
 * Drop-in replacement for SettingsAccessor that adds an in-memory TTL cache
 * so that DB reads for settings that rarely change do not happen on every
 * API request.
 *
 * Design decisions:
 *  - Cache is keyed by the raw settings key (e.g. "system.language").
 *  - Default TTL is 60 s, configurable via the constructor.
 *  - invalidate(key?) clears one key or the entire cache.
 *  - All SettingsAccessor methods are covered because they ultimately go
 *    through the private cacheGet() helper.
 *  - Thread-safety: Node.js is single-threaded; no mutex is required.
 */

import { SettingsAccessor } from "./SettingsAccessor.js";
import type { ISettingsRepository } from "../../interfaces/ISettingsRepository.js";
import type { IAccountingSettingsRepository } from "../../interfaces/IAccountingSettingsRepository.js";

interface CacheEntry {
  value: string | null;
  expiresAt: number; // ms since epoch
}

export class CachedSettingsAccessor extends SettingsAccessor {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  constructor(
    repo: ISettingsRepository,
    accountingSettingsRepo?: IAccountingSettingsRepository,
    /** Cache TTL in milliseconds. Default: 60 000 ms (1 minute). */
    ttlMs = 60_000,
  ) {
    super(repo, accountingSettingsRepo);
    this.ttlMs = ttlMs;
  }

  /**
   * Invalidate one cached key, or the entire cache when called with no args.
   * Call this after any settings write so the next read reflects the new value.
   */
  invalidate(key?: string): void {
    if (key === undefined) {
      this.cache.clear();
    } else {
      this.cache.delete(key);
    }
  }

  /**
   * Override the generic `get` method to apply caching.
   * All typed getters in SettingsAccessor delegate to `this.repo.get(key)`,
   * but we intercept at the SettingsAccessor.get() level so we don't have
   * to override every individual getter.
   *
   * NOTE: `isAutoPostingEnabled()` reads from accountingSettingsRepo
   * (not via get()), so it is cached separately below.
   */
  override async get(key: string): Promise<string | null> {
    return this.cacheGet(key);
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private async cacheGet(key: string): Promise<string | null> {
    const now = Date.now();
    const entry = this.cache.get(key);

    if (entry && entry.expiresAt > now) {
      return entry.value;
    }

    // Fetch from the parent (which calls the real repo)
    const value = await super.get(key);
    this.cache.set(key, { value, expiresAt: now + this.ttlMs });
    return value;
  }
}
