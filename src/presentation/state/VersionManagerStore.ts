import type { ActionPlan } from '../../domain/models/ActionPlan';
import type { LifecycleState } from '../../domain/models/LifecycleState';
import type { UpdateInfo } from '../../domain/models/UpdateInfo';
import type { Unsubscribe } from '../../domain/models/Unsubscribe';
import type { IVersionManagerCore } from '../../domain/IVersionManagerCore';

export interface VersionManagerUiState {
  readonly lifecycleState: LifecycleState;
  readonly updateInfo: UpdateInfo | null;
  readonly actionPlan: ActionPlan | null;
  readonly isUpdateAvailable: boolean;
}

function snapshotFrom(core: IVersionManagerCore): VersionManagerUiState {
  return {
    lifecycleState: core.getCurrentState(),
    updateInfo: core.getUpdateInfo(),
    actionPlan: core.getActionPlan(),
    isUpdateAvailable: core.isUpdateAvailable(),
  };
}

/**
 * The single reactive source of truth the Hooks adapter renders from (Prompt 1 §6) —
 * components subscribe to this store, never to the core's event bus directly. Kept in
 * sync by re-snapshotting the core on every event it emits.
 */
export class VersionManagerStore {
  private state: VersionManagerUiState;
  private readonly listeners = new Set<
    (state: Readonly<VersionManagerUiState>) => void
  >();
  private readonly detach: Unsubscribe;

  constructor(private readonly core: IVersionManagerCore) {
    this.state = snapshotFrom(core);

    const unsubscribers = [
      core.onStateChanged(() => this.sync()),
      core.onUpdateDetected(() => this.sync()),
      core.on('updateNotAvailable', () => this.sync()),
    ];
    this.detach = () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }

  getState(): Readonly<VersionManagerUiState> {
    return this.state;
  }

  subscribe(
    listener: (state: Readonly<VersionManagerUiState>) => void
  ): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.detach();
    this.listeners.clear();
  }

  private sync(): void {
    this.state = snapshotFrom(this.core);
    for (const listener of Array.from(this.listeners)) {
      listener(this.state);
    }
  }
}
