package com.jelly.audio.updates

import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.io.File
import java.nio.file.Files
import java.security.MessageDigest
import java.util.zip.GZIPOutputStream
import org.junit.Assert.*
import org.junit.Test

class BinaryDeltaTest {
    private fun hash(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes)
    private fun commands(block: DataOutputStream.() -> Unit): ByteArray = ByteArrayOutputStream().also { bytes -> DataOutputStream(bytes).use(block) }.toByteArray()
    private fun DataOutputStream.copy(offset: Long, length: Long) { writeByte(1); writeLong(offset); writeLong(length) }
    private fun DataOutputStream.insert(text: String) { val bytes = text.toByteArray(); writeByte(2); writeLong(bytes.size.toLong()); write(bytes) }
    private fun patch(base: ByteArray, target: ByteArray, count: Int, raw: ByteArray): ByteArray {
        val gzip = ByteArrayOutputStream().also { bytes -> GZIPOutputStream(bytes).use { it.write(raw) } }.toByteArray()
        return commands {
            writeBytes("AURACPY1"); writeLong(base.size.toLong()); writeLong(target.size.toLong())
            write(hash(base)); write(hash(target)); writeInt(count); writeLong(gzip.size.toLong()); write(gzip)
        }
    }
    private fun withFiles(block: (File, File, File) -> Unit) {
        val dir = Files.createTempDirectory("aura-delta-test").toFile()
        try { block(File(dir, "base"), File(dir, "patch"), File(dir, "output")) } finally { dir.deleteRecursively() }
    }
    private fun expectRejected(bytes: ByteArray, baseBytes: ByteArray = "abcdef".toByteArray()) = withFiles { base, delta, output ->
        base.writeBytes(baseBytes); delta.writeBytes(bytes); output.writeText("existing-output")
        try { BinaryDelta.apply(base, delta, output); fail("Malformed delta was accepted") } catch (expected: java.io.IOException) { }
        assertEquals("existing-output", output.readText())
        assertArrayEquals(baseBytes, base.readBytes())
        assertEquals(3, output.parentFile.listFiles()!!.size)
    }

    @Test fun reconstructsCopyInsertAndOverwritesOnlyAfterVerification() = withFiles { base, delta, output ->
        val original = "abcdef".toByteArray(); val target = "bcNEWabcdef!".toByteArray()
        base.writeBytes(original); output.writeText("old")
        delta.writeBytes(patch(original, target, 4, commands { copy(1, 2); insert("NEW"); copy(0, 6); insert("!") }))
        BinaryDelta.apply(base, delta, output)
        assertArrayEquals(target, output.readBytes())
    }

    @Test fun supportsEmptyOutput() = withFiles { base, delta, output ->
        base.writeBytes(byteArrayOf()); delta.writeBytes(patch(byteArrayOf(), byteArrayOf(), 0, byteArrayOf()))
        BinaryDelta.apply(base, delta, output); assertEquals(0L, output.length())
    }

    @Test fun rejectsWrongBaseAndTargetHashes() {
        val base = "abcdef".toByteArray()
        val valid = patch(base, base, 1, commands { copy(0, 6) })
        expectRejected(valid, "abcdeg".toByteArray())
        expectRejected(valid.clone().also { it[56] = (it[56].toInt() xor 1).toByte() })
    }

    @Test fun rejectsCopyOutsideBaseAndOutputBounds() {
        val base = "abcdef".toByteArray()
        for ((offset, length) in listOf(-1L to 1L, 0L to -1L, 6L to 1L, Long.MAX_VALUE to 2L, 5L to 2L, 0L to 7L, 0L to 0L)) {
            expectRejected(patch(base, base, 1, commands { copy(offset, length) }))
        }
        expectRejected(patch(base, "a".toByteArray(), 1, commands { copy(0, 2) }))
    }

    @Test fun rejectsBadCommandsSizeCountsAndTruncation() {
        val base = "abcdef".toByteArray()
        expectRejected(patch(base, base, 1, commands { writeByte(9) }))
        expectRejected(patch(base, base, 1, commands { writeByte(2); writeLong(7); writeBytes("1234567") }))
        expectRejected(patch(base, base, 1, commands { writeByte(2); writeLong(0) }))
        expectRejected(patch(base, base, 1, commands { writeByte(2); writeLong(-1) }))
        expectRejected(patch(base, base, 1, commands { copy(0, 5) }))
        expectRejected(patch(base, base, 0, commands { copy(0, 6) }))
        val valid = patch(base, base, 1, commands { copy(0, 6) })
        for (size in listOf(0, 7, 99, valid.size - 1)) expectRejected(valid.copyOf(size))
        expectRejected(valid.clone().also { it[0] = 0 })
        expectRejected(valid.clone().also { java.nio.ByteBuffer.wrap(it).putLong(16, 256L * 1024 * 1024 + 1) })
        expectRejected(valid.clone().also { java.nio.ByteBuffer.wrap(it).putInt(88, 1_000_001) })
    }

    @Test fun rejectsExtraCommandsTrailingBytesMembersAndBrokenGzip() {
        val base = "abcdef".toByteArray()
        expectRejected(patch(base, base, 1, commands { copy(0, 6); insert("extra") }))
        val valid = patch(base, base, 1, commands { copy(0, 6) })
        expectRejected(valid + byteArrayOf(0))
        val extraMember = valid + valid.copyOfRange(100, valid.size)
        java.nio.ByteBuffer.wrap(extraMember).putLong(92, (extraMember.size - 100).toLong())
        expectRejected(extraMember)
        expectRejected(valid.clone().also { it[it.size - 8] = (it[it.size - 8].toInt() xor 1).toByte() })
        expectRejected(valid.clone().also { it[103] = 8 })
    }

    @Test fun refusesToOverwriteInputs() = withFiles { base, delta, _ ->
        val original = "abcdef".toByteArray()
        base.writeBytes(original); delta.writeBytes(patch(original, original, 1, commands { copy(0, 6) }))
        try { BinaryDelta.apply(base, delta, base); fail("Input overwritten") } catch (expected: java.io.IOException) { }
        assertArrayEquals(original, base.readBytes())
    }

    // Opt-in integration: applies the Node-generated release patch through the real JVM engine.
    @Test fun rebuildsReleaseApkWhenIntegrationPathsAreProvided() {
        val base = System.getenv("AURA_DELTA_BASE") ?: return
        val patch = System.getenv("AURA_DELTA_PATCH") ?: return
        val target = System.getenv("AURA_DELTA_TARGET") ?: return
        val output = System.getenv("AURA_DELTA_OUTPUT") ?: return
        BinaryDelta.apply(File(base), File(patch), File(output))
        assertEquals(File(target).length(), File(output).length())
        assertArrayEquals(hash(File(target).readBytes()), hash(File(output).readBytes()))
    }
}
