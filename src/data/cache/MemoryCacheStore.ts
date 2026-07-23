import type { ICacheStore } from '../../domain/ports/ICacheStore';
import type { IClock } from '../../domain/ports/IClock';

interface Entry<T> {
  readonly value: T;
  readonly expiresAt: number | null;
}

export class MemoryCacheStore<T> implements ICacheStore<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(
    private readonly clock: IClock,
    private readonly defaultTtlMs: number
  ) {}

  async get(key: string): Promise<T | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && this.clock.now() > entry.expiresAt) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: T, ttlMs?: number): Promise<void> {
    const ttl = ttlMs ?? this.defaultTtlMs;
    const expiresAt = ttl > 0 ? this.clock.now() + ttl : null;
    this.entries.set(key, { value, expiresAt });
  }

  async invalidate(key: string): Promise<void> {
    this.entries.delete(key);
  }
}
