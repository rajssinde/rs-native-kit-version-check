import { ConsoleLogSink } from '../../shared/logging/Logger';
import { resolveConfigSync } from './ConfigLoader';
import { CONFIG_ENVELOPE_MAX_BYTES } from './ConfigDocumentValidator';
import type {
  ConfigTier,
  RawConfigDocument,
  SignedConfigEnvelope,
  TrustedKeySet,
  VersionManagerConfigDocument,
} from '../../domain/models/ConfigDocument';
import {
  BoundaryValidationException,
  ConfigSizeLimitExceededException,
  SchemaValidationException,
  SignatureVerificationException,
  UntrustedKeyIdException,
  toVersionManagerException,
} from '../../domain/errors/VersionManagerException';
import type { VersionManagerException } from '../../domain/errors/VersionManagerException';
import type {
  IConfigCache,
  IConfigValidator,
  IEnvironmentOverrideSource,
  ILocalConfigSource,
  IRemoteConfigSource,
  ISignatureVerifier,
} from '../../domain/ports/IConfigSources';
import type { IClock } from '../../domain/ports/IClock';
import type {
  ResolvedVersionManagerConfig,
  VersionManagerOptions,
} from '../../domain/models/VersionManagerOptions';

export interface ConfigResolutionPipelineDeps {
  readonly local: ILocalConfigSource;
  readonly remote: IRemoteConfigSource;
  readonly envOverrides: IEnvironmentOverrideSource;
  readonly cache: IConfigCache;
  readonly validator: IConfigValidator;
  readonly signatureVerifier: ISignatureVerifier;
  readonly clock: IClock;
  /** §7.4 — default 5, configurable. */
  readonly circuitBreakerThreshold?: number;
  /** §7.4 cool-down window once the breaker trips. */
  readonly circuitBreakerCooldownMs?: number;
  readonly onError?: (error: VersionManagerException) => void;
}

export interface ConfigResolutionResult {
  readonly config: ResolvedVersionManagerConfig;
  readonly tier: ConfigTier;
}

/**
 * Doc 03's ConfigResolutionPipeline — orchestrates §3.2 (schema -> boundary -> signature
 * validation), §4.2 (per-field precedence merge, env > remote > local > default), §4.3
 * (access path), §7.2 (cascading fallback), §7.3 (field vs whole-document fallback), and
 * §7.4 (quarantine + circuit breaker). Lives in src/data/config/ per doc 03 §0.
 */
export class ConfigResolutionPipeline {
  private readonly quarantinedFingerprints = new Set<string>();
  private consecutiveRemoteFailures = 0;
  private circuitOpenUntil = 0;

  constructor(private readonly deps: ConfigResolutionPipelineDeps) {}

  async resolve(
    defaults: VersionManagerOptions
  ): Promise<ConfigResolutionResult> {
    // Tier 4 — always present, validated synchronously at configure()-time already by
    // ConfigLoader.resolveConfigSync (doc 02 §1.3 fail-fast); re-run here defensively so
    // this pipeline is safe to call standalone (e.g. from tests).
    const tier4 = resolveConfigSync(defaults);
    const trustedKeys: TrustedKeySet = {
      algorithm: tier4.security.signatureAlgorithm,
      keys: new Set(tier4.security.trustedKeyIds),
    };

    const [envelopeTier1, envelopeTier3] = await Promise.all([
      this.deps.envOverrides.read().catch(() => ({})),
      this.readLocal(trustedKeys),
    ]);

    const remoteResult = await this.readRemote(defaults, trustedKeys);

    // §7.2 whole-tier cascade: if the remote tier failed outright, prefer the last known
    // valid *fully resolved* config over recomputing fresh from local+default, so a
    // network hiccup doesn't regress an app back to weaker settings every single check.
    if (remoteResult.status === 'failed') {
      const cached = await this.deps.cache.getLastValid().catch(() => null);
      if (cached) {
        return {
          config: cached,
          tier: 'remote' /* cache reflects a prior remote win */,
        };
      }
    }

    const tier2 = remoteResult.status === 'ok' ? remoteResult.payload : null;
    const tier3 = envelopeTier3;

    const merged = mergeConfig(tier4, tier3, tier2, envelopeTier1);
    const tier: ConfigTier = tier2
      ? 'remote'
      : tier3
        ? 'local'
        : envelopeTier1 && Object.keys(envelopeTier1).length > 0
          ? 'env'
          : 'default';

    await this.deps.cache.setLastValid(merged).catch(() => {
      // Cache-write failures never block resolution (§7.2's guarantee is about read
      // fallback; a write failure here just means the *next* remote outage won't have a
      // warm cache to fall back to — already surfaced via CacheWriteException elsewhere).
    });

    return { config: merged, tier };
  }

  private async readLocal(
    trustedKeys: TrustedKeySet
  ): Promise<VersionManagerConfigDocument | null> {
    const raw = await this.deps.local.read().catch(() => null);
    if (raw === null || raw === undefined) return null;

    const verified = await this.validateAndVerify(raw, 'local', trustedKeys);
    return verified;
  }

