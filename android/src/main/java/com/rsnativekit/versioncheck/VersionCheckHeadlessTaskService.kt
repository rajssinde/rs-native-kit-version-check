package com.rsnativekit.versioncheck

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Doc 01 §4.1/§10 "Headless JS task + native WorkManager/BGTaskScheduler bridge" — the
 * Android half. VersionCheckWorker (WorkManager) starts this service when a scheduled
 * check fires; this service starts the "VersionCheckBackgroundTask" headless JS task,
 * which the host app must register once via the `registerVersionCheckHeadlessTask()`
 * helper exported from '@rs-native-kit/version-check' (same integration shape as
 * react-native-background-fetch and similar libraries require).
 */
class VersionCheckHeadlessTaskService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent): HeadlessJsTaskConfig? {
    val extras = intent.extras
    return HeadlessJsTaskConfig(
      TASK_NAME,
      if (extras != null) Arguments.fromBundle(extras) else Arguments.createMap(),
      TASK_TIMEOUT_MS,
      true
    )
  }

  companion object {
    const val TASK_NAME = "VersionCheckBackgroundTask"
    const val TASK_TIMEOUT_MS = 30_000L
  }
}
