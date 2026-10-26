package com.jelly.audio.updates

import java.io.File
import java.security.MessageDigest
import org.json.JSONObject

internal class StorageMigrationBackup(private val root: File) {
    private val backup = File(root, "legacy-local-storage.json")
    private val complete = File(root, "migration-complete.sha256")

    @Synchronized fun capture(snapshot: String) {
        val incoming = parse(snapshot)
        require(!isComplete()) { "Storage migration is already complete" }
        if (backup.isFile) {
            val previous = backup.readText(Charsets.UTF_8)
            val previousValues = parse(previous)
            require(incoming.isNotEmpty() || previousValues.isEmpty()) { "Empty snapshot cannot overwrite existing data" }
            if (incoming == previousValues) return
            durableWrite(File(root, "legacy-local-storage.previous.json"), previous)
        }
        durableWrite(backup, snapshot)
    }

    @Synchronized fun snapshot(): String = backup.readText(Charsets.UTF_8).also { parse(it) }

    @Synchronized fun confirm(snapshot: String) {
        require(parse(snapshot) == parse(this.snapshot())) { "Migrated values differ from backup" }
        durableWrite(complete, backupHash())
    }

    @Synchronized fun isComplete(): Boolean = runCatching {
        complete.isFile && backup.isFile && complete.readText(Charsets.UTF_8) == backupHash()
    }.getOrDefault(false)

    private fun backupHash() = MessageDigest.getInstance("SHA-256").digest(backup.readBytes()).joinToString("") { "%02x".format(it) }
    private fun parse(snapshot: String): Map<String, String> {
        require(snapshot.toByteArray(Charsets.UTF_8).size <= 32 * 1024 * 1024) { "Storage snapshot too large" }
        try {
            val json = JSONObject(snapshot)
            require(json.getInt("schema") == 1) { "Unknown storage snapshot schema" }
            val entries = json.getJSONArray("entries")
            require(entries.length() <= 20000) { "Too many storage keys" }
            val result = linkedMapOf<String, String>()
            for (index in 0 until entries.length()) {
                val entry = entries.getJSONArray(index)
                require(entry.length() == 2 && entry.get(0) is String && entry.get(1) is String) { "Invalid storage entry" }
                require(!result.containsKey(entry.getString(0))) { "Duplicate storage key" }
                result[entry.getString(0)] = entry.getString(1)
            }
            return result
        } catch (e: org.json.JSONException) { throw IllegalArgumentException("Invalid storage snapshot", e) }
    }
}
