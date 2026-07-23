import { parseVersion } from '../../domain/engines/semver/SemVerEngine';
import { InvalidConfigException } from '../../domain/errors/VersionManagerException';
import type { VersionManagerOptions } from '../../domain/models/VersionManagerOptions';

/**
 * Boundary validation (Prompt 3 §2.2) for the "default fallback" config tier — the
 * VersionManagerOptions object passed to configure(). Full JSON-Schema structural
 * validation and signature verification for local/remote config documents (Prompt 3
 * §2.1, §3) are scoped to the not-yet-built config-document pipeline; see
 * docs/architecture/03-configuration-system.md.
 */
export function validateOptions(options: VersionManagerOptions): void {
  if (!options.stores || Object.keys(options.stores).length === 0) {
    throw new InvalidConfigException({
      message:
        'VersionManagerOptions.stores must configure at least one store (ios/android/huawei/amazon/custom)',
    });
  }

  if (options.appVersion !== undefined) {
    try {
      parseVersion(options.appVersion);
    } catch (error) {
      throw new InvalidConfigException({
        message: `options.appVersion "${options.appVersion}" is not a valid SemVer string`,
        cause: error,
      });
    }
  }

  if (options.policy?.forceUpdateBelow !== undefined) {
    try {
      parseVersion(options.policy.forceUpdateBelow);
    } catch (error) {
      throw new InvalidConfigException({
        message: `options.policy.forceUpdateBelow "${options.policy.forceUpdateBelow}" is not a valid SemVer string`,
        cause: error,
      });
    }
  }

  const timeoutMs = options.fallback?.requestTimeoutMs;
  if (timeoutMs !== undefined && timeoutMs <= 0) {
    throw new InvalidConfigException({
      message: 'options.fallback.requestTimeoutMs must be greater than 0',
    });
  }

  const ttlMs = options.cache?.ttlMs;
  if (ttlMs !== undefined && ttlMs < 0) {
    throw new InvalidConfigException({
      message: 'options.cache.ttlMs must be >= 0',
    });
  }

  const maxAttempts = options.fallback?.retry?.maxAttempts;
  if (maxAttempts !== undefined && (maxAttempts < 0 || maxAttempts > 10)) {
    throw new InvalidConfigException({
      message: 'options.fallback.retry.maxAttempts must be between 0 and 10',
    });
  }

  const baseDelayMs = options.fallback?.retry?.baseDelayMs;
  if (baseDelayMs !== undefined && baseDelayMs <= 0) {
    throw new InvalidConfigException({
      message: 'options.fallback.retry.baseDelayMs must be greater than 0',
    });
  }

  const rolloutPercentage = options.policy?.rolloutPercentage;
  if (
    rolloutPercentage !== undefined &&
    (rolloutPercentage < 0 || rolloutPercentage > 100)
  ) {
    throw new InvalidConfigException({
      message: 'options.policy.rolloutPercentage must be between 0 and 100',
    });
  }
}
