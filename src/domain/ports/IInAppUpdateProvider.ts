/**
 * Doc 04 §1 — native in-app update integrations (Android Play Core Flexible/Immediate
 * flows; iOS's itms-apps:// modal App Store overlay in lieu of a native SDK). Optional
 * on IPlatformBridge (see IPlatformBridge.ts) — a target can omit this entirely rather
 * than force a fake implementation, the same way ICryptoProvider is optional.
 */
export type InAppUpdateFlow = 'flexible' | 'immediate';

export type InAppUpdateAvailability =
  'unavailable' | 'available' | 'inProgress';

export interface InAppUpdateStatus {
  readonly availability: InAppUpdateAvailability;
}

export interface IInAppUpdateProvider {
  checkAvailability(): Promise<InAppUpdateStatus>;
  /** `storeUrl` is only meaningful on iOS (built into an itms-apps:// link); Android ignores it. */
  startUpdate(flow: InAppUpdateFlow, storeUrl: string): Promise<void>;
  /** Android-only — triggers the install after a Flexible download finishes. No-op elsewhere. */
  completeFlexibleUpdate(): Promise<void>;
}
