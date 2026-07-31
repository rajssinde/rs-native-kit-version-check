import type { VersionCheck } from '../../specs/VersionCheck.nitro';

let cachedModule: VersionCheck | null = null;

/**
 * Lazily resolved — including the `require('react-native-nitro-modules')` itself,
 * not just the `createHybridObject` call — so importing this module (or anything that
 * transitively imports it, e.g. src/di/container.ts) never throws in environments where
 * the native module isn't registered. Jest's simulated native platform never registers
 * the "NitroModules" host TurboModule, and `react-native-nitro-modules`'s own entry point
 * resolves it eagerly at import time; a static top-level `import` here would trigger that
 * resolution — and throw — as soon as this file loads, before any method is ever called.
 * A caller who supplies VersionManagerOptions.platformBridge never reaches this file's
 * exported function at all, so the deferred require never even runs for them.
 */
export default function getNativeVersionCheck(): VersionCheck {
  if (!cachedModule) {
    const {
      NitroModules,
    }: typeof import('react-native-nitro-modules') = require('react-native-nitro-modules');
    cachedModule =
      NitroModules.createHybridObject<VersionCheck>('VersionCheck');
  }
  return cachedModule;
}
