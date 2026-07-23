import {
  toVersionManagerException,
  UnsupportedStoreException,
} from '../../domain/errors/VersionManagerException';
import type {
  RemoteVersionInfo,
  UserVersionDecision,
  VersionCheckRequest,
} from '../../domain/models/RemoteVersionInfo';
import type { ICacheStore } from '../../domain/ports/ICacheStore';
import type { IClock } from '../../domain/ports/IClock';
import type { IKeyValueStorage } from '../../domain/ports/IPlatformBridge';
import type { IStoreProvider } from '../../domain/ports/IStoreProvider';
import type { IVersionRepository } from '../../domain/ports/IVersionRepository';

const REMOTE_INFO_CACHE_KEY = 'remote-version-info';
const USER_DECISION_STORAGE_KEY = 'vm_user_decision';

/**
 * Sequential fallback across registered providers (Prompt 14's simpler tier): the first
 * provider to succeed wins. Only providers the host app actually registers via DI
 * reach this list — nothing here imports a provider it doesn't need (Prompt 1 §8).
 */
export class VersionRepositoryImpl implements IVersionRepository {
  constructor(
    private readonly providers: readonly IStoreProvider[],
    private readonly cache: ICacheStore<RemoteVersionInfo>,
    private readonly storage: IKeyValueStorage,
    private readonly clock: IClock
  ) {}

  async getRemoteVersionInfo(
    request: VersionCheckRequest
  ): Promise<RemoteVersionInfo> {
    if (!request.bypassCache) {
      const cached = await this.cache.get(REMOTE_INFO_CACHE_KEY);
      if (cached) return cached;
    }

    if (this.providers.length === 0) {
      throw new UnsupportedStoreException({
        message:
          'No store providers are registered — configure() must include at least one of stores.ios/.android/.custom/etc',
      });
    }

    let lastError: unknown = null;
    for (const provider of this.providers) {
      try {
        const result = await provider.fetchLatestVersionInfo({
          bundleId: request.bundleId,
          region: null,
          timeoutMs: request.timeoutMs,
        });
        const info: RemoteVersionInfo = {
          latestVersion: result.latestVersion,
          storeUrl: result.storeUrl,
          releaseNotes: result.releaseNotes,
          minimumOsVersion: result.minimumOsVersion,
          fetchedAt: this.clock.now(),
          provider: provider.id,
        };
        await this.cache.set(REMOTE_INFO_CACHE_KEY, info);
        return info;
      } catch (error) {
        lastError = error;
      }
    }

    throw toVersionManagerException(lastError);
  }

  async getCachedVersionInfo(): Promise<RemoteVersionInfo | null> {
    return this.cache.get(REMOTE_INFO_CACHE_KEY);
  }

  async persistUserDecision(decision: UserVersionDecision): Promise<void> {
    await this.storage.set(USER_DECISION_STORAGE_KEY, JSON.stringify(decision));
  }

  async getUserDecision(): Promise<UserVersionDecision | null> {
    const raw = await this.storage.get(USER_DECISION_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserVersionDecision;
    } catch {
      return null;
    }
  }
}
