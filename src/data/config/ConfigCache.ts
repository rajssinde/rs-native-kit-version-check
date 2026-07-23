import type { ResolvedVersionManagerConfig } from '../../domain/models/VersionManagerOptions';
import type { IConfigCache } from '../../domain/ports/IConfigSources';
import type { IKeyValueStorage } from '../../domain/ports/IPlatformBridge';

const STORAGE_KEY = 'vm_config_cache_v1';

/**
 * Doc 03 §4.3 — the persistent tier of the access-path cache (backs the in-process
 * memory cache across app restarts). Stores the last config that successfully passed
 * schema+boundary+signature validation, regardless of which tier produced it.
 */
export class ConfigCache implements IConfigCache {
  constructor(private readonly storage: IKeyValueStorage) {}

  async getLastValid(): Promise<ResolvedVersionManagerConfig | null> {
    const raw = await this.storage.get(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ResolvedVersionManagerConfig;
    } catch {
      // Corrupt config cache entry — treated as absent (§7.2 falls through to the next
      // tier), not surfaced as a hard failure of the config pipeline itself.
      return null;
    }
  }

  async setLastValid(config: ResolvedVersionManagerConfig): Promise<void> {
    await this.storage.set(STORAGE_KEY, JSON.stringify(config));
  }
}
