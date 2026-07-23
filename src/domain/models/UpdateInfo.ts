import type { StoreProviderId } from './PlatformId';

export interface UpdateInfo {
  readonly currentVersion: string;
  readonly latestVersion: string;
  readonly storeUrl: string;
  readonly releaseNotes: string | null;
  readonly isForceUpdate: boolean;
  readonly provider: StoreProviderId;
  readonly fetchedAt: number;
}
