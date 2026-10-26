package com.jelly.audio.updates

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.ByteArrayInputStream
import java.io.File
import java.security.MessageDigest
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class WebContentFilesTest {
    @get:Rule val temporary = TemporaryFolder()
    private val bundled = mapOf("index.html" to "old", "keep.js" to "kept", "delete.js" to "remove")
    private val base by lazy { metadata(1, bundled) }
    private val root by lazy { temporary.newFolder("web") }
    private fun store() = WebContentFiles(root, base, 14) { path ->
        bundled[path]?.let { ByteArrayInputStream(it.toByteArray()) }
    }
    private fun hash(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
    private fun metadata(version: Int, files: Map<String, String>): JSONObject {
        val list = files.toSortedMap().map { (path, value) ->
            "{\"path\":${JSONObject.quote(path)},\"size\":${value.toByteArray().size},\"sha256\":\"${hash(value.toByteArray())}\"}"
        }.joinToString(",", "[", "]")
        return JSONObject().put("versionCode", version).put("minNativeVersionCode", 14).put("maxNativeVersionCode", 14)
            .put("files", JSONArray(list)).put("filesHash", hash(list.toByteArray()))
    }
    private fun zip(files: Map<String, String>): File = temporary.newFile().apply {
        ZipOutputStream(outputStream()).use { zip -> files.forEach { (name, body) ->
            zip.putNextEntry(ZipEntry(name)); zip.write(body.toByteArray()); zip.closeEntry()
        } }
    }
    private fun read(store: WebContentFiles, path: String) = store.open(path)?.bufferedReader()?.use { it.readText() }
    private fun reject(block: () -> Unit) { try { block(); fail("Unsafe update accepted") } catch (_: IllegalArgumentException) {} }

    @Test fun deltaBuildsACompleteVersionFromBundledAndRemovesDeletedFiles() {
        val store = store()
        store.stage(metadata(2, mapOf("index.html" to "new", "keep.js" to "kept")), zip(mapOf("index.html" to "new")))
        assertEquals("old", read(store, "index.html"))
        store.prepareLaunch()
        assertEquals("new", read(store, "index.html"))
        assertEquals("kept", read(store, "keep.js"))
        assertNull(read(store, "delete.js"))
        assertEquals(2, store.currentVersion())
    }

    @Test fun nextLaunchRollsBackCandidateWithoutHealthyAcknowledgement() {
        val store = store()
        store.stage(metadata(2, mapOf("index.html" to "new")), zip(mapOf("index.html" to "new")))
        store.prepareLaunch()
        val restarted = store()
        restarted.prepareLaunch()
        assertEquals(1, restarted.currentVersion())
        assertEquals("old", read(restarted, "index.html"))
    }

    @Test fun healthyVersionSurvivesRestartAndCanSupplyNextDelta() {
        val store = store()
        store.stage(metadata(2, mapOf("index.html" to "new", "extra.js" to "extra")), zip(mapOf("index.html" to "new", "extra.js" to "extra")))
        store.prepareLaunch(); store.markHealthy()
        val restarted = store(); restarted.prepareLaunch()
        restarted.stage(metadata(3, mapOf("index.html" to "newer", "extra.js" to "extra")), zip(mapOf("index.html" to "newer")))
        restarted.prepareLaunch()
        assertEquals("extra", read(restarted, "extra.js"))
        assertEquals("newer", read(restarted, "index.html"))
    }

    @Test fun badHashDoesNotChangeCurrentVersionOrCreatePendingUpdate() {
        val store = store()
        reject { store.stage(metadata(2, mapOf("index.html" to "new")), zip(mapOf("index.html" to "bad"))) }
        store.prepareLaunch()
        assertEquals(1, store.currentVersion())
    }

    @Test fun missingChangedFileIsRejected() {
        reject { store().stage(metadata(2, mapOf("index.html" to "new")), zip(emptyMap())) }
    }

    @Test fun extraArchiveEntryIsRejectedEvenWhenRequiredFilesAreValid() {
        reject { store().stage(metadata(2, mapOf("index.html" to "new")), zip(mapOf("index.html" to "new", "hidden.js" to "bad"))) }
    }

    @Test fun traversalAbsoluteBackslashAndEncodedPathsAreRejected() {
        listOf("../escape.js", "/escape.js", "a/../../escape.js", "a\\escape.js", "%2e%2e/escape.js", "a//escape.js", "C:/escape.js").forEach { path ->
            reject { store().stage(metadata(2, mapOf("index.html" to "new", path to "bad")), zip(mapOf("index.html" to "new", path to "bad"))) }
        }
        assertNull(store().open("../state.json"))
    }

    @Test fun wrongCanonicalFilesHashAndRollbackVersionAreRejected() {
        reject { store().stage(metadata(2, mapOf("index.html" to "new")).put("filesHash", "0".repeat(64)), zip(mapOf("index.html" to "new"))) }
        reject { store().stage(metadata(1, mapOf("index.html" to "new")), zip(mapOf("index.html" to "new"))) }
    }

    @Test fun duplicateManifestPathAndIncorrectSizeAreRejected() {
        val duplicate = metadata(2, mapOf("index.html" to "new"))
        duplicate.getJSONArray("files").put(duplicate.getJSONArray("files").getJSONObject(0))
        reject { store().stage(duplicate, zip(mapOf("index.html" to "new"))) }
        reject { store().stage(metadata(2, mapOf("index.html" to "new")), zip(mapOf("index.html" to "new-too-large"))) }
    }

    @Test fun cachedVersionTamperingRollsBackBeforeServingContent() {
        val store = store()
        store.stage(metadata(2, mapOf("index.html" to "new")), zip(mapOf("index.html" to "new")))
        store.prepareLaunch(); store.markHealthy()
        root.walkTopDown().first { it.name == "index.html" }.writeText("tampered")
        val restarted = store(); restarted.prepareLaunch()
        assertEquals("old", read(restarted, "index.html"))
    }

    @Test fun nativeCompatibilityIsEnforced() {
        reject { store().stage(metadata(2, mapOf("index.html" to "new")).put("minNativeVersionCode", 15), zip(mapOf("index.html" to "new"))) }
    }

    @Test fun interruptedStageDoesNotCommitOrRemoveAnEarlierPendingVersion() {
        val store = store()
        val oldTarget = metadata(2, mapOf("index.html" to "pending"))
        store.stage(oldTarget, zip(mapOf("index.html" to "pending")))
        Thread.currentThread().interrupt()
        try {
            store.stage(metadata(3, mapOf("index.html" to "cancelled")), zip(mapOf("index.html" to "cancelled")))
            fail("Interrupted stage accepted")
        } catch (_: java.util.concurrent.CancellationException) {
            // Interrupt is cleared only in test cleanup; the store must observe it, not consume it.
        } finally { Thread.interrupted() }
        store.prepareLaunch()
        assertEquals("pending", read(store, "index.html"))
    }

    @Test fun cancelDiscardsOnlyTheMatchingPendingCandidateAndNeverActiveContent() {
        val store = store()
        val target = metadata(2, mapOf("index.html" to "new"))
        store.stage(target, zip(mapOf("index.html" to "new")))
        store.discardPending(3, "0".repeat(64))
        store.prepareLaunch()
        assertEquals("new", read(store, "index.html"))
        store.markHealthy()
        store.discardPending(2, target.getString("filesHash"))
        assertEquals("new", read(store, "index.html"))
        val later = metadata(3, mapOf("index.html" to "later"))
        store.stage(later, zip(mapOf("index.html" to "later")))
        store.discardPending(3, later.getString("filesHash"))
        store.prepareLaunch()
        assertEquals("new", read(store, "index.html"))
    }

    @Test fun bundledSessionRecoveryDoesNotRequireWritingUpdateState() {
        val store = store()
        store.stage(metadata(2, mapOf("index.html" to "new")), zip(mapOf("index.html" to "new")))
        store.prepareLaunch(); store.markHealthy()
        // Replacing the state file with a directory simulates a persistence failure deterministically.
        File(root, "state.json").delete()
        File(root, "state.json").mkdir()
        store.useBundledForSession()
        store.markHealthy()
        assertEquals("old", read(store, "index.html"))
        assertEquals(1, store.currentVersion())
    }
}
