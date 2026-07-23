import type { ConfigLoadRequest } from '../models/ConfigDocument';
import type {
  ResolvedVersionManagerConfig,
  VersionManagerOptions,
} from '../models/VersionManagerOptions';
import type { Unsubscribe } from './IPlatformBridge';

export interface IConfigProvider {
  resolve(
    defaults: VersionManagerOptions
  ): Promise<ResolvedVersionManagerConfig>;
  /** Doc 03 §0's named surface (`load(request)`) — delegates to resolve(request.defaults). */
  load(request: ConfigLoadRequest): Promise<ResolvedVersionManagerConfig>;
  /** Fires when a later resolution (e.g. a remote refresh) produces a changed config. */
  subscribe(
    listener: (config: ResolvedVersionManagerConfig) => void
  ): Unsubscribe;
}
