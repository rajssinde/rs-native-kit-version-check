import type {
  RemoteVersionInfo,
  UserVersionDecision,
  VersionCheckRequest,
} from '../models/RemoteVersionInfo';

export interface IVersionRepository {
  getRemoteVersionInfo(
    request: VersionCheckRequest
  ): Promise<RemoteVersionInfo>;
  getCachedVersionInfo(): Promise<RemoteVersionInfo | null>;
  persistUserDecision(decision: UserVersionDecision): Promise<void>;
  getUserDecision(): Promise<UserVersionDecision | null>;
}
