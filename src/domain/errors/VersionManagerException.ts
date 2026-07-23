export type VersionManagerErrorCode =
  | 'VM-1001' // InvalidConfigException
  | 'VM-1002' // NotInitializedException
  | 'VM-1003' // NotReadyException
  | 'VM-1004' // SchemaValidationException
  | 'VM-1005' // BoundaryValidationException
  | 'VM-1006' // SignatureVerificationException
  | 'VM-1007' // ConfigSizeLimitExceededException
  | 'VM-1008' // UntrustedKeyIdException
  | 'VM-1009' // EnvironmentOverrideConflictException
  | 'VM-2001' // RequestTimeoutException
  | 'VM-2002' // RateLimitException
  | 'VM-2003' // OfflineException
  | 'VM-2004' // TlsHandshakeException
  | 'VM-3001' // AppNotFoundException
  | 'VM-3002' // StorePermissionException
  | 'VM-3003' // UnsupportedStoreException
  | 'VM-3004' // StoreResponseParseException
  | 'VM-4001' // InvalidVersionFormatException
  | 'VM-5001' // PolicyEvaluationException
  | 'VM-6001' // CacheCorruptionException
  | 'VM-6002' // CacheWriteException
  | 'VM-7001' // PlatformBridgeException
  | 'VM-9999'; // UnknownVersionManagerException

export interface VersionManagerExceptionInit {
  message: string;
  cause?: unknown;
  metadata?: Record<string, unknown>;
  retryable?: boolean;
}

export abstract class VersionManagerException extends Error {
  abstract readonly code: VersionManagerErrorCode;
  readonly cause: unknown;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly retryable: boolean;
  readonly timestamp: number;

  constructor(init: VersionManagerExceptionInit) {
    super(init.message);
    this.name = new.target.name;
    this.cause = init.cause;
    this.metadata = Object.freeze({ ...init.metadata });
    this.retryable = init.retryable ?? false;
    this.timestamp = Date.now();
  }
}

export class InvalidConfigException extends VersionManagerException {
  readonly code = 'VM-1001' as const;
}

export class NotInitializedException extends VersionManagerException {
  readonly code = 'VM-1002' as const;
}

export class NotReadyException extends VersionManagerException {
  readonly code = 'VM-1003' as const;
}

export class SchemaValidationException extends VersionManagerException {
  readonly code = 'VM-1004' as const;
}

export class BoundaryValidationException extends VersionManagerException {
  readonly code = 'VM-1005' as const;
}

export class SignatureVerificationException extends VersionManagerException {
  readonly code = 'VM-1006' as const;
}

export class ConfigSizeLimitExceededException extends VersionManagerException {
  readonly code = 'VM-1007' as const;
}

export class UntrustedKeyIdException extends VersionManagerException {
  readonly code = 'VM-1008' as const;
}

export class EnvironmentOverrideConflictException extends VersionManagerException {
  readonly code = 'VM-1009' as const;
}

export abstract class NetworkException extends VersionManagerException {}

export class RequestTimeoutException extends NetworkException {
  readonly code = 'VM-2001' as const;
  override readonly retryable = true;
}

export class RateLimitException extends NetworkException {
  readonly code = 'VM-2002' as const;
  override readonly retryable = true;
}

export class OfflineException extends NetworkException {
  readonly code = 'VM-2003' as const;
  override readonly retryable = true;
}

export class TlsHandshakeException extends NetworkException {
  readonly code = 'VM-2004' as const;
}

export abstract class StoreProviderException extends VersionManagerException {}

export class AppNotFoundException extends StoreProviderException {
  readonly code = 'VM-3001' as const;
}

export class StorePermissionException extends StoreProviderException {
  readonly code = 'VM-3002' as const;
}

export class UnsupportedStoreException extends StoreProviderException {
  readonly code = 'VM-3003' as const;
}

export class StoreResponseParseException extends StoreProviderException {
  readonly code = 'VM-3004' as const;
}

export class InvalidVersionFormatException extends VersionManagerException {
  readonly code = 'VM-4001' as const;
}

export class PolicyEvaluationException extends VersionManagerException {
  readonly code = 'VM-5001' as const;
}

export abstract class CacheException extends VersionManagerException {}

export class CacheCorruptionException extends CacheException {
  readonly code = 'VM-6001' as const;
}

export class CacheWriteException extends CacheException {
  readonly code = 'VM-6002' as const;
  override readonly retryable = true;
}

export class PlatformBridgeException extends VersionManagerException {
  readonly code = 'VM-7001' as const;
}

export class UnknownVersionManagerException extends VersionManagerException {
  readonly code = 'VM-9999' as const;
}

export function toVersionManagerException(
  error: unknown
): VersionManagerException {
  if (error instanceof VersionManagerException) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new UnknownVersionManagerException({ message, cause: error });
}

export function isConfigTierException(
  error: unknown
): error is VersionManagerException {
  return (
    error instanceof VersionManagerException && error.code.startsWith('VM-1')
  );
}
