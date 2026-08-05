// Background-task entry point (doc 04 §2) — Android-only headless JS task
// registration. Separate subpath (not reachable from src/index.tsx) since it imports
// 'react-native' AppRegistry and is only ever needed by apps that opt into
// VersionManagerOptions.backgroundCheck.enabled, matching the ./ui subpath's rationale
// for keeping optional surface out of the core bundle.

import { AppRegistry, Platform } from 'react-native';
import { VersionManager } from './publicApi';
import type { VersionManagerOptions } from './domain/models/VersionManagerOptions';

/**
 * Must match VersionCheckHeadlessTaskService.TASK_NAME
 * (android/src/main/java/com/rsnativekit/versioncheck/VersionCheckHeadlessTaskService.kt)
 * exactly — this is the name WorkManager's VersionCheckWorker asks HeadlessJsTaskService
 * to run when a scheduled check fires.
 */
const HEADLESS_TASK_NAME = 'VersionCheckBackgroundTask';

/**
 * Registers the headless JS task Android's VersionCheckWorker wakes when a
 * WorkManager-scheduled background check fires (doc 04 §2). Call this once, at module
 * scope in the host app's entry file (e.g. `index.js`, alongside
 * `AppRegistry.registerComponent`) — headless tasks run in a fresh JS context with no
 * access to any state from the app's normal launch, so `getOptions` must be able to
 * reconstruct a full `VersionManagerOptions` from scratch (e.g. read from persisted
 * storage or a constant), not close over anything from a prior `configure()` call.
 *
 * No-ops on iOS/Web: iOS has no headless-JS-task equivalent for BGTaskScheduler (the
 * host app registers its own native launch handler instead — see the doc comment on
 * `scheduleBackgroundCheck` in ios/HybridVersionCheck.swift); Web has no OS-level
 * background execution at all.
 */
export function registerVersionCheckHeadlessTask(
  getOptions: () => VersionManagerOptions | Promise<VersionManagerOptions>
): void {
  if (Platform.OS !== 'android') return;

  AppRegistry.registerHeadlessTask(HEADLESS_TASK_NAME, () => async () => {
    const options = await getOptions();
    const manager = VersionManager.configure(options);
    await manager.ready();
    await manager.checkForUpdates({ bypassCache: false });
  });
}
