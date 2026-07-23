import {
  CacheCorruptionException,
  CacheWriteException,
} from '../../domain/errors/VersionManagerException';
import type { ICacheStore } from '../../domain/ports/ICacheStore';
import type { IClock } from '../../domain/ports/IClock';
import type { IKeyValueStorage } from '../../domain/ports/IPlatformBridge';

interface PersistedEntry<T> {
  readonly value: T;
  readonly expiresAt: number | null;
}

export class PersistentCacheStore<T> implements ICacheStore<T> {
  constructor(
    private readonly storage: IKeyValueStorage,
    private readonly clock: IClock,
    private readonly defaultTtlMs: number,
    private readonly keyPrefix: string = 'vm_cache_'
  ) {}

  async get(key: string): Promise<T | null> {
    const raw = await this.storage.get(this.keyPrefix + key);
    if (!raw) return null;

    let entry: PersistedEntry<T>;
    try {
      entry = JSON.parse(raw) as PersistedEntry<T>;
    } catch (error) {
      throw new CacheCorruptionException({
        message: `Corrupt persistent cache entry for key "${key}"`,
        cause: error,
        metadata: { key },
      });
    }

    if (entry.expiresAt !== null && this.clock.now() > entry.expiresAt) {
      await this.storage.remove(this.keyPrefix + key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: T, ttlMs?: number): Promise<void> {
    const ttl = ttlMs ?? this.defaultTtlMs;
    const expiresAt = ttl > 0 ? this.clock.now() + ttl : null;
    const entry: PersistedEntry<T> = { value, expiresAt };
    try {
      await this.storage.set(this.keyPrefix + key, JSON.stringify(entry));
    } catch (error) {
      throw new CacheWriteException({
        message: `Failed to persist cache entry for key "${key}"`,
        cause: error,
        retryable: true,
        metadata: { key },
      });
    }
  }

  async invalidate(key: string): Promise<void> {
    await this.storage.remove(this.keyPrefix + key);
  }
}
