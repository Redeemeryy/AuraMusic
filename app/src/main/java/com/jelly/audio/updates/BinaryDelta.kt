package com.jelly.audio.updates

import java.io.BufferedInputStream
import java.io.DataInputStream
import java.io.EOFException
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.InterruptedIOException
import java.io.RandomAccessFile
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import java.util.zip.CRC32
import java.util.zip.Inflater
import java.util.zip.InflaterInputStream

/** Bounded, streaming decoder for the documented aura-copy-v1 format. */
object BinaryDelta {
    const val MAX_APK_BYTES = 256L * 1024 * 1024
    const val MAX_PATCH_BYTES = 272L * 1024 * 1024
    private const val MAX_COMMANDS = 1_000_000
    private const val BUFFER_SIZE = 64 * 1024

    @Throws(IOException::class)
    fun apply(base: File, patch: File, output: File) {
        val destination = output.canonicalFile
        ensure(destination != base.canonicalFile && destination != patch.canonicalFile, "Output aliases input")
        ensure(base.isFile && patch.isFile, "Missing delta input")
        ensure(base.length() <= MAX_APK_BYTES && patch.length() in 120..MAX_PATCH_BYTES, "Input size exceeds limit")
        var temporary: File? = null
        try {
            DataInputStream(BufferedInputStream(patch.inputStream(), BUFFER_SIZE)).use { input ->
                val magic = ByteArray(8).also(input::readFully)
                ensure(magic.contentEquals("AURACPY1".toByteArray(Charsets.US_ASCII)), "Unknown delta format")
                val baseSize = input.readLong()
                val targetSize = input.readLong()
                val baseHash = ByteArray(32).also(input::readFully)
                val targetHash = ByteArray(32).also(input::readFully)
                val commandCount = input.readInt()
                val gzipSize = input.readLong()
                ensure(baseSize in 0..MAX_APK_BYTES && baseSize == base.length(), "Wrong base size")
                ensure(targetSize in 0..MAX_APK_BYTES, "Target size exceeds limit")
                ensure(commandCount in 0..MAX_COMMANDS && commandCount.toLong() <= targetSize, "Invalid command count")
                ensure(gzipSize >= 20 && gzipSize == patch.length() - 100, "Invalid compressed size")
                ensure(MessageDigest.isEqual(baseHash, sha256(base)), "Wrong base hash")
                checkInterrupted()
                val parent = destination.parentFile ?: throw IOException("Output directory is missing")
                ensure(parent.isDirectory, "Output directory is missing")
                val staged = File.createTempFile(".aura-delta-", ".tmp", parent)
                temporary = staged
                val digest = MessageDigest.getInstance("SHA-256")
                var written = 0L
                StrictGzipInputStream(input, gzipSize, targetSize + 17L * commandCount).use { gzip ->
                    val commands = DataInputStream(gzip)
                    RandomAccessFile(base, "r").use { source ->
                        FileOutputStream(staged).use { target ->
                            val bytes = ByteArray(BUFFER_SIZE)
                            repeat(commandCount) {
                                checkInterrupted()
                                val operation = commands.readUnsignedByte()
                                ensure(operation == 1 || operation == 2, "Unknown delta command")
                                val offset = if (operation == 1) commands.readLong() else 0L
                                val length = commands.readLong()
                                ensure(length > 0 && length <= targetSize - written, "Invalid output range")
                                if (operation == 1) {
                                    ensure(offset >= 0 && offset <= baseSize && length <= baseSize - offset, "Invalid COPY range")
                                    source.seek(offset)
                                }
                                var remaining = length
                                while (remaining > 0) {
                                    checkInterrupted()
                                    val count = minOf(bytes.size.toLong(), remaining).toInt()
                                    if (operation == 1) source.readFully(bytes, 0, count) else commands.readFully(bytes, 0, count)
                                    target.write(bytes, 0, count)
                                    digest.update(bytes, 0, count)
                                    remaining -= count
                                }
                                written += length
                            }
                            ensure(commands.read() == -1, "Extra delta commands")
                            ensure(written == targetSize, "Wrong output size")
                            ensure(MessageDigest.isEqual(targetHash, digest.digest()), "Wrong output hash")
                            target.fd.sync()
                        }
                    }
                }
            }
            checkInterrupted()
            // The temporary file is a sibling; the original is untouched on validation failure.
            Files.move(temporary!!.toPath(), destination.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        } finally {
            temporary?.delete()
        }
    }

    private fun sha256(file: File): ByteArray {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val bytes = ByteArray(BUFFER_SIZE)
            while (true) {
                checkInterrupted()
                val count = input.read(bytes)
                if (count < 0) break
                digest.update(bytes, 0, count)
            }
        }
        return digest.digest()
    }

    private fun checkInterrupted() {
        if (Thread.currentThread().isInterrupted) throw InterruptedIOException("Delta cancelled")
    }

    private fun ensure(condition: Boolean, message: String) {
        if (!condition) throw IOException(message)
    }

    private class LimitedInputStream(private val source: InputStream, var remaining: Long) : InputStream() {
        override fun read(): Int {
            if (remaining == 0L) return -1
            val value = source.read()
            if (value < 0) throw EOFException("Truncated deflate stream")
            remaining--
            return value
        }
        override fun read(bytes: ByteArray, offset: Int, length: Int): Int {
            if (length == 0) return 0
            if (remaining == 0L) return -1
            val count = source.read(bytes, offset, minOf(length.toLong(), remaining).toInt())
            if (count < 0) throw EOFException("Truncated deflate stream")
            remaining -= count
            return count
        }
    }

    // GZIPInputStream accepts concatenated members/trailing junk. The format allows neither.
    private class StrictGzipInputStream(private val source: DataInputStream, size: Long, private val maxBytes: Long) : InputStream() {
        private val limited: LimitedInputStream
        private val inflater = Inflater(true)
        private val deflated: InflaterInputStream
        private val crc = CRC32()
        private var count = 0L
        private var verified = false

        init {
            val header = ByteArray(10)
            try {
                source.readFully(header)
                ensure(header[0] == 0x1f.toByte() && header[1] == 0x8b.toByte() && header[2] == 8.toByte() && header[3] == 0.toByte(), "Unsupported gzip header")
                limited = LimitedInputStream(source, size - 18)
                deflated = InflaterInputStream(limited, inflater, BUFFER_SIZE)
            } catch (error: Exception) {
                inflater.end()
                throw error
            }
        }

        override fun read(): Int {
            val byte = ByteArray(1)
            return if (read(byte, 0, 1) < 0) -1 else byte[0].toInt() and 0xff
        }

        override fun read(bytes: ByteArray, offset: Int, length: Int): Int {
            if (length == 0) return 0
            if (verified) return -1
            val read = deflated.read(bytes, offset, length)
            if (read >= 0) {
                count += read
                ensure(count <= maxBytes, "Expanded delta exceeds limit")
                crc.update(bytes, offset, read)
                return read
            }
            ensure(inflater.finished() && limited.remaining == 0L && inflater.remaining == 0, "Extra or incomplete deflate data")
            val expectedCrc = readLittleEndianInt()
            val expectedSize = readLittleEndianInt()
            ensure(expectedCrc == crc.value && expectedSize == (count and 0xffffffffL), "Invalid gzip checksum")
            ensure(source.read() == -1, "Extra patch data")
            verified = true
            return -1
        }

        private fun readLittleEndianInt(): Long {
            var value = 0L
            repeat(4) { shift -> value = value or (source.readUnsignedByte().toLong() shl (8 * shift)) }
            return value
        }

        override fun close() { inflater.end() }
    }
}
