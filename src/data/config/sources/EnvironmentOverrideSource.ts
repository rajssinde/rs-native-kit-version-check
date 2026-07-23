import type { VersionManagerConfigDocument } from '../../../domain/models/ConfigDocument';
import type { IEnvironmentOverrideSource } from '../../../domain/ports/IConfigSources';

/**
 * Doc 03 §4 — "there is no OS process environment on a device"; this tier maps to
 * build-time-injected constants and explicit runtime overrides, not `process.env` on a
 * server. Build-time constants (Info.plist / BuildConfig fields) are app-specific and
 * have no generic cross-platform read path from JS, so this implementation covers the
 * "explicit configure({ configSources: { envOverrides } })" half of §4.1 tier 1 — the
 * build-time-constant half is a per-app integration concern (documented, not a gap in
 * this port's contract, which only promises "read whatever overrides are available").
 */
export class EnvironmentOverrideSource implements IEnvironmentOverrideSource {
  constructor(
    private readonly overrides:
      Partial<VersionManagerConfigDocument> | undefined
  ) {}

  async read(): Promise<Partial<VersionManagerConfigDocument>> {
    return this.overrides ?? {};
  }
}
