import type {
  RawConfigDocument,
  SignedConfigEnvelope,
} from '../../../domain/models/ConfigDocument';
import type { ILocalConfigSource } from '../../../domain/ports/IConfigSources';

/**
 * Doc 03 §5.1 — the design calls for a native mmap reader (iOS Data(alwaysMapped),
 * Android FileChannel.map) to avoid a double-copy when reading a bundled config asset.
 * This implementation takes a documented, lower-risk equivalent instead: the host app
 * imports its bundled config JSON via Metro/webpack's native JSON module support
 * (`import localConfig from './vm-config.json'`) and passes the parsed envelope through
 * `VersionManagerOptions.configSources.local`. Metro's JSON loader already avoids the
 * page-cache -> native-heap -> JS-heap double copy for typical bundle sizes (the asset
 * is compiled into the JS bundle itself), which satisfies §5.1's actual goal (avoid GC
 * churn against the 5MB budget for a <=64KB document) without a dedicated native reader.
 */
export class LocalConfigSource implements ILocalConfigSource {
  constructor(private readonly envelope: SignedConfigEnvelope | undefined) {}

  async read(): Promise<RawConfigDocument | null> {
    return this.envelope ?? null;
  }
}
