import type { StoreLinksOptions } from './VersionManagerOptions';

/** Doc 03 §1.1 — the loadable configuration document (payload of a SignedConfigEnvelope). */
export interface VersionManagerConfigDocument {
  readonly localVersionIdentifier?: string;
  readonly remoteConfigUrl?: string;
  readonly cache?: {
    readonly ttlMs?: number;
    readonly storage?: 'memory' | 'persistent';
  };
  readonly network?: {
    readonly requestTimeoutMs?: number;
    readonly retry?: {
      readonly maxAttempts?: number;
      readonly backoff?: 'fixed' | 'exponential-jitter';
      readonly baseDelayMs?: number;
    };
  };
  readonly alerts?: {
    readonly forceUpdateBelow?: string;
    readonly reminderDelayMs?: number;
    readonly customUiHookIds?: readonly string[];
  };
  readonly stores?: StoreLinksOptions;
  /**
   * Only ever read from tier 4 (configure()) per §4.2 — a document cannot alter the
   * rules used to verify documents. Present in the type for schema-shape completeness
   * (an incoming document that includes it is structurally valid but this field is
   * always ignored by the precedence merge — see ConfigResolutionPipeline).
   */
  readonly security?: {
    readonly signatureAlgorithm?: 'ed25519' | 'hmac-sha256' | 'none';
    readonly trustedKeyIds?: readonly string[];
  };
  readonly schemaVersion?: string;
}

export type SignatureAlgorithm = 'ed25519' | 'hmac-sha256' | 'none';

/** Doc 03 §3.1 — envelope wrapping every local/remote config document. */
export interface SignedConfigEnvelope {
  readonly schemaVersion: string;
  readonly payload: VersionManagerConfigDocument;
  readonly signature: {
    readonly algorithm: SignatureAlgorithm;
    readonly keyId: string;
    readonly value: string; // base64
    readonly signedAt: string; // ISO 8601
  };
}

/** Opaque raw bytes/JSON before schema validation has proven its shape. */
export type RawConfigDocument = unknown;

export interface ConfigLoadRequest {
  readonly defaults: import('./VersionManagerOptions').VersionManagerOptions;
}

export interface FetchOptions {
  readonly timeoutMs: number;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface TrustedKeySet {
  readonly algorithm: SignatureAlgorithm;
  /**
   * Trusted keyIds only — per doc 03 §3.4, actual key material (public keys / HMAC
   * secrets) is embedded at build time on the native side (Info.plist/BuildConfig), not
   * shipped through JS. JS only needs to confirm the envelope's keyId is one this app
   * trusts, then hand the keyId to ICryptoProvider, which resolves it to key material
   * natively.
   */
  readonly keys: ReadonlySet<string>;
}

export type ConfigTier = 'env' | 'remote' | 'local' | 'default';

export interface SchemaValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export interface BoundaryValidationResult {
  readonly valid: boolean;
  /** Field-path -> reason, so the pipeline can drop only the offending fields (§7.3). */
  readonly fieldErrors: ReadonlyMap<string, string>;
}

export interface SignatureVerificationResult {
  readonly valid: boolean;
  readonly reason?: string;
}

export interface ResolvedConfigWithProvenance {
  readonly config: import('./VersionManagerOptions').ResolvedVersionManagerConfig;
  readonly tier: ConfigTier;
}
