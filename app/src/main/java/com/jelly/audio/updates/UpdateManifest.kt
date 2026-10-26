package com.jelly.audio.updates

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.URI
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.security.KeyFactory
import java.security.MessageDigest
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import java.util.Base64

data class DownloadSpec(val url: String, val size: Long, val sha256: String)
data class PatchSpec(val fromHash: String, val download: DownloadSpec)
data class ApkUpdate(val versionCode: Int, val versionName: String, val certificateSha256: String,
                     val download: DownloadSpec, val patches: List<PatchSpec>) {
    fun patchFor(hash: String): DownloadSpec? = patches.firstOrNull { it.fromHash == hash && it.download.size < download.size }?.download
}
data class WebUpdate(val versionCode: Int, val minNativeVersionCode: Int, val maxNativeVersionCode: Int,
                     val filesHash: String, val full: DownloadSpec, val patches: List<PatchSpec>, val json: JSONObject) {
    fun patchFor(hash: String): DownloadSpec? = patches.firstOrNull { it.fromHash == hash && it.download.size < full.size }?.download
}

/** Only construct update choices from a fully authenticated and bounded payload. */
class UpdateManifest private constructor(val releaseVersion: String, val notes: String, val apk: ApkUpdate, val web: WebUpdate) {
    fun select(nativeVersion: Int, webVersion: Int): String? = when {
        apk.versionCode > nativeVersion -> "apk"
        nativeVersion in web.minNativeVersionCode..web.maxNativeVersionCode && web.versionCode > webVersion -> "web"
        else -> null
    }

