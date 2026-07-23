import type { PlatformId, StoreProviderId } from './PlatformId';

export interface RemoteVersionInfo {
  readonly latestVersion: string;
  readonly storeUrl: string;
  readonly releaseNotes: string | null;
  readonly minimumOsVersion: string | null;
  readonly fetchedAt: number;
  readonly provider: StoreProviderId;
}

export interface VersionCheckRequest {
  readonly currentVersion: string;
  readonly bundleId: string;
  readonly platform: PlatformId;
  readonly bypassCache: boolean;
  readonly timeoutMs: number;
}

export interface UserVersionDecision {
  readonly ignoredVersions: readonly string[];
  readonly remindMeLaterUntil: number | null;
}
