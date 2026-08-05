import { CheckForUpdatesUseCase } from './usecases/CheckForUpdatesUseCase';
import { ForceTriggerUpdateUseCase } from './usecases/ForceTriggerUpdateUseCase';
import { ResetIgnoredVersionsUseCase } from './usecases/ResetIgnoredVersionsUseCase';
import type { DecisionEngine } from './engines/decision/DecisionEngine';
import type { IUpdatePolicyEngine } from './engines/policy/IUpdatePolicyEngine';
import type { IVersionComparator } from './engines/semver/IVersionComparator';
import { ActionType } from './models/ActionPlan';
import type { ActionPlan } from './models/ActionPlan';
import type {
  StateChangedEvent,
  UpdateDetectedEvent,
  UserActionEvent,
  VersionManagerErrorEvent,
  VersionManagerEventMap,
} from './models/Events';
import { LifecycleState } from './models/LifecycleState';
import type {
  CheckForUpdatesOptions,
  ForceTriggerOptions,
  ResetIgnoredVersionsOptions,
} from './models/PublicApiOptions';
import type { RemoteVersionInfo } from './models/RemoteVersionInfo';
import type { ResolvedVersionManagerConfig } from './models/VersionManagerOptions';
import type { UpdateInfo } from './models/UpdateInfo';
import type { Unsubscribe } from './models/Unsubscribe';
import {
  NotReadyException,
  isConfigTierException,
  toVersionManagerException,
} from './errors/VersionManagerException';
import type { VersionManagerException } from './errors/VersionManagerException';
import type { IVersionManagerCore } from './IVersionManagerCore';
import type { IClock } from './ports/IClock';
import type { IConfigProvider } from './ports/IConfigProvider';
import type { IPlatformBridge } from './ports/IPlatformBridge';
import type { IVersionRepository } from './ports/IVersionRepository';
import type { IEventBus } from '../shared/eventbus/EventBus';
import {
  InvalidTransitionError,
  LifecycleStateMachine,
} from './statemachine/LifecycleStateMachine';
import type { ILifecycleStateMachine } from './statemachine/LifecycleStateMachine';
import type { VersionManagerOptions } from './models/VersionManagerOptions';

/**
 * WorkManager unique-work name / iOS scheduleBackgroundCheck taskId param (doc 04 §2).
 * Unrelated to Android's headless-JS-task name ("VersionCheckBackgroundTask", declared
 * natively in VersionCheckHeadlessTaskService.TASK_NAME and matched by
 * registerVersionCheckHeadlessTask() in src/backgroundTask.ts) — this id only identifies
 * the scheduled work request itself.
 */
const BACKGROUND_CHECK_TASK_ID = 'com.rsnativekit.versioncheck.backgroundCheck';

export interface VersionManagerCoreDeps {
  /** Tier-4-only synchronous resolution (doc 02 §1.3 fail-fast) — used to bootstrap
   * before configProvider's full async pipeline (doc 03) resolves, and as the
   * always-available fallback floor. */
  readonly config: ResolvedVersionManagerConfig;
  readonly rawOptions: VersionManagerOptions;
  readonly platformBridge: IPlatformBridge;
  readonly repository: IVersionRepository;
  readonly comparator: IVersionComparator;
  readonly policyEngine: IUpdatePolicyEngine;
  readonly decisionEngine: DecisionEngine;
  readonly eventBus: IEventBus<VersionManagerEventMap>;
  readonly clock: IClock;
  readonly stateMachine?: ILifecycleStateMachine;
  /** Doc 03 full local/remote/env resolution pipeline — optional so tests/simple
   * wiring can omit it and run on tier-4-only config, same as before this pass. */
  readonly configProvider?: IConfigProvider;
}

/**
 * The concrete IVersionManagerCore. Composed entirely from ports and other domain
 * constructs (Prompt 1 §1.3) — every concrete adapter (repository impl, platform
 * bridge impl) is injected by src/di/container.ts, never imported here directly.
 */
export class VersionManagerCore implements IVersionManagerCore {
  private readonly deps: VersionManagerCoreDeps;
  private readonly stateMachine: ILifecycleStateMachine;
  private readonly checkUseCase: CheckForUpdatesUseCase;
  private readonly resetUseCase: ResetIgnoredVersionsUseCase;
  private readonly forceUseCase: ForceTriggerUpdateUseCase;

