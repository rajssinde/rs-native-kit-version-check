import type { ActionPlan } from './models/ActionPlan';
import type {
  StateChangedEvent,
  UpdateDetectedEvent,
  UserActionEvent,
  VersionManagerErrorEvent,
  VersionManagerEventMap,
} from './models/Events';
import type { LifecycleState } from './models/LifecycleState';
import type {
  CheckForUpdatesOptions,
  ForceTriggerOptions,
  ResetIgnoredVersionsOptions,
} from './models/PublicApiOptions';
import type { UpdateInfo } from './models/UpdateInfo';
import type { Unsubscribe } from './models/Unsubscribe';

/** Public event subscription surface (Prompt 2 §4.2). */
export interface IVersionManagerEvents {
  on<K extends keyof VersionManagerEventMap>(
    event: K,
    handler: (payload: VersionManagerEventMap[K]) => void
  ): Unsubscribe;
  once<K extends keyof VersionManagerEventMap>(
    event: K,
    handler: (payload: VersionManagerEventMap[K]) => void
  ): Unsubscribe;
  off<K extends keyof VersionManagerEventMap>(
    event: K,
    handler: (payload: VersionManagerEventMap[K]) => void
  ): void;

  onUpdateDetected(handler: (e: UpdateDetectedEvent) => void): Unsubscribe;
  onUserAction(handler: (e: UserActionEvent) => void): Unsubscribe;
  onError(handler: (e: VersionManagerErrorEvent) => void): Unsubscribe;
  onStateChanged(handler: (e: StateChangedEvent) => void): Unsubscribe;
}

/** The single class Domain exposes outward (Prompt 1 §3; full spec in Prompt 2). */
export interface IVersionManagerCore extends IVersionManagerEvents {
  ready(): Promise<void>;

  checkForUpdates(options?: CheckForUpdatesOptions): Promise<ActionPlan>;
  forceTriggerUpdate(options?: ForceTriggerOptions): Promise<void>;
  resetIgnoredVersions(options?: ResetIgnoredVersionsOptions): Promise<void>;

  getCurrentState(): LifecycleState;
  getUpdateInfo(): UpdateInfo | null;
  isUpdateAvailable(): boolean;
  getActionPlan(): ActionPlan | null;
  getLastCheckedAt(): number | null;

  dispose(): void;
}
