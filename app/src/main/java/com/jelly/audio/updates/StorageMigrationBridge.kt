package com.jelly.audio.updates

import android.webkit.JavascriptInterface
import java.io.File

/** Calls originate on WebView's bridge thread; navigation callbacks dispatch to the main thread. */
class StorageMigrationBridge(
    storageDirectory: File,
    private val isLegacyDocument: () -> Boolean,
    private val isStableDocument: () -> Boolean,
    private val launchToken: () -> String,
    private val onSnapshotSaved: () -> Unit,
    private val onFailure: (String) -> Unit,
    private val onHealthy: (String) -> Unit
) {
    private val backup = StorageMigrationBackup(storageDirectory)
    @Volatile var legacyFallback = false
        private set

    fun isComplete(): Boolean = backup.isComplete()
    fun useLegacyFallback() { legacyFallback = true }

    @JavascriptInterface fun getLaunchToken(): String = launchToken()

    @JavascriptInterface fun getMigrationState(): String = when {
        legacyFallback && isLegacyDocument() -> "legacy"
        backup.isComplete() -> "complete"
        else -> "pending"
    }

    @JavascriptInterface fun saveLegacySnapshot(snapshot: String): Boolean {
        if (!isLegacyDocument() || legacyFallback) return false
        return runCatching { backup.capture(snapshot); onSnapshotSaved(); true }.getOrElse { false }
    }

    @JavascriptInterface fun getLegacySnapshot(): String {
        if (!isStableDocument()) return "null"
        return runCatching { backup.snapshot() }.getOrDefault("null")
    }

    @JavascriptInterface fun confirmMigration(snapshot: String): Boolean {
        if (!isStableDocument()) return false
        return runCatching { backup.confirm(snapshot); true }.getOrDefault(false)
    }

    @JavascriptInterface fun migrationFailed(reason: String) {
        if (!isLegacyDocument() && !isStableDocument()) return
        legacyFallback = true
        onFailure(reason.take(300))
    }

    @JavascriptInterface fun markHealthy(token: String?) {
        if (token != null && token == launchToken() && isStableDocument() && backup.isComplete()) onHealthy(token)
    }
}