  private readonly readyPromise: Promise<void>;
  /**
   * Mutable, doc 03 §4.4 "hot-update" target — starts at the tier-4-only sync
   * resolution and is replaced (not merged in place — a fresh immutable object each
   * time) once configProvider's full pipeline resolves, and again on every subsequent
   * subscribe() notification. In-flight operations keep whatever reference they already
   * captured; only the *next* operation observes an update, matching §4.4's guarantee.
   */
  private currentConfig: ResolvedVersionManagerConfig;
  private lastActionPlan: ActionPlan | null = null;
  private lastCheckedAt: number | null = null;
  private inFlightCheck: Promise<ActionPlan> | null = null;
  /**
   * Non-persisted rollout bucket (0-99), stable for the process lifetime only.
   * A device-stable bucket derived from a persisted installation id is Prompt 18
   * scope — this is a documented simplification, not the final design.
   */
  private rolloutBucket: number | null = null;

  constructor(deps: VersionManagerCoreDeps) {
    this.deps = deps;
    this.currentConfig = deps.config;
    this.stateMachine = deps.stateMachine ?? new LifecycleStateMachine();

    this.checkUseCase = new CheckForUpdatesUseCase({
      repository: deps.repository,
      comparator: deps.comparator,
      policyEngine: deps.policyEngine,
      decisionEngine: deps.decisionEngine,
      clock: deps.clock,
    });
    this.resetUseCase = new ResetIgnoredVersionsUseCase(deps.repository);
    this.forceUseCase = new ForceTriggerUpdateUseCase(
      deps.repository,
      deps.decisionEngine
    );

    this.readyPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    this.tryTransition(LifecycleState.CONFIG_LOADING);

    // Doc 03 §4 full precedence resolution (env > remote > local > default) — runs
    // during CONFIG_LOADING per doc 02 §7's sequence diagram. A failure here never
    // fails initialization (doc 02 §7's "Initialization only ever hard-fails on VM-1xxx
    // config codes, which reject before an instance is ever returned" — this is
    // *post*-construction, so it degrades to the already-valid tier-4 config instead).
    if (this.deps.configProvider) {
      try {
        this.currentConfig = await this.deps.configProvider.resolve(
          this.deps.rawOptions
        );
      } catch (error) {
        this.publishError(toVersionManagerException(error), 'config');
      }
      this.deps.configProvider.subscribe((config) => {
        // §4.4 hot-update: only the *next* operation observes this — in-flight work
        // already captured the previous currentConfig reference by value.
        this.currentConfig = config;
      });
    }

    try {
      // Warm start: prime/validate the cache read path. The first checkForUpdates()
      // call is what actually turns cached data into a decision (it needs the
      // current app version, resolved asynchronously from the platform bridge).
      await this.deps.repository.getCachedVersionInfo();
    } catch (error) {
      this.publishError(toVersionManagerException(error), 'config');
    }

    // backgroundCheck.* is tier-4-only (never touched by remote/local/env overlays,
    // see ConfigResolutionPipeline's mergeConfig), so it's safe to apply exactly once
    // here rather than re-applying on every hot-update notification.
    try {
      await this.applyBackgroundCheckConfig();
    } catch (error) {
      this.publishError(toVersionManagerException(error), 'config');
    }

    this.tryTransition(LifecycleState.IDLE);
  }

  /**
   * Doc 04 §2 — starts/stops the native OS-scheduled periodic check
   * (WorkManager/BGTaskScheduler via IPlatformBridge.scheduler) based on
   * VersionManagerOptions.backgroundCheck. `onFire` only has an effect on platforms
   * where a scheduled tick can re-enter this same running instance (Web); native
   * re-entry happens through a separate JS context (Android's headless task via
   * registerVersionCheckHeadlessTask(), iOS's host-registered BGTaskScheduler launch
   * handler) and ignores it.
   */
  private async applyBackgroundCheckConfig(): Promise<void> {
    const { enabled, minIntervalMs } = this.currentConfig.backgroundCheck;
    if (!enabled) {
      await this.deps.platformBridge.scheduler.cancel(BACKGROUND_CHECK_TASK_ID);
      return;
    }
    await this.deps.platformBridge.scheduler.schedule(
      { taskId: BACKGROUND_CHECK_TASK_ID, minIntervalMs },
      () => {
        void this.checkForUpdates({ bypassCache: false });
      }
    );
  }

