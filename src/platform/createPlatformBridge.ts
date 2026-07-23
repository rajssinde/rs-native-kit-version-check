import type { IPlatformBridge } from '../domain/ports/IPlatformBridge';
import { WebPlatformBridge } from './web/WebPlatformBridge';

/**
 * Web/default implementation. Metro (React Native's bundler) prefers
 * createPlatformBridge.native.ts for iOS/Android builds; Vite (the web build, see
 * example/vite.config.mjs) has no such resolution rule and always resolves this file
 * — the same convention already used by src/multiply.tsx / multiply.native.tsx. This
 * indirection matters: NativePlatformBridge.ts imports NativeVersionCheck, whose
 * top-level TurboModuleRegistry.getEnforcing() call would throw if ever evaluated on
 * Web, so the native module must never even be imported into a web bundle.
 */
export function createPlatformBridge(): IPlatformBridge {
  return new WebPlatformBridge();
}
