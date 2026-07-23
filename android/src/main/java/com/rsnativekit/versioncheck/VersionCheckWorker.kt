package com.rsnativekit.versioncheck

import android.content.Context
import android.content.Intent
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.facebook.react.HeadlessJsTaskService

/**
 * WorkManager Worker enqueued by VersionCheckModule.scheduleBackgroundCheck(). Runs on
 * WorkManager's background thread pool (never the JS thread — doc 01 §10); its only job
 * is to wake the headless JS task, which does the actual checkForUpdates() call in JS
 * (business logic stays in the domain layer, per doc 01 §1.1 — native code never
 * reimplements it).
 */
class VersionCheckWorker(context: Context, params: WorkerParameters) :
  Worker(context, params) {

  override fun doWork(): Result {
    return try {
      val intent = Intent(applicationContext, VersionCheckHeadlessTaskService::class.java)
      HeadlessJsTaskService.acquireWakeLockNow(applicationContext)
      applicationContext.startService(intent)
      Result.success()
    } catch (error: Exception) {
      Result.retry()
    }
  }
}
