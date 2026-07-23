import { canonicalize, utf8ToBase64 } from './canonicalize';
import type {
  SignatureVerificationResult,
  SignedConfigEnvelope,
  TrustedKeySet,
} from '../../domain/models/ConfigDocument';
import type { ICryptoProvider } from '../../domain/ports/IPlatformBridge';
import type { ISignatureVerifier } from '../../domain/ports/IConfigSources';

declare const __DEV__: boolean | undefined;

function isDev(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}

/**
 * Doc 03 §3.2/§3.4 — verification calls are implemented using OS-provided cryptography
 * exclusively (iOS CryptoKit/Security.framework, Android java.security), reached through
 * IPlatformBridge.crypto (ICryptoProvider) so this class never itself hand-rolls
 * cryptographic primitives (Prompt 1 §9.3's zero-external-dependency constraint extends
 * to "don't implement crypto in JS either" — only OS APIs are trusted for this).
 */
export class SignatureVerifier implements ISignatureVerifier {
  constructor(private readonly crypto?: ICryptoProvider) {}

  async verify(
    envelope: SignedConfigEnvelope,
    trustedKeys: TrustedKeySet
  ): Promise<SignatureVerificationResult> {
    const { algorithm, keyId, value } = envelope.signature;

    // §3.1: algorithm "none" is permitted only for the local bundled document in
    // development builds — rejected for any remote fetch and for release builds,
    // enforced here regardless of what security.signatureAlgorithm claims (a
    // compromised document cannot downgrade its own algorithm to "none" and be
    // believed). The pipeline is responsible for only calling verify() with a "none"
    // envelope on the local-dev path in the first place; this is a defense-in-depth
    // second check.
    if (algorithm === 'none') {
      if (!isDev()) {
        return {
          valid: false,
          reason:
            'signature.algorithm "none" is rejected outside development builds',
        };
      }
      return { valid: true };
    }

    if (trustedKeys.algorithm !== algorithm) {
      return {
        valid: false,
        reason: `Envelope algorithm "${algorithm}" does not match configured security.signatureAlgorithm "${trustedKeys.algorithm}"`,
      };
    }

    if (!trustedKeys.keys.has(keyId)) {
      return {
        valid: false,
        reason: `keyId "${keyId}" is not present in security.trustedKeyIds`,
      };
    }

    if (!this.crypto) {
      return {
        valid: false,
        reason:
          'No ICryptoProvider available on the active IPlatformBridge — cannot verify signatures on this target',
      };
    }

    const canonicalPayload = canonicalize(envelope.payload);
    const messageBase64 = utf8ToBase64(canonicalPayload);

    try {
      const valid =
        algorithm === 'ed25519'
          ? await this.crypto.verifyEd25519(keyId, messageBase64, value)
          : await this.crypto.verifyHmacSha256(keyId, messageBase64, value);
      return valid
        ? { valid: true }
        : { valid: false, reason: 'Signature mismatch' };
    } catch (error) {
      return {
        valid: false,
        reason: `Native signature verification threw: ${String(error)}`,
      };
    }
  }
}
