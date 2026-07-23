import type { StoreProviderId } from '../models/PlatformId';
import type {
  StoreLookupRequest,
  StoreLookupResult,
} from '../models/StoreLookup';

export interface IStoreProvider {
  readonly id: StoreProviderId;
  fetchLatestVersionInfo(
    request: StoreLookupRequest
  ): Promise<StoreLookupResult>;
}
