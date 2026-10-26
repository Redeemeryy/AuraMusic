package com.jelly.audio.updates

import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.*
import org.junit.Test
import java.nio.file.Files

class UpdateDownloaderTest {
    private val url = "https://github.com/Redeemeryy/AuraMusic/releases/download/v1/a.apk"
    private val data = "hello world".toByteArray()
    private val hash = "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
    @Test fun partialFileResumesAndVerifiedOutputMatches() {
        val dir = Files.createTempDirectory("aura-resume").toFile()
        try {
            dir.resolve("$hash.part").writeText("hello ")
            var requestedRange: String? = null
            val client = OkHttpClient.Builder().addInterceptor { chain ->
                requestedRange = chain.request().header("Range")
                Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(206).message("Partial")
                    .header("Content-Range", "bytes 6-10/11").body("world".toResponseBody()).build()
            }.build()
            val file = UpdateDownloader(client).download(DownloadSpec(url, 11, hash), dir)
            assertEquals("bytes=6-", requestedRange)
            assertArrayEquals(data, file.readBytes())
        } finally { dir.deleteRecursively() }
    }
    @Test fun corruptedCompleteCacheIsNeverReusedAndWrongHashFails() {
        val dir = Files.createTempDirectory("aura-hash").toFile()
        try {
            dir.resolve("$hash.bin").writeText("bad content")
            val client = OkHttpClient.Builder().addInterceptor { chain ->
                Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK").body("bad content".toResponseBody()).build()
            }.build()
            assertThrows(Exception::class.java) { UpdateDownloader(client).download(DownloadSpec(url, 11, hash), dir) }
            assertFalse(dir.resolve("$hash.bin").exists())
        } finally { dir.deleteRecursively() }
    }
    @Test fun redirectToUntrustedHostIsRejectedBeforeRequest() {
        val dir = Files.createTempDirectory("aura-redirect").toFile()
        try {
            var calls = 0
            val client = OkHttpClient.Builder().addInterceptor { chain ->
                calls++
                Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(302).message("Moved")
                    .header("Location", "https://attacker.test/a.apk").body(ByteArray(0).toResponseBody()).build()
            }.build()
            assertThrows(Exception::class.java) { UpdateDownloader(client).download(DownloadSpec(url, 11, hash), dir) }
            assertTrue(calls in 1..3)
        } finally { dir.deleteRecursively() }
    }
}
