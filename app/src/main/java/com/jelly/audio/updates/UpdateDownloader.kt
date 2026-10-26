package com.jelly.audio.updates

import okhttp3.OkHttpClient
import okhttp3.Call
import okhttp3.Request
import okhttp3.Response
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.concurrent.CancellationException
import java.util.concurrent.TimeUnit

class UpdateDownloader(client: OkHttpClient = OkHttpClient(),
                       private val cancelled: () -> Boolean = { false },
                       private val progress: (Long, Long) -> Unit = { _, _ -> }) {
    private val client = client.newBuilder().followRedirects(false).followSslRedirects(false)
        .connectTimeout(20, TimeUnit.SECONDS).readTimeout(30, TimeUnit.SECONDS).build()
    @Volatile private var call: Call? = null
    fun cancel() { call?.cancel() }
    fun close() { cancel(); client.dispatcher.executorService.shutdown(); client.connectionPool.evictAll() }
    private fun ensureActive() { if (cancelled() || Thread.currentThread().isInterrupted) throw CancellationException("已取消更新") }

    private fun response(url: String, offset: Long = 0): Response {
        var current = url
        repeat(6) {
            ensureActive()
            UpdateManifest.requireTrustedUrl(current)
            val request = Request.Builder().url(current).header("Accept-Encoding", "identity")
                .apply { if (offset > 0) header("Range", "bytes=$offset-") }.build()
            val requestCall = client.newCall(request)
            call = requestCall
            val result = requestCall.execute()
            if (result.code in listOf(301, 302, 303, 307, 308)) {
                val location = result.header("Location")
                val next = location?.let { result.request.url.resolve(it)?.toString() }
                result.close()
                require(next != null) { "更新下载跳转无效" }
                current = next
            } else {
                if (result.header("Content-Encoding") !in listOf(null, "identity")) {
                    result.close()
                    throw IllegalArgumentException("更新服务器返回了意外压缩内容")
                }
                return result
            }
        }
        throw IOException("更新下载跳转过多")
    }

    fun manifest(): ByteArray = response(UpdateManifest.MANIFEST_URL).use { result ->
        require(result.code == 200) { "检查更新失败：HTTP ${result.code}" }
        val body = result.body ?: throw IOException("更新清单为空")
        require(body.contentLength() <= UpdateManifest.MAX_MANIFEST) { "更新清单过大" }
        val out = ByteArrayOutputStream()
        body.byteStream().use { input ->
            val buffer = ByteArray(8192)
            while (true) {
                ensureActive()
                val count = input.read(buffer)
                if (count < 0) break
                require(out.size() + count <= UpdateManifest.MAX_MANIFEST) { "更新清单过大" }
                out.write(buffer, 0, count)
            }
        }
        out.toByteArray()
    }

    fun download(spec: DownloadSpec, directory: File): File {
        ensureActive()
        require(spec.size in 1..UpdateManifest.MAX_APK && Regex("[a-f0-9]{64}").matches(spec.sha256))
        UpdateManifest.requireTrustedUrl(spec.url)
        require(directory.isDirectory || directory.mkdirs()) { "无法创建更新缓存目录" }
        val complete = File(directory, "${spec.sha256}.bin")
        val partial = File(directory, "${spec.sha256}.part")
        if (valid(complete, spec)) return complete
        complete.delete()
        var last: Exception? = null
        repeat(3) {
            ensureActive()
            try {
                if (partial.length() > spec.size) partial.delete()
                if (partial.length() == spec.size) {
                    if (valid(partial, spec)) {
                        check(partial.renameTo(complete)) { "无法保存更新文件" }
                        return complete
                    }
                    partial.delete()
                }
                val offset = partial.length()
                response(spec.url, offset).use { result ->
                    if (result.code == 416 && offset > 0) { partial.delete(); throw IOException("服务器续传状态已变化，正在重新下载") }
                    val body = result.body ?: throw IOException("更新文件为空")
                    val append = ResumePolicy.validate(result.code, result.header("Content-Range"), body.contentLength(), offset, spec.size)
                    var total = if (append) offset else 0L
                    FileOutputStream(partial, append).use { output ->
                        body.byteStream().use { input ->
                            val buffer = ByteArray(64 * 1024)
                            while (true) {
                                ensureActive()
                                val count = input.read(buffer)
                                if (count < 0) break
                                require(count <= spec.size - total) { "下载文件超出清单大小" }
                                output.write(buffer, 0, count)
                                total += count
                                progress(total, spec.size)
                            }
                        }
                        output.fd.sync()
                    }
                }
                ensureActive()
                if (partial.length() != spec.size) throw IOException("下载中断，可重试续传")
                if (!valid(partial, spec)) { partial.delete(); throw IOException("更新文件哈希校验失败") }
                check(partial.renameTo(complete)) { "无法保存更新文件" }
                return complete
            } catch (error: Exception) {
                ensureActive()
                if (error is IllegalArgumentException) { partial.delete(); throw error }
                last = error
            }
        }
        throw last ?: IOException("更新下载失败")
    }

    private fun valid(file: File, spec: DownloadSpec): Boolean = file.isFile && file.length() == spec.size && UpdateManifest.sha256(file) == spec.sha256
}