    companion object {
        const val MANIFEST_URL = "https://github.com/Redeemeryy/AuraMusic/releases/latest/download/update-manifest.json"
        const val MAX_MANIFEST = 1024 * 1024
        const val MAX_APK = 256L * 1024 * 1024
        const val MAX_WEB = 64L * 1024 * 1024
        private val hashPattern = Regex("[a-f0-9]{64}")

        fun verify(bytes: ByteArray, publicKey: ByteArray, packageName: String): UpdateManifest {
            require(bytes.size in 1..MAX_MANIFEST) { "更新清单过大或为空" }
            val envelope = JSONObject(utf8(bytes))
            val payload = Base64.getDecoder().decode(envelope.getString("payload"))
            val signature = Base64.getDecoder().decode(envelope.getString("signature"))
            require(payload.size in 1..MAX_MANIFEST && signature.size in 256..1024) { "更新清单格式无效" }
            val key = KeyFactory.getInstance("RSA").generatePublic(X509EncodedKeySpec(publicKey))
            require(Signature.getInstance("SHA256withRSA").run { initVerify(key); update(payload); verify(signature) }) { "更新清单签名验证失败" }
            val root = JSONObject(utf8(payload))
            require(number(root, "schema", 1, 1) == 1L) { "不支持的更新清单版本" }
            require(root.getString("packageName") == packageName) { "更新包不属于当前应用" }
            val version = text(root, "releaseVersion", 100)
            val notes = root.optString("notes", "")
            require(notes.length <= 32_768) { "更新说明过长" }
            val a = root.getJSONObject("apk")
            val apk = ApkUpdate(version(a), text(a, "versionName", 100), hash(a, "certificateSha256"), download(a, MAX_APK), patches(a, MAX_APK, "fromSha256", true))
            val w = root.getJSONObject("web")
            val minimum = number(w, "minNativeVersionCode", 1, Int.MAX_VALUE.toLong()).toInt()
            val maximum = number(w, "maxNativeVersionCode", minimum.toLong(), Int.MAX_VALUE.toLong()).toInt()
            val filesHash = hash(w, "filesHash")
            validateFiles(w.getJSONArray("files"), filesHash)
            val web = WebUpdate(version(w), minimum, maximum, filesHash, download(w.getJSONObject("full"), MAX_WEB), patches(w, MAX_WEB, "fromFilesHash", false), w)
            return UpdateManifest(version, notes, apk, web)
        }

        private fun validateFiles(files: JSONArray, expectedHash: String) {
            require(files.length() in 1..512) { "网页资源数量无效" }
            var previous: String? = null
            var total = 0L
            val canonical = StringBuilder("[")
            for (i in 0 until files.length()) {
                val file = files.getJSONObject(i)
                val path = text(file, "path", 240)
                require(!path.startsWith('/') && !path.contains('\\') && path.none { it.code < 32 || it in "%?#:" } && path.split('/').none { it.isEmpty() || it == "." || it == ".." }) { "网页资源路径无效" }
                require(previous == null || previous < path) { "网页资源必须按路径排序且不可重复" }
                previous = path
                val size = number(file, "size", 0, 16L * 1024 * 1024)
                total += size
                require(total <= MAX_WEB) { "网页资源过大" }
                if (i > 0) canonical.append(',')
                canonical.append("{\"path\":").append(JSONObject.quote(path).replace("\\/", "/"))
                    .append(",\"size\":").append(size).append(",\"sha256\":\"").append(hash(file, "sha256")).append("\"}")
            }
            canonical.append(']')
            require(sha256(canonical.toString().toByteArray(Charsets.UTF_8)) == expectedHash) { "网页资源清单校验失败" }
        }

        private fun patches(obj: JSONObject, max: Long, from: String, apk: Boolean): List<PatchSpec> {
            val list = obj.getJSONArray("patches")
            require(list.length() <= 100) { "增量包数量无效" }
            val seen = mutableSetOf<String>()
            return (0 until list.length()).map {
                val p = list.getJSONObject(it)
                if (apk) require(p.getString("format") == "aura-copy-v1") { "不支持的增量格式" }
                val source = hash(p, from)
                require(seen.add(source)) { "增量基准重复" }
                PatchSpec(source, download(p, max))
            }
        }
        private fun download(obj: JSONObject, max: Long): DownloadSpec {
            val url = text(obj, "url", 4096)
            requireTrustedUrl(url)
            return DownloadSpec(url, number(obj, "size", 1, max), hash(obj, "sha256"))
        }
        private fun version(obj: JSONObject) = number(obj, "versionCode", 1, Int.MAX_VALUE.toLong()).toInt()
        private fun number(obj: JSONObject, name: String, min: Long, max: Long): Long {
            val raw = obj.get(name)
            require(raw is Int || raw is Long) { "$name 必须为整数" }
            return (raw as Number).toLong().also { require(it in min..max) { "$name 超出范围" } }
        }
        private fun text(obj: JSONObject, name: String, max: Int) = obj.getString(name).also { require(it.isNotBlank() && it.length <= max) { "$name 无效" } }
        private fun hash(obj: JSONObject, name: String) = obj.getString(name).also { require(hashPattern.matches(it)) { "$name 无效" } }
        private fun utf8(bytes: ByteArray) = Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString()

        /** Every redirect is checked before the next request, including scheme and exact host. */
        fun requireTrustedUrl(value: String) {
            val url = URI(value)
            require(url.scheme == "https" && url.userInfo == null && url.fragment == null && url.port in listOf(-1, 443)) { "更新仅允许可信 HTTPS 地址" }
            require(url.path.split('/').none { it == "." || it == ".." } && !url.path.contains('\\')) { "更新下载路径无效" }
            when (url.host?.lowercase()) {
                "github.com" -> require(url.rawPath.startsWith("/Redeemeryy/AuraMusic/releases/download/") || url.rawPath.startsWith("/Redeemeryy/AuraMusic/releases/latest/download/")) { "更新来源仓库无效" }
                "release-assets.githubusercontent.com", "objects.githubusercontent.com", "releases.githubusercontent.com" -> Unit
                else -> throw IllegalArgumentException("更新下载域名不可信")
            }
        }
        fun sha256(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        fun sha256(file: File): String {
            val digest = MessageDigest.getInstance("SHA-256")
            file.inputStream().use { input -> val buffer = ByteArray(64 * 1024); while (true) { val n = input.read(buffer); if (n < 0) break; digest.update(buffer, 0, n) } }
            return digest.digest().joinToString("") { "%02x".format(it) }
        }
    }
}