  private async readRemote(
    defaults: VersionManagerOptions,
    trustedKeys: TrustedKeySet
  ): Promise<
    | { status: 'ok'; payload: VersionManagerConfigDocument }
    | { status: 'absent' }
    | { status: 'failed' }
  > {
    const url = defaults.remoteConfigUrl;
    if (!url) return { status: 'absent' };

    if (this.deps.clock.now() < this.circuitOpenUntil) {
      // §7.4 circuit breaker: skip attempting remote fetch entirely during the cooldown.
      return { status: 'failed' };
    }

    let raw: RawConfigDocument;
    try {
      raw = await this.deps.remote.fetch(url, {
        timeoutMs: defaults.fallback?.requestTimeoutMs ?? 8_000,
        headers: defaults.configSources?.remoteFetchHeaders,
      });
    } catch (error) {
      this.recordRemoteFailure();
      this.report(toVersionManagerException(error));
      return { status: 'failed' };
    }

    const fingerprint = fingerprintOf(raw);
    if (this.quarantinedFingerprints.has(fingerprint)) {
      // §7.4: same bad bytes seen again within the session — fail silently (no
      // re-validation, no re-logging) but still counts as a circuit-breaker failure.
      this.recordRemoteFailure();
      return { status: 'failed' };
    }

    const verified = await this.validateAndVerify(
      raw,
      'remote',
      trustedKeys,
      fingerprint
    );
    if (verified === null) {
      this.recordRemoteFailure();
      return { status: 'failed' };
    }

    this.consecutiveRemoteFailures = 0;
    this.circuitOpenUntil = 0;
    return { status: 'ok', payload: verified };
  }

  private recordRemoteFailure(): void {
    this.consecutiveRemoteFailures++;
    const threshold = this.deps.circuitBreakerThreshold ?? 5;
    if (this.consecutiveRemoteFailures >= threshold) {
      const cooldown = this.deps.circuitBreakerCooldownMs ?? 5 * 60_000;
      this.circuitOpenUntil = this.deps.clock.now() + cooldown;
    }
  }

  /**
   * §3.2 sequence: schema -> boundary -> canonicalize -> verify signature. Returns the
   * validated payload (with any boundary-failed fields stripped per §7.3's field-level
   * fallback) or null if the whole document must be rejected (schema failure or
   * signature failure — §7.3's whole-document fallback).
   */
  private async validateAndVerify(
    raw: RawConfigDocument,
    tier: 'local' | 'remote',
    trustedKeys: TrustedKeySet,
    fingerprint?: string
  ): Promise<VersionManagerConfigDocument | null> {
    const sizeCheck =
      typeof raw === 'string' ? raw.length : JSON.stringify(raw).length;
    if (sizeCheck > CONFIG_ENVELOPE_MAX_BYTES) {
      this.report(
        new ConfigSizeLimitExceededException({
          message: `${tier} config envelope exceeds ${CONFIG_ENVELOPE_MAX_BYTES} bytes`,
        })
      );
      return null;
    }

    const schemaResult = this.deps.validator.validateSchema(raw);
    if (!schemaResult.valid) {
      this.report(
        new SchemaValidationException({
          message: `${tier} config document failed schema validation: ${schemaResult.errors.join('; ')}`,
          metadata: { tier, errors: schemaResult.errors },
        })
      );
      return null; // whole-document fallback (§7.3)
    }

    const envelope = (
      typeof raw === 'string' ? JSON.parse(raw) : raw
    ) as SignedConfigEnvelope;

    // Signature verification — required for remote always, required for local unless
    // algorithm is "none" in a dev build (enforced inside SignatureVerifier, §3.1).
    if (
      envelope.signature.algorithm !== 'none' &&
      !trustedKeys.keys.has(envelope.signature.keyId)
    ) {
      this.report(
        new UntrustedKeyIdException({
          message: `${tier} config signature.keyId "${envelope.signature.keyId}" is not in security.trustedKeyIds`,
          metadata: { tier },
        })
      );
      if (fingerprint) this.quarantinedFingerprints.add(fingerprint);
      return null;
    }

    const sigResult = await this.deps.signatureVerifier.verify(
      envelope,
      trustedKeys
    );
    if (!sigResult.valid) {
      this.report(
        new SignatureVerificationException({
          message: `${tier} config signature verification failed: ${sigResult.reason ?? 'unknown reason'}`,
          metadata: { tier },
        })
      );
      if (fingerprint) this.quarantinedFingerprints.add(fingerprint);
      return null; // whole-document fallback (§7.3) — an untrusted signature taints every field
    }

    // §7.3 field-level fallback: only the offending fields are dropped, not the whole doc.
    const boundaryResult = this.deps.validator.validateBoundaries(raw);
    if (!boundaryResult.valid) {
      this.report(
        new BoundaryValidationException({
          message: `${tier} config document failed boundary validation on: ${Array.from(boundaryResult.fieldErrors.keys()).join(', ')}`,
          metadata: {
            tier,
            fields: Array.from(boundaryResult.fieldErrors.entries()),
          },
        })
      );
      return stripFields(envelope.payload, boundaryResult.fieldErrors);
    }

    return envelope.payload;
  }

