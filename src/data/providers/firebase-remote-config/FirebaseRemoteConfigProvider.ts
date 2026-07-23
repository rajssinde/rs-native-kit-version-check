import { UnsupportedStoreException } from '../../../domain/errors/VersionManagerException';
import type { StoreProviderId } from '../../../domain/models/PlatformId';
import type { StoreLookupResult } from '../../../domain/models/StoreLookup';
import type { IStoreProvider } from '../../../domain/ports/IStoreProvider';

/** Not yet implemented — see Prompt 13 in the design series. */
export class FirebaseRemoteConfigProvider implements IStoreProvider {
  readonly id: StoreProviderId = 'firebase-remote-config';

  async fetchLatestVersionInfo(): Promise<StoreLookupResult> {
    throw new UnsupportedStoreException({
      message:
        'Firebase Remote Config provider is not yet implemented — see Prompt 13 in the design series',
    });
  }
}