  ready(): Promise<void> {
    return this.readyPromise;
  }

  async checkForUpdates(
    options: CheckForUpdatesOptions = {}
  ): Promise<ActionPlan> {
    if (
      this.currentConfig.strictReadiness &&
      this.stateMachine.current === LifecycleState.CONFIG_LOADING
    ) {
      throw new NotReadyException({
        message: 'checkForUpdates() called before ready() resolved',
      });
    }
    await this.readyPromise;

    if (this.inFlightCheck) {
      return this.inFlightCheck;
    }

    const promise = this.runCheck(options).finally(() => {
      this.inFlightCheck = null;
    });
    this.inFlightCheck = promise;
    return promise;
  }

  private async runCheck(options: CheckForUpdatesOptions): Promise<ActionPlan> {
    this.tryTransition(LifecycleState.VERSION_CHECKING);

    const [currentVersion, bundleId] = await Promise.all([
      this.resolveCurrentVersion(),
      this.deps.platformBridge.appInfo.getBundleId(),
    ]);

    try {
      const plan = await this.checkUseCase.execute({
        currentVersion,
        bundleId,
        platform: this.deps.platformBridge.platform,
        bypassCache:
          options.bypassCache ?? this.currentConfig.cache.bustOnManualCheck,
        timeoutMs:
          options.timeoutMs ?? this.currentConfig.fallback.requestTimeoutMs,
        forceUpdateBelow: this.currentConfig.policy.forceUpdateBelow,
        rolloutPercentage: this.currentConfig.policy.rolloutPercentage,
        rolloutBucket: this.getRolloutBucket(),
      });
      this.applyPlan(plan, currentVersion);
      return plan;
    } catch (error) {
      const vmError = toVersionManagerException(error);
      if (isConfigTierException(vmError)) {
        this.tryTransition(LifecycleState.IDLE);
        throw vmError;
      }
      return this.runFallback(vmError, currentVersion);
    }
  }

  private async runFallback(
    error: VersionManagerException,
    currentVersion: string
  ): Promise<ActionPlan> {
    this.publishError(error, 'check');

    let remote: RemoteVersionInfo | null = null;
    const strategy = this.currentConfig.fallback.onNetworkError;
    if (strategy === 'useCache') {
      remote = await this.deps.repository
        .getCachedVersionInfo()
        .catch(() => null);
    } else if (strategy === 'useDefaultConfig') {
      remote = this.currentConfig.fallback.defaultConfig;
    }

    const plan: ActionPlan = remote
      ? this.deps.decisionEngine.buildActionPlan(
          ActionType.NO_ACTION,
          currentVersion,
          remote
        )
      : {
          type: ActionType.NO_ACTION,
          updateInfo: null,
          reason: 'fallback',
          decidedAt: this.deps.clock.now(),
        };

    this.applyPlan(plan, currentVersion);
    return plan;
  }

  private applyPlan(plan: ActionPlan, currentVersion: string): void {
    this.lastActionPlan = plan;
    this.lastCheckedAt = this.deps.clock.now();
    this.tryTransition(LifecycleState.DECIDING);

    const targetState = this.stateForActionType(plan.type);
    this.tryTransition(targetState);

    if (plan.updateInfo) {
      const event: UpdateDetectedEvent = {
        updateInfo: plan.updateInfo,
        actionPlan: plan,
        timestamp: this.deps.clock.now(),
      };
      this.deps.eventBus.publish('updateDetected', event);
    } else {
      this.deps.eventBus.publish('updateNotAvailable', {
        currentVersion,
        checkedAt: this.deps.clock.now(),
      });
    }
  }

  private stateForActionType(type: ActionType): LifecycleState {
    switch (type) {
      case ActionType.FORCE_UPDATE:
        return LifecycleState.FORCE_UPDATE_DISPLAYED;
      case ActionType.SOFT_UPDATE:
      case ActionType.OPTIONAL_REMINDER:
        return LifecycleState.SOFT_UPDATE_DISPLAYED;
      default:
        return LifecycleState.IDLE;
    }
  }

