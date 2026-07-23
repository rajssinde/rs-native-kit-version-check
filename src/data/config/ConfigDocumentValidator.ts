import { parseVersion } from '../../domain/engines/semver/SemVerEngine';
import type {
  BoundaryValidationResult,
  RawConfigDocument,
  SchemaValidationResult,
} from '../../domain/models/ConfigDocument';
import type { IConfigValidator } from '../../domain/ports/IConfigSources';

/** Doc 03 §2.2 — serialized document size cap, enforced before parsing even begins. */
export const CONFIG_ENVELOPE_MAX_BYTES = 64 * 1024;

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
const HTTPS_URL_PATTERN = /^https:\/\//;
const APP_STORE_ID_PATTERN = /^[0-9]{6,12}$/;
const ANDROID_PACKAGE_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const AMAZON_ASIN_PATTERN = /^[A-Z0-9]{10}$/;
const HUAWEI_APP_ID_PATTERN = /^[0-9]{6,12}$/;
const SCHEMA_VERSION_PATTERN = /^\d+\.\d+$/;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Hand-rolled, zero-dependency structural validator (Prompt 1 §9.3 — no ajv) that walks
 * a SignedConfigEnvelope against the JSON Schema in doc 03 §6: required-field presence,
 * type checks, enum membership, and additionalProperties:false at every level (unknown
 * fields are rejected, not silently ignored — §2.1's downgrade-attack rationale).
 */
export class ConfigDocumentValidator implements IConfigValidator {
  validateSchema(doc: RawConfigDocument): SchemaValidationResult {
    const errors: string[] = [];

    if (typeof doc === 'string' && doc.length > CONFIG_ENVELOPE_MAX_BYTES) {
      // Cheap byte-length check that short-circuits pathological payloads (§2.2, VM-1007
      // is raised by the caller — this method only reports the schema-shape verdict).
      errors.push(
        `Envelope exceeds ${CONFIG_ENVELOPE_MAX_BYTES} bytes before parsing`
      );
      return { valid: false, errors };
    }

    let envelope: unknown = doc;
    if (typeof doc === 'string') {
      try {
        envelope = JSON.parse(doc);
      } catch (error) {
        return {
          valid: false,
          errors: [`Envelope is not valid JSON: ${String(error)}`],
        };
      }
    }

    if (!isPlainObject(envelope)) {
      return { valid: false, errors: ['Envelope must be a JSON object'] };
    }

    this.checkAdditionalProperties(
      envelope,
      ['schemaVersion', 'payload', 'signature'],
      'envelope',
      errors
    );
    this.requireField(envelope, 'schemaVersion', 'string', errors, 'envelope');
    this.requireField(envelope, 'payload', 'object', errors, 'envelope');
    this.requireField(envelope, 'signature', 'object', errors, 'envelope');

    if (
      typeof envelope.schemaVersion === 'string' &&
      !SCHEMA_VERSION_PATTERN.test(envelope.schemaVersion)
    ) {
      errors.push('envelope.schemaVersion must match ^\\d+\\.\\d+$');
    }

    if (isPlainObject(envelope.signature)) {
      const sig = envelope.signature;
      this.checkAdditionalProperties(
        sig,
        ['algorithm', 'keyId', 'value', 'signedAt'],
        'signature',
        errors
      );
      this.requireField(sig, 'algorithm', 'string', errors, 'signature');
      this.requireField(sig, 'keyId', 'string', errors, 'signature');
      this.requireField(sig, 'value', 'string', errors, 'signature');
      this.requireField(sig, 'signedAt', 'string', errors, 'signature');
      if (
        typeof sig.algorithm === 'string' &&
        !['ed25519', 'hmac-sha256', 'none'].includes(sig.algorithm)
      ) {
        errors.push(
          'signature.algorithm must be one of ed25519 | hmac-sha256 | none'
        );
      }
    }

    if (isPlainObject(envelope.payload)) {
      this.validatePayloadShape(envelope.payload, errors);
    }

    return { valid: errors.length === 0, errors };
  }

  validateBoundaries(doc: RawConfigDocument): BoundaryValidationResult {
    const fieldErrors = new Map<string, string>();
    const envelope =
      typeof doc === 'string'
        ? safeParse(doc)
        : (doc as Record<string, unknown>);
    const payload = isPlainObject(envelope)
      ? (envelope.payload as Record<string, unknown> | undefined)
      : undefined;

    if (!isPlainObject(payload)) {
      return { valid: true, fieldErrors };
    }

    const network = payload.network as Record<string, unknown> | undefined;
    if (isPlainObject(network)) {
      const timeout = network.requestTimeoutMs;
      if (typeof timeout === 'number' && timeout <= 0) {
        fieldErrors.set('network.requestTimeoutMs', 'must be > 0');
      }
      const retry = network.retry as Record<string, unknown> | undefined;
      if (isPlainObject(retry)) {
        const maxAttempts = retry.maxAttempts;
        if (
          typeof maxAttempts === 'number' &&
          (maxAttempts < 0 || maxAttempts > 10)
        ) {
          fieldErrors.set(
            'network.retry.maxAttempts',
            'must be between 0 and 10'
          );
        }
        const baseDelayMs = retry.baseDelayMs;
        if (typeof baseDelayMs === 'number' && baseDelayMs <= 0) {
          fieldErrors.set('network.retry.baseDelayMs', 'must be > 0');
        }
      }
    }

    const cache = payload.cache as Record<string, unknown> | undefined;
    if (
      isPlainObject(cache) &&
      typeof cache.ttlMs === 'number' &&
      cache.ttlMs < 0
    ) {
      fieldErrors.set('cache.ttlMs', 'must be >= 0');
    }

    if (
      typeof payload.localVersionIdentifier === 'string' &&
      !this.isValidSemVer(payload.localVersionIdentifier)
    ) {
      fieldErrors.set('localVersionIdentifier', 'not a valid SemVer string');
    }

    const alerts = payload.alerts as Record<string, unknown> | undefined;
    if (
      isPlainObject(alerts) &&
      typeof alerts.forceUpdateBelow === 'string' &&
      !this.isValidSemVer(alerts.forceUpdateBelow)
    ) {
      fieldErrors.set('alerts.forceUpdateBelow', 'not a valid SemVer string');
    }

    if (
      typeof payload.remoteConfigUrl === 'string' &&
      !HTTPS_URL_PATTERN.test(payload.remoteConfigUrl)
    ) {
      fieldErrors.set('remoteConfigUrl', 'must use https://');
    }

    const stores = payload.stores as Record<string, unknown> | undefined;
    if (isPlainObject(stores)) {
      this.checkStoreShape(
        stores,
        'ios',
        'appStoreId',
        APP_STORE_ID_PATTERN,
        fieldErrors
      );
      this.checkStoreShape(
        stores,
        'android',
        'packageName',
        ANDROID_PACKAGE_PATTERN,
        fieldErrors
      );
      this.checkStoreShape(
        stores,
        'huawei',
        'appId',
        HUAWEI_APP_ID_PATTERN,
        fieldErrors
      );
      this.checkStoreShape(
        stores,
        'amazon',
        'asin',
        AMAZON_ASIN_PATTERN,
        fieldErrors
      );
      const custom = stores.custom as Record<string, unknown> | undefined;
      if (
        isPlainObject(custom) &&
        typeof custom.url === 'string' &&
        !HTTPS_URL_PATTERN.test(custom.url)
      ) {
        fieldErrors.set('stores.custom.url', 'must use https://');
      }
    }

    return { valid: fieldErrors.size === 0, fieldErrors };
  }

  private isValidSemVer(v: string): boolean {
    if (!SEMVER_PATTERN.test(v)) return false;
    try {
      parseVersion(v);
      return true;
    } catch {
      return false;
    }
  }

  private checkStoreShape(
    stores: Record<string, unknown>,
    key: string,
    field: string,
    pattern: RegExp,
    fieldErrors: Map<string, string>
  ): void {
    const entry = stores[key] as Record<string, unknown> | undefined;
    if (isPlainObject(entry) && typeof entry[field] === 'string') {
      const value = entry[field] as string;
      if (!pattern.test(value)) {
        fieldErrors.set(
          `stores.${key}.${field}`,
          `"${value}" has invalid shape`
        );
      }
    }
  }

  private validatePayloadShape(
    payload: Record<string, unknown>,
    errors: string[]
  ): void {
    this.checkAdditionalProperties(
      payload,
      [
        'localVersionIdentifier',
        'remoteConfigUrl',
        'cache',
        'network',
        'alerts',
        'stores',
        'security',
        'schemaVersion',
      ],
      'payload',
      errors
    );
  }

  private requireField(
    obj: Record<string, unknown>,
    field: string,
    type: 'string' | 'object',
    errors: string[],
    context: string
  ): void {
    const value = obj[field];
    if (value === undefined) {
      errors.push(`${context}.${field} is required`);
      return;
    }
    if (type === 'string' && typeof value !== 'string') {
      errors.push(`${context}.${field} must be a string`);
    }
    if (type === 'object' && !isPlainObject(value)) {
      errors.push(`${context}.${field} must be an object`);
    }
  }

  private checkAdditionalProperties(
    obj: Record<string, unknown>,
    allowed: string[],
    context: string,
    errors: string[]
  ): void {
    for (const key of Object.keys(obj)) {
      if (!allowed.includes(key)) {
        errors.push(`${context}.${key} is not a recognized field`);
      }
    }
  }
}

function safeParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}
