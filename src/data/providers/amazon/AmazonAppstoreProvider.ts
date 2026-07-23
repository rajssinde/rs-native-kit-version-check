import { UnsupportedStoreException } from '../../../domain/errors/VersionManagerException';
import type { StoreProviderId } from '../../../domain/models/PlatformId';
import type { StoreLookupResult } from '../../../domain/models/StoreLookup';
import type { IStoreProvider } from '../../../domain/ports/IStoreProvider';

/** Not yet implemented — see Prompt 11 in the design series. */
export class AmazonAppstoreProvider implements IStoreProvider {
  readonly id: StoreProviderId = 'amazon';

  async fetchLatestVersionInfo(): Promise<StoreLookupResult> {
    throw new UnsupportedStoreException({
      message:
        'Amazon Appstore provider is not yet implemented — see Prompt 11 in the design series',
    });
  }
}
