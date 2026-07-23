import type { StoreProviderId } from '../../domain/models/PlatformId';
import type {
  StoreLookupRequest,
  StoreLookupResult,
} from '../../domain/models/StoreLookup';
import type { IStoreProvider } from '../../domain/ports/IStoreProvider';

/** Simulates success, or any canned failure, from a store lookup (Prompt 1 §11.1). */
export class MockStoreProvider implements IStoreProvider {
  readonly id: StoreProviderId;
  private readonly result: StoreLookupResult | (() => StoreLookupResult);
  private readonly error: Error | null;

  constructor(
    options: {
      id?: StoreProviderId;
      result?: StoreLookupResult | (() => StoreLookupResult);
      error?: Error;
    } = {}
  ) {
    this.id = options.id ?? 'custom';
    this.result =
      options.result ??
      (() => ({
        latestVersion: '1.0.0',
        storeUrl: 'https://example.com',
        releaseNotes: null,
        minimumOsVersion: null,
      }));
    this.error = options.error ?? null;
  }

  async fetchLatestVersionInfo(
    _request: StoreLookupRequest
  ): Promise<StoreLookupResult> {
    if (this.error) throw this.error;
    return typeof this.result === 'function' ? this.result() : this.result;
  }
}
