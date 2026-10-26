package com.jelly.audio.updates

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.Signature
import java.util.Base64

class UpdateManifestTest {
    private val keys = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
    private val hash = "a".repeat(64)
    private fun asset() = JSONObject().put("url", "https://github.com/Redeemeryy/AuraMusic/releases/download/v2.0.0/app.apk")
        .put("size", 100).put("sha256", hash)
    private fun payload(): JSONObject {
        val files = JSONArray().put(JSONObject().put("path", "index.html").put("size", 1).put("sha256", hash))
        val canonical = "[{\"path\":\"index.html\",\"size\":1,\"sha256\":\"$hash\"}]"
        val filesHash = MessageDigest.getInstance("SHA-256").digest(canonical.toByteArray()).joinToString("") { "%02x".format(it) }
        return JSONObject().put("schema", 1).put("packageName", "com.salt.music").put("releaseVersion", "2.0.0").put("notes", "修复")
            .put("apk", asset().put("versionCode", 15).put("versionName", "2.0.0").put("certificateSha256", hash).put("patches", JSONArray()))
            .put("web", JSONObject().put("versionCode", 2).put("minNativeVersionCode", 14).put("maxNativeVersionCode", 15)
                .put("files", files).put("filesHash", filesHash).put("full", asset()).put("patches", JSONArray()))
    }
    private fun envelope(payload: JSONObject): ByteArray {
        val bytes = payload.toString().toByteArray(Charsets.UTF_8)
        val signature = Signature.getInstance("SHA256withRSA").apply { initSign(keys.private); update(bytes) }.sign()
        return JSONObject().put("payload", Base64.getEncoder().encodeToString(bytes)).put("signature", Base64.getEncoder().encodeToString(signature)).toString().toByteArray()
    }
    private fun read(payload: JSONObject = payload()) = UpdateManifest.verify(envelope(payload), keys.public.encoded, "com.salt.music")

    @Test fun authenticManifestPrefersNewNativeEvenWhenWebAlsoNew() {
        val manifest = read()
        assertEquals("apk", manifest.select(14, 1))
        assertEquals("web", manifest.select(15, 1))
        assertNull(manifest.select(15, 2))
        assertNull(manifest.select(16, 1))
    }
    @Test fun signatureTamperingAndOtherPackageAreRejected() {
        val signed = JSONObject(String(envelope(payload())))
        signed.put("payload", Base64.getEncoder().encodeToString(payload().put("releaseVersion", "forged").toString().toByteArray()))
        assertThrows(Exception::class.java) { UpdateManifest.verify(signed.toString().toByteArray(), keys.public.encoded, "com.salt.music") }
        assertThrows(Exception::class.java) { read(payload().put("packageName", "other.app")) }
    }
    @Test fun malformedNumbersFormatsAndUntrustedUrlsAreRejected() {
        for (bad in listOf(-1, 0, 1.5, 300_000_000)) {
            val p = payload(); p.getJSONObject("apk").put("size", bad)
            assertThrows(Exception::class.java) { read(p) }
        }
        for (url in listOf("http://github.com/Redeemeryy/AuraMusic/releases/download/v1/a", "https://github.com.evil.test/file", "https://github.com/evil/project/releases/download/v1/a", "https://user@github.com/Redeemeryy/AuraMusic/releases/download/v1/a")) {
            val p = payload(); p.getJSONObject("apk").put("url", url)
            assertThrows(Exception::class.java) { read(p) }
        }
        val p = payload(); p.getJSONObject("apk").getJSONArray("patches").put(asset().put("fromSha256", hash).put("format", "shell-script"))
        assertThrows(Exception::class.java) { read(p) }
    }
    @Test fun webTraversalAndMismatchedFileInventoryAreRejected() {
        val p = payload(); p.getJSONObject("web").getJSONArray("files").getJSONObject(0).put("path", "../index.html")
        assertThrows(Exception::class.java) { read(p) }
        val p2 = payload(); p2.getJSONObject("web").put("filesHash", "0".repeat(64))
        assertThrows(Exception::class.java) { read(p2) }
    }
    @Test fun patchRequiresExactInstalledBaseHashAndOtherwiseFullRemainsUsable() {
        val p = payload(); p.getJSONObject("apk").getJSONArray("patches").put(asset().put("size", 50).put("fromSha256", hash).put("format", "aura-copy-v1"))
        val manifest = read(p)
        assertNotNull(manifest.apk.patchFor(hash))
        assertNull(manifest.apk.patchFor("b".repeat(64)))
        assertEquals(100L, manifest.apk.download.size)
    }
    @Test fun githubPathCannotEscapeTheReleaseRepositoryBeforeHttpNormalization() {
        for (url in listOf("https://github.com/Redeemeryy/AuraMusic/releases/download/../../../../evil/other", "https://github.com/Redeemeryy/AuraMusic/releases/download/%2e%2e/%2e%2e/other")) {
            assertThrows(Exception::class.java) { UpdateManifest.requireTrustedUrl(url) }
        }
    }
    @Test fun webFileAndEntryLimitsMatchRuntimeStore() {
        for ((count, size) in listOf(513 to 1, 1 to (16 * 1024 * 1024 + 1))) {
            val p = payload()
            val files = JSONArray()
            val rows = (0 until count).map { n ->
                val path = "file${n.toString().padStart(4, '0')}.js"
                files.put(JSONObject().put("path", path).put("size", size).put("sha256", hash))
                "{\"path\":\"$path\",\"size\":$size,\"sha256\":\"$hash\"}"
            }
            val canonical = rows.joinToString(",", "[", "]")
            val filesHash = MessageDigest.getInstance("SHA-256").digest(canonical.toByteArray()).joinToString("") { "%02x".format(it) }
            p.getJSONObject("web").put("files", files).put("filesHash", filesHash)
            assertThrows(Exception::class.java) { read(p) }
        }
    }
}
