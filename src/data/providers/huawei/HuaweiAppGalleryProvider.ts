import { UnsupportedStoreException } from '../../../domain/errors/VersionManagerException';
import type { StoreProviderId } from '../../../domain/models/PlatformId';
import type { StoreLookupResult } from '../../../domain/models/StoreLookup';
import type { IStoreProvider } from '../../../domain/ports/IStoreProvider';

/**
 * Not yet implemented — Huawei AppGallery integration is designed in Prompt 11 of this
 * series (AG Connect API parameters, error-code mapping) but not built in this pass.
 * The file exists so the provider is independently importable/tree-shakeable
 * (Prompt 1 §8) without pulling in Apple/Google/Custom code.
 */
export class HuaweiAppGalleryProvider implements IStoreProvider {
  readonly id: StoreProviderId = 'huawei';

  async fetchLatestVersionInfo(): Promise<StoreLookupResult> {
    throw new UnsupportedStoreException({
      message:
        'Huawei AppGallery provider is not yet implemented — see Prompt 11 in the design series',
    });
  }
}
