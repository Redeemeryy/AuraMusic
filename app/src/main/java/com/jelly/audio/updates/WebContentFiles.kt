package com.jelly.audio.updates

import java.io.File
import java.io.InputStream
import java.io.FileOutputStream
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.CancellationException
import java.util.zip.ZipFile
import org.json.JSONObject

/** Pure file implementation: no Android or network APIs, so crash/ZIP behavior is JVM tested. */
internal class WebContentFiles(
    private val root: File,
    bundled: JSONObject,
    private val nativeVersion: Int,
    private val openBundled: (String) -> InputStream?
) {
    private data class Entry(val path: String, val size: Long, val hash: String)
    private data class Metadata(val json: JSONObject, val version: Int, val hash: String, val files: Map<String, Entry>)
    private val base = parseMetadata(bundled)
    private val stateFile = File(root, "state.json")
    private var state = runCatching { JSONObject(stateFile.readText(Charsets.UTF_8)) }.getOrElse { JSONObject() }
    private var active = state.optString("active", BUNDLED)
    private var metadata = metadataFor(active) ?: base.also { active = BUNDLED }

    init { require(root.isDirectory || root.mkdirs()) { "Cannot create web update storage" } }

    @Synchronized fun currentVersion(): Int = metadata.version
    @Synchronized fun currentFilesHash(): String = metadata.hash
    @Synchronized fun discardPending(version: Int, filesHash: String) {
        val pending = state.optString("pending")
        val candidate = metadataFor(pending) ?: return
        if (candidate.version != version || candidate.hash != filesHash) return
        saveState(JSONObject(state.toString()).also { it.remove("pending") })
        cleanup()
    }

    /** IO failure recovery must retain the HTTPS origin and its migrated localStorage. */
    @Synchronized fun useBundledForSession() { active = BUNDLED; metadata = base }

    @Synchronized fun stage(web: JSONObject, archive: File) {
        checkCancelled()
        val previousState = JSONObject(state.toString())
        val target = parseMetadata(web)
        require(target.version > currentVersion()) { "Web update is not newer" }
        require(archive.isFile && archive.length() <= MAX_TOTAL_BYTES) { "Invalid web archive size" }
        val id = "v${target.version}-${UUID.randomUUID()}"
        val staging = File(root, ".stage-${UUID.randomUUID()}")
        require(staging.mkdirs()) { "Cannot stage web update" }
        try {
            val content = File(staging, "files").apply { mkdirs() }
            ZipFile(archive).use { zip ->
                val included = HashSet<String>()
                val entries = zip.entries()
                while (entries.hasMoreElements()) {
                    checkCancelled()
                    val entry = entries.nextElement()
                    require(!entry.isDirectory && validPath(entry.name)) { "Unsafe ZIP path" }
                    require(included.add(entry.name)) { "Duplicate ZIP entry" }
                    val expected = target.files[entry.name] ?: throw IllegalArgumentException("Unexpected ZIP entry")
                    require(entry.size == expected.size) { "ZIP file size mismatch" }
                    zip.getInputStream(entry).use { copyVerified(it, File(content, entry.name), expected) }
                }
                for ((path, expected) in target.files) {
                    checkCancelled()
                    if (path in included) continue
                    val source = when {
                        metadata.files[path] == expected -> open(path)
                        base.files[path] == expected -> openBundled(path)
                        else -> null
                    } ?: throw IllegalArgumentException("Missing changed web file: $path")
                    source.use { copyVerified(it, File(content, path), expected) }
                }
            }
            durableWrite(File(staging, "metadata.json"), web.toString())
            checkCancelled()
            Files.move(staging.toPath(), File(root, id).toPath(), StandardCopyOption.ATOMIC_MOVE)
            checkCancelled()
            saveState(JSONObject(state.toString()).put("pending", id))
            if (Thread.currentThread().isInterrupted) {
                saveState(previousState)
                cleanup()
                throw CancellationException("Web update cancelled")
            }
            cleanup()
        } finally {
            deleteWithinRoot(staging)
        }
    }

    /** A candidate gets exactly one boot attempt until application code acknowledges success. */
    @Synchronized fun prepareLaunch() {
        var next = JSONObject(state.toString())
        val previous = next.optString("previous", BUNDLED)
        if (next.optString("attempting").isNotEmpty()) {
            active = if (usable(previous)) previous else BUNDLED
            next.remove("attempting")
            next.remove("pending")
        } else {
            if (!usable(active)) active = if (usable(previous)) previous else BUNDLED
            val pending = next.optString("pending")
            next.remove("pending")
            if (pending.isNotEmpty() && usable(pending)) {
                next.put("previous", active).put("attempting", pending)
                active = pending
            }
        }
        metadata = metadataFor(active) ?: base.also { active = BUNDLED }
        // A new APK may include a newer baseline or a different native compatibility range.
        if (metadata.version < base.version) {
            active = BUNDLED; metadata = base; next.remove("attempting")
        }
        next.put("active", active)
        saveState(next)
        cleanup()
    }

    @Synchronized fun markHealthy() {
        if (state.optString("attempting") == active) {
            saveState(JSONObject(state.toString()).also { it.remove("attempting") })
        }
    }

    @Synchronized fun open(path: String): InputStream? {
        if (!validPath(path) || path !in metadata.files) return null
        return if (active == BUNDLED) runCatching { openBundled(path) }.getOrNull()
        else runCatching { File(File(File(root, active), "files"), path).inputStream() }.getOrNull()
    }

    private fun metadataFor(id: String): Metadata? {
        if (id == BUNDLED) return base
        if (!validId(id)) return null
        return runCatching { parseMetadata(JSONObject(File(File(root, id), "metadata.json").readText(Charsets.UTF_8))) }.getOrNull()
    }

    private fun usable(id: String): Boolean {
        if (id == BUNDLED) return true
        val candidate = metadataFor(id) ?: return false
        if (candidate.version < base.version) return false
        val content = File(File(root, id), "files")
        return runCatching {
            val actual = content.walkTopDown().filter { it.isFile }.map { it.relativeTo(content).invariantSeparatorsPath }.toSet()
            require(actual == candidate.files.keys) { "Stored file set changed" }
            candidate.files.values.forEach { expected ->
                val file = File(content, expected.path)
                require(file.length() == expected.size && file.inputStream().use { digest(it) } == expected.hash) { "Stored web file changed" }
            }
        }.isSuccess
    }

    private fun parseMetadata(value: JSONObject): Metadata {
        try {
            val version = value.getInt("versionCode")
            require(version > 0 && nativeVersion in value.getInt("minNativeVersionCode")..value.getInt("maxNativeVersionCode")) { "Incompatible native version" }
            val entries = value.getJSONArray("files")
            require(entries.length() in 1..MAX_FILES) { "Invalid web file count" }
            val files = linkedMapOf<String, Entry>()
            var total = 0L
            var lastPath = ""
            for (i in 0 until entries.length()) {
                val item = entries.getJSONObject(i)
                val path = item.getString("path")
                val size = item.getLong("size")
                val hash = item.getString("sha256")
                require(validPath(path) && path > lastPath) { "Unsafe, unsorted or duplicate web path" }
                require(size in 0..MAX_FILE_BYTES && SHA256.matches(hash)) { "Invalid web file metadata" }
                lastPath = path
                total += size
                require(total <= MAX_TOTAL_BYTES) { "Web update is too large" }
                files[path] = Entry(path, size, hash)
            }
            require("index.html" in files) { "Missing index.html" }
            val canonical = files.values.joinToString(",", "[", "]") {
                // Paths contain only the safe ASCII set above. Android JSON.quote escapes '/'
                // differently from JSON.stringify, so construct this restricted field directly.
                "{\"path\":\"${it.path}\",\"size\":${it.size},\"sha256\":\"${it.hash}\"}"
            }
            val hash = value.getString("filesHash")
            require(SHA256.matches(hash) && digest(canonical.byteInputStream(Charsets.UTF_8)) == hash) { "Web file list hash mismatch" }
            return Metadata(value, version, hash, files)
        } catch (e: org.json.JSONException) {
            throw IllegalArgumentException("Invalid web metadata", e)
        }
    }

    private fun copyVerified(source: InputStream, output: File, expected: Entry) {
        require(output.parentFile!!.isDirectory || output.parentFile!!.mkdirs()) { "Cannot create web directory" }
        val digest = MessageDigest.getInstance("SHA-256")
        var count = 0L
        FileOutputStream(output).use { sink ->
            val bytes = ByteArray(32 * 1024)
            while (true) {
                checkCancelled()
                val read = source.read(bytes)
                if (read < 0) break
                count += read
                require(count <= expected.size) { "Expanded web file too large" }
                sink.write(bytes, 0, read); digest.update(bytes, 0, read)
            }
            require(count == expected.size && hex(digest.digest()) == expected.hash) { "Web file hash mismatch" }
            sink.fd.sync()
        }
    }

    private fun saveState(next: JSONObject) { durableWrite(stateFile, next.toString()); state = next }
    private fun checkCancelled() { if (Thread.currentThread().isInterrupted) throw CancellationException("Web update cancelled") }
    private fun cleanup() {
        val keep = setOf(active, state.optString("previous"), state.optString("pending"))
        root.listFiles()?.filter { it.isDirectory && (validId(it.name) || it.name.startsWith(".stage-")) && it.name !in keep }
            ?.forEach { deleteWithinRoot(it) }
    }
    private fun deleteWithinRoot(file: File) {
        require(file.canonicalFile.toPath().startsWith(root.canonicalFile.toPath()) && file.canonicalFile != root.canonicalFile)
        if (file.exists()) file.deleteRecursively()
    }

    companion object {
        private const val BUNDLED = "bundled"
        private const val MAX_FILES = 512
        private const val MAX_FILE_BYTES = 16L * 1024 * 1024
        private const val MAX_TOTAL_BYTES = 64L * 1024 * 1024
        private val SHA256 = Regex("[0-9a-f]{64}")
        private fun validId(value: String) = Regex("v[0-9]+-[a-f0-9-]{36}").matches(value)
        private fun validPath(path: String): Boolean = path.length in 1..240 &&
            Regex("[A-Za-z0-9_./-]+").matches(path) && !path.startsWith('/') &&
            path.split('/').all { it.isNotEmpty() && it != "." && it != ".." && !it.endsWith('.') }
        private fun hex(value: ByteArray) = value.joinToString("") { "%02x".format(it) }
        private fun digest(input: InputStream): String {
            val digest = MessageDigest.getInstance("SHA-256")
            val bytes = ByteArray(32 * 1024)
            while (true) { val count = input.read(bytes); if (count < 0) break; digest.update(bytes, 0, count) }
            return hex(digest.digest())
        }
    }
}

/** fsync before atomic rename prevents a torn state/backup from replacing the previous file. */
internal fun durableWrite(file: File, text: String) {
    require(file.parentFile!!.isDirectory || file.parentFile!!.mkdirs()) { "Cannot create storage" }
    val pending = File(file.parentFile, ".${file.name}-${UUID.randomUUID()}.tmp")
    try {
        FileOutputStream(pending).use { it.write(text.toByteArray(Charsets.UTF_8)); it.fd.sync() }
        Files.move(pending.toPath(), file.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
    } finally { pending.delete() }
}
