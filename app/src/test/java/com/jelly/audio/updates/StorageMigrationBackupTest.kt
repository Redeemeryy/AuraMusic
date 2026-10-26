package com.jelly.audio.updates

import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class StorageMigrationBackupTest {
    @get:Rule val temporary = TemporaryFolder()
    private val full = "{\"schema\":1,\"entries\":[[\"plugin\",\"source\"],[\"favorites\",\"[1]\"]]}"
    private val empty = "{\"schema\":1,\"entries\":[]}"
    @Test fun backupIsDurableAndOnlyExactRestoredSnapshotCanCompleteMigration() {
        val root = temporary.newFolder()
        StorageMigrationBackup(root).capture(full)
        val restarted = StorageMigrationBackup(root)
        assertFalse(restarted.isComplete())
        assertEquals(full, restarted.snapshot())
        try { restarted.confirm(empty); fail("Empty confirmation accepted") } catch (_: IllegalArgumentException) {}
        restarted.confirm(full)
        assertTrue(StorageMigrationBackup(root).isComplete())
        assertEquals(full, restarted.snapshot())
    }
    @Test fun emptySnapshotCannotReplaceAnExistingNonemptyBackup() {
        val backup = StorageMigrationBackup(temporary.newFolder())
        backup.capture(full)
        try { backup.capture(empty); fail("Backup overwritten") } catch (_: IllegalArgumentException) {}
        assertEquals(full, backup.snapshot())
    }
    @Test fun newerLegacySnapshotKeepsPreviousBackupForRecovery() {
        val root = temporary.newFolder()
        val backup = StorageMigrationBackup(root)
        backup.capture(full)
        val newer = full.replace("[1]", "[1,2]")
        backup.capture(newer)
        assertEquals(newer, backup.snapshot())
        assertTrue(root.listFiles()!!.any { it.readText() == full })
    }
    @Test fun duplicateKeysAndMalformedEntriesAreRejected() {
        val backup = StorageMigrationBackup(temporary.newFolder())
        listOf("{\"schema\":1,\"entries\":[[\"x\",\"1\"],[\"x\",\"2\"]]}", "{\"schema\":1,\"entries\":[[\"x\",1]]}").forEach {
            try { backup.capture(it); fail("Invalid snapshot accepted") } catch (_: IllegalArgumentException) {}
        }
    }
}
