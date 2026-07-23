import type { IPlatformBridge } from '../domain/ports/IPlatformBridge';
import { NativePlatformBridge } from './native/NativePlatformBridge';

/** iOS/Android implementation — see createPlatformBridge.ts for why this is a separate file. */
export function createPlatformBridge(): IPlatformBridge {
  return new NativePlatformBridge();
}