  async forceTriggerUpdate(_options: ForceTriggerOptions = {}): Promise<void> {
    await this.readyPromise;
    const [currentVersion, bundleId] = await Promise.all([
      this.resolveCurrentVersion(),
      this.deps.platformBridge.appInfo.getBundleId(),
    ]);

    try {
      const plan = await this.forceUseCase.execute({
        currentVersion,
        bundleId,
        platform: this.deps.platformBridge.platform,
        timeoutMs: this.currentConfig.fallback.requestTimeoutMs,
      });
      this.applyPlan(plan, currentVersion);
    } catch (error) {
      this.publishError(toVersionManagerException(error), 'check');
    }
  }

  async resetIgnoredVersions(
    options: ResetIgnoredVersionsOptions = {}
  ): Promise<void> {
    await this.resetUseCase.execute(options.versions);
  }

  getCurrentState(): LifecycleState {
    return this.stateMachine.current;
  }

  getUpdateInfo(): UpdateInfo | null {
    return this.lastActionPlan?.updateInfo ?? null;
  }

  isUpdateAvailable(): boolean {
    return (
      this.lastActionPlan !== null &&
      this.lastActionPlan.type !== ActionType.NO_ACTION
    );
  }

  getActionPlan(): ActionPlan | null {
    return this.lastActionPlan;
  }

  getLastCheckedAt(): number | null {
    return this.lastCheckedAt;
  }

  on<K extends keyof VersionManagerEventMap>(
    event: K,
    handler: (payload: VersionManagerEventMap[K]) => void
  ): Unsubscribe {
    return this.deps.eventBus.subscribe(event, handler);
  }

  once<K extends keyof VersionManagerEventMap>(
    event: K,
    handler: (payload: VersionManagerEventMap[K]) => void
  ): Unsubscribe {
    const unsubscribe = this.deps.eventBus.subscribe(event, (payload) => {
      unsubscribe();
      handler(payload);
    });
    return unsubscribe;
  }

  off<K extends keyof VersionManagerEventMap>(
    event: K,
    handler: (payload: VersionManagerEventMap[K]) => void
  ): void {
    // Removes a handler registered via on(event, handler) by reference, in addition to
    // (not instead of) the Unsubscribe closure returned from on()/once() — both styles
    // are safe to mix (Prompt 2 §4.2). Handlers wrapped internally by once() are not
    // reachable here since once() never hands the wrapped function back to the caller;
    // its own Unsubscribe closure is the only way to remove a once() handler early.
    this.deps.eventBus.off(event, handler);
  }

  onUpdateDetected(handler: (e: UpdateDetectedEvent) => void): Unsubscribe {
    return this.on('updateDetected', handler);
  }

  onUserAction(handler: (e: UserActionEvent) => void): Unsubscribe {
    return this.on('userAction', handler);
  }

  onError(handler: (e: VersionManagerErrorEvent) => void): Unsubscribe {
    return this.on('error', handler);
  }

  onStateChanged(handler: (e: StateChangedEvent) => void): Unsubscribe {
    return this.on('stateChanged', handler);
  }

  dispose(): void {
    this.tryTransition(LifecycleState.TERMINATED);
  }

  private async resolveCurrentVersion(): Promise<string> {
    return (
      this.currentConfig.appVersion ??
      this.deps.platformBridge.appInfo.getCurrentVersion()
    );
  }

  private getRolloutBucket(): number {
    if (this.rolloutBucket === null) {
      this.rolloutBucket = Math.floor(Math.random() * 100);
    }
    return this.rolloutBucket;
  }

  private publishError(
    error: VersionManagerException,
    phase: VersionManagerErrorEvent['phase']
  ): void {
    this.deps.eventBus.publish('error', {
      error,
      phase,
      timestamp: this.deps.clock.now(),
    });
  }

  private tryTransition(to: LifecycleState): void {
    const from = this.stateMachine.current;
    if (from === to) return;
    try {
      this.stateMachine.transition(to);
    } catch (error) {
      if (error instanceof InvalidTransitionError) {
        // Some manual-trigger call paths (e.g. checkForUpdates() while a dialog from a
        // previous check is still displayed) do not have a modeled edge in the Prompt 9
        // transition table yet. Rather than throw out of a public API method for an
        // internal invariant, this is logged and the state machine is left untouched.
        return;
      }
      throw error;
    }
    const event: StateChangedEvent = {
      from,
      to,
      timestamp: this.deps.clock.now(),
    };
    this.deps.eventBus.publish('stateChanged', event);
  }
}
