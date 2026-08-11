// Public API entry point (core only — no React/UI code reachable from this path,
// see src/ui.tsx for the Hooks adapter). Prompt 2.

export { VersionManager, VersionManagerBuilder } from './publicApi';

export type {
  IVersionManagerCore,
  IVersionManagerEvents,
} from './domain/IVersionManagerCore';

export type { ActionPlan } from './domain/models/ActionPlan';
export { ActionType } from './domain/models/ActionPlan';
export type { ParsedVersion } from './domain/models/ParsedVersion';
export type { UpdateInfo } from './domain/models/UpdateInfo';
export { LifecycleState } from './domain/models/LifecycleState';
export type { PlatformId, StoreProviderId } from './domain/models/PlatformId';
export type {
  RemoteVersionInfo,
  UserVersionDecision,
  VersionCheckRequest,
} from './domain/models/RemoteVersionInfo';
export type { Unsubscribe } from './domain/models/Unsubscribe';
export type {
  CheckForUpdatesOptions,
  ForceTriggerOptions,
  ResetIgnoredVersionsOptions,
} from './domain/models/PublicApiOptions';
export type {
  BackgroundCheckOptions,
  CacheOptions,
  FallbackOptions,
  ILogSink,
  LogEntry,
  LoggingOptions,
  LogLevel,
  PolicyOptions,
  ResolvedVersionManagerConfig,
  RetryOptions,
  StoreLinksOptions,
  TargetingRule,
  VersionManagerOptions,
} from './domain/models/VersionManagerOptions';
export type {
  ErrorPhase,
  StateChangedEvent,
  UpdateDetectedEvent,
  UpdateNotAvailableEvent,
  UserActionEvent,
  UserActionType,
  VersionManagerErrorEvent,
  VersionManagerEventMap,
  VersionManagerEventType,
} from './domain/models/Events';

export type { IPlatformBridge } from './domain/ports/IPlatformBridge';

export {
  AppNotFoundException,
  BoundaryValidationException,
  CacheCorruptionException,
  CacheException,
  CacheWriteException,
  ConfigSizeLimitExceededException,
  EnvironmentOverrideConflictException,
  InvalidConfigException,
  InvalidVersionFormatException,
  NetworkException,
  NotInitializedException,
  NotReadyException,
  OfflineException,
  PlatformBridgeException,
  PolicyEvaluationException,
  RateLimitException,
  RequestTimeoutException,
  SchemaValidationException,
  SignatureVerificationException,
  StorePermissionException,
  StoreProviderException,
  StoreResponseParseException,
  TlsHandshakeException,
  UnknownVersionManagerException,
  UnsupportedStoreException,
  UntrustedKeyIdException,
  VersionManagerException,
} from './domain/errors/VersionManagerException';
export type { VersionManagerErrorCode } from './domain/errors/VersionManagerException';