  private report(error: VersionManagerException): void {
    if (this.deps.onError) {
      this.deps.onError(error);
    } else {
      new ConsoleLogSink().write({
        level: 'error',
        message: error.message,
        timestamp: this.deps.clock.now(),
        metadata: { code: error.code },
      });
    }
  }
}

function fingerprintOf(raw: RawConfigDocument): string {
  const str = typeof raw === 'string' ? raw : JSON.stringify(raw);
  // Cheap non-cryptographic fingerprint — this is a quarantine dedupe key, not a
  // security boundary (signature verification is what actually protects integrity).
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return `${str.length}:${hash}`;
}

function stripFields(
  payload: VersionManagerConfigDocument,
  fieldErrors: ReadonlyMap<string, string>
): VersionManagerConfigDocument {
  const clone: Record<string, unknown> = JSON.parse(JSON.stringify(payload));
  for (const path of fieldErrors.keys()) {
    const segments = path.split('.');
    let cursor: Record<string, unknown> = clone;
    for (let i = 0; i < segments.length - 1; i++) {
      const next = cursor[segments[i] as string];
      if (typeof next !== 'object' || next === null) break;
      cursor = next as Record<string, unknown>;
    }
    delete cursor[segments[segments.length - 1] as string];
  }
  return clone as VersionManagerConfigDocument;
}

function firstDefined<T>(...values: (T | undefined | null)[]): T | undefined {
  for (const v of values) {
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

/**
 * Doc 03 §4.2 precedence matrix — per-field deep merge, honoring which tiers each field
 * group is eligible to appear in (not every field accepts every tier; e.g. env never
 * overrides cache.storage or stores.*, and security.* is tier-4-only).
 */
function mergeConfig(
  tier4: ResolvedVersionManagerConfig,
  tier3: VersionManagerConfigDocument | null,
  tier2: VersionManagerConfigDocument | null,
  tier1: Partial<VersionManagerConfigDocument>
): ResolvedVersionManagerConfig {
  return {
    appVersion:
      firstDefined(tier1.localVersionIdentifier, tier4.appVersion) ?? null,
    logging: tier4.logging,
    cache: {
      ttlMs:
        firstDefined(
          tier1.cache?.ttlMs,
          tier2?.cache?.ttlMs,
          tier3?.cache?.ttlMs,
          tier4.cache.ttlMs
        ) ?? 21_600_000,
      storage:
        firstDefined(
          tier2?.cache?.storage,
          tier3?.cache?.storage,
          tier4.cache.storage
        ) ?? 'persistent',
      bustOnManualCheck: tier4.cache.bustOnManualCheck,
    },
    fallback: {
      onNetworkError: tier4.fallback.onNetworkError,
      defaultConfig: tier4.fallback.defaultConfig,
      requestTimeoutMs:
        firstDefined(
          tier1.network?.requestTimeoutMs,
          tier2?.network?.requestTimeoutMs,
          tier3?.network?.requestTimeoutMs,
          tier4.fallback.requestTimeoutMs
        ) ?? 8_000,
      retry: {
        maxAttempts:
          firstDefined(
            tier1.network?.retry?.maxAttempts,
            tier2?.network?.retry?.maxAttempts,
            tier3?.network?.retry?.maxAttempts,
            tier4.fallback.retry.maxAttempts
          ) ?? 3,
        backoff:
          firstDefined(
            tier2?.network?.retry?.backoff,
            tier3?.network?.retry?.backoff,
            tier4.fallback.retry.backoff
          ) ?? 'exponential-jitter',
        baseDelayMs:
          firstDefined(
            tier1.network?.retry?.baseDelayMs,
            tier2?.network?.retry?.baseDelayMs,
            tier3?.network?.retry?.baseDelayMs,
            tier4.fallback.retry.baseDelayMs
          ) ?? 500,
      },
    },
    stores: firstDefined(tier2?.stores, tier3?.stores) ?? tier4.stores,
    policy: {
      forceUpdateBelow:
        firstDefined(
          tier1.alerts?.forceUpdateBelow,
          tier2?.alerts?.forceUpdateBelow,
          tier3?.alerts?.forceUpdateBelow,
          tier4.policy.forceUpdateBelow ?? undefined
        ) ?? null,
      reminderIntervalMs:
        firstDefined(
          tier1.alerts?.reminderDelayMs,
          tier2?.alerts?.reminderDelayMs,
          tier3?.alerts?.reminderDelayMs,
          tier4.policy.reminderIntervalMs
        ) ?? 259_200_000,
      rolloutPercentage: tier4.policy.rolloutPercentage,
    },
    strictReadiness: tier4.strictReadiness,
    remoteConfigUrl:
      firstDefined(tier1.remoteConfigUrl, tier4.remoteConfigUrl ?? undefined) ??
      null,
    // security.* is tier-4-only, never overridden by a loaded document (§4.2).
    security: tier4.security,
    schemaVersion:
      firstDefined(
        tier1.schemaVersion,
        tier2?.schemaVersion,
        tier3?.schemaVersion,
        tier4.schemaVersion
      ) ?? '1.0',
  };
}
