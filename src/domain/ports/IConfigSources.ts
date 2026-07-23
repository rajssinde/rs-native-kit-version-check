import type {
  BoundaryValidationResult,
  FetchOptions,
  RawConfigDocument,
  SchemaValidationResult,
  SignedConfigEnvelope,
  SignatureVerificationResult,
  TrustedKeySet,
} from '../models/ConfigDocument';
import type { ResolvedVersionManagerConfig } from '../models/VersionManagerOptions';

/** Doc 03 §0 — small pipeline of ports living under src/data/config/. */

export interface ILocalConfigSource {
  /** null if no bundled config asset/envelope was supplied. */
  read(): Promise<RawConfigDocument | null>;
}

export interface IRemoteConfigSource {
  fetch(url: string, options: FetchOptions): Promise<RawConfigDocument>;
}

export interface IEnvironmentOverrideSource {
  read(): Promise<
    Partial<import('../models/ConfigDocument').VersionManagerConfigDocument>
  >;
}

export interface IConfigCache {
  getLastValid(): Promise<ResolvedVersionManagerConfig | null>;
  setLastValid(config: ResolvedVersionManagerConfig): Promise<void>;
}

export interface IConfigValidator {
  validateSchema(doc: RawConfigDocument): SchemaValidationResult;
  validateBoundaries(doc: RawConfigDocument): BoundaryValidationResult;
}

export interface ISignatureVerifier {
  verify(
    envelope: SignedConfigEnvelope,
    trustedKeys: TrustedKeySet
  ): Promise<SignatureVerificationResult>;
}
