package com.jelly.audio.updates

import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.webkit.JavascriptInterface
import com.jelly.audio.MainActivity
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.lang.ref.WeakReference
import java.util.concurrent.CancellationException
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/** One serialized update job. Downloaded bytes never become executable until all checks pass. */
class NativeUpdater(private val activity: MainActivity, private val store: WebContentStore) {
    private val executor = Executors.newSingleThreadExecutor { task -> Thread(task, "AuraUpdater") }
    private val busy = AtomicBoolean(false)
    private val cancelled = AtomicBoolean(false)
    @Volatile private var closed = false
    @Volatile private var state = JSONObject().put("status", "idle").toString()
    @Volatile private var manifest: UpdateManifest? = null
    @Volatile private var kind: String? = null
    @Volatile private var readyApk: File? = null
    @Volatile private var readyWeb = false
    @Volatile private var stagedWeb: WebUpdate? = null
    @Volatile private var resumePending = false
    @Volatile private var workerThread: Thread? = null
    private val directory = File(activity.noBackupFilesDir, "updates").apply { mkdirs() }
    private val envelopeFile = File(directory, "manifest.json")
    private val preferences = activity.getSharedPreferences(INSTALL_PREFS, 0)
    private var lastProgress = 0L
    private val downloader = UpdateDownloader(cancelled = { cancelled.get() || closed }, progress = { done, total ->
        val now = System.currentTimeMillis()
        if (done == total || now - lastProgress >= 200) { lastProgress = now; emit("downloading", "正在下载更新", done, total) }
    })

    init {
        active = WeakReference(this)
        // A killed process may leave files; authenticate the saved envelope and every cached APK again.
        runJob {
            if (envelopeFile.isFile) {
                try {
                    val bytes = envelopeFile.inputStream().use { it.readBytesBounded(UpdateManifest.MAX_MANIFEST) }
                    accept(bytes)
                    val selected = manifest
                    if (kind == "apk" && selected != null) {
                        val cached = File(directory, "${selected.apk.download.sha256}.bin")
                        if (cached.isFile) { validateApk(cached, selected.apk); readyApk = cached; emit("ready_apk", "更新包已校验，可继续安装") }
                    }
                } catch (_: Exception) {
                    envelopeFile.delete()
                    manifest = null; kind = null; readyApk = null
                    emit("idle", "可重新检查更新")
                }
            }
            consumeInstallationResult()
        }
    }

    @JavascriptInterface fun getState(): String = state

    @JavascriptInterface fun check() = runJob {
        ensureNoInstaller()
        refreshManifest()
    }

    private fun refreshManifest() {
        emit("checking", "正在检查更新")
        val bytes = downloader.manifest()
        ensureActive()
        accept(bytes)
        val pending = File(directory, "manifest.tmp")
        FileOutputStream(pending).use { it.write(bytes); it.fd.sync() }
        check(pending.renameTo(envelopeFile)) { "无法保存签名更新清单" }
        pruneCache()
    }

    @JavascriptInterface fun start() = runJob {
        ensureNoInstaller()
        if (manifest == null) refreshManifest()
        val update = manifest ?: throw IllegalStateException("请先检查更新")
        kind = update.select(installedVersion(), store.currentVersion())
        readyWeb = false; readyApk = null; stagedWeb = null
        when (kind) {
            "apk" -> prepareApk(update.apk)
            "web" -> prepareWeb(update.web)
            else -> emit("current", "当前已是兼容的最新版本")
        }
    }

    @JavascriptInterface fun cancel() {
        if (closed) return
        if (JSONObject(state).optString("status") == "installing") return
        cancelled.set(true)
        downloader.cancel()
        workerThread?.interrupt()
        if (!busy.get()) {
            if (stagedWeb != null) runJob { discardStagedWeb(); emit("cancelled", "已取消，可重新检查或继续下载") }
            else emit("cancelled", "已取消，可重新检查或继续下载")
        }
    }

    @JavascriptInterface fun install() = runJob {
        val update = manifest ?: throw IllegalStateException("请先检查更新")
        val apk = readyApk ?: throw IllegalStateException("请先完成更新包下载")
        if (preferences.getInt("session", -1) >= 0) {
            consumeInstallationResult()
            if (preferences.getInt("result", Int.MIN_VALUE) == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                // Only a new user click can replace a stranded confirmation; never loop prompts on resume.
                val previous = preferences.getInt("session", -1)
                if (previous >= 0) activity.packageManager.packageInstaller.abandonSession(previous)
                preferences.edit().remove("session").remove("result").commit()
            }
            if (preferences.getInt("session", -1) >= 0) { emit("installing", "请在系统安装界面确认更新"); return@runJob }
        }
        emit("verifying", "正在核验安装包和签名")
        validateApk(apk, update.apk)
        ensureActive()
        if (!activity.packageManager.canRequestPackageInstalls()) {
            preferences.edit().putBoolean("awaitingPermission", true).apply()
            emit("ready_apk", "请允许此应用安装更新，返回后将继续；无需卸载应用")
            activity.runOnUiThread {
                if (!closed) try {
                    activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}")))
                } catch (_: Exception) { preferences.edit().remove("awaitingPermission").apply(); emit("ready_apk", "无法打开安装权限设置，请在系统设置中允许安装未知应用后重试") }
            }
            return@runJob
        }
        commitInstall(apk, update.apk)
    }

    @JavascriptInterface fun applyWebUpdate() {
        if (closed || !readyWeb || !busy.compareAndSet(false, true)) return
        readyWeb = false
        activity.runOnUiThread {
            if (!closed) try {
                activity.reloadUpdatedWebContent()
                stagedWeb = null
                emit("current", "界面更新已应用")
            } catch (error: Exception) { emit("error", "应用界面更新失败：${error.message}") }
            finally { busy.set(false) }
        }
    }

    fun onResume() {
        if (closed) return
        if (busy.get()) { resumePending = true; return }
        consumeInstallationResult()
        if (readyApk != null && preferences.getInt("result", Int.MIN_VALUE) == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            emit("ready_apk", "系统安装仍待确认；若安装窗口已关闭，可点击安装重新确认")
        }
        if (preferences.getBoolean("awaitingPermission", false)) {
            preferences.edit().remove("awaitingPermission").apply()
            if (activity.packageManager.canRequestPackageInstalls()) install()
            else emit("ready_apk", "尚未允许安装更新；本地数据已保留，可再次点击安装")
        }
    }

    fun close() {
        closed = true
        cancelled.set(true)
        downloader.close()
        executor.shutdownNow()
        if (active.get() === this) active.clear()
    }

    private fun accept(bytes: ByteArray) {
        val verified = activity.assets.open("update-public-key.der").use { key -> UpdateManifest.verify(bytes, key.readBytes(), activity.packageName) }
        manifest = verified
        readyApk = null; readyWeb = false
        kind = verified.select(installedVersion(), store.currentVersion())
        emit(if (kind == null) "current" else "available", if (kind == null) "当前已是兼容的最新版本" else "发现可用更新", total = when (kind) { "apk" -> verified.apk.download.size; "web" -> verified.web.full.size; else -> null })
    }

    private fun prepareApk(apk: ApkUpdate) {
        require(installedCertificates() == setOf(apk.certificateSha256)) { "当前应用签名与正式更新不同（可能是调试版）。为保留数据，不能覆盖安装；请勿卸载。" }
        val base = File(activity.applicationInfo.sourceDir)
        emit("verifying", "正在核验当前安装包基准")
        val baseHash = UpdateManifest.sha256(base)
        ensureActive()
        val patchSpec = apk.patchFor(baseHash)
        var output: File? = null
        if (patchSpec != null) {
            try {
                emit("downloading", "正在下载增量更新", 0, patchSpec.size)
                val patch = downloader.download(patchSpec, directory)
                ensureActive()
                emit("patching", "正在重建完整安装包")
                val rebuilt = File(directory, "${apk.download.sha256}.bin")
                BinaryDelta.apply(base, patch, rebuilt)
                ensureActive()
                validateApk(rebuilt, apk)
                output = rebuilt
            } catch (error: Exception) {
                ensureActive()
                emit("downloading", "增量更新不可用，正在改用完整安装包", 0, apk.download.size)
            }
        }
        if (output == null) {
            emit("downloading", "正在下载完整安装包", 0, apk.download.size)
            output = downloader.download(apk.download, directory)
        }
        ensureActive()
        emit("verifying", "正在校验安装包与签名")
        validateApk(output, apk)
        readyApk = output
        emit("ready_apk", "已校验完成，点击安装；系统可能要求确认，本地数据会保留")
    }

    private fun prepareWeb(web: WebUpdate) {
        val patchSpec = web.patchFor(store.currentFilesHash())
        if (patchSpec != null) {
            try {
                emit("downloading", "正在下载界面增量更新", 0, patchSpec.size)
                val patch = downloader.download(patchSpec, directory)
                ensureActive()
                emit("verifying", "正在校验界面资源")
                store.stage(web.json, patch)
                stagedWeb = web
                ensureActive()
                readyWeb = true
                emit("ready_web", "界面更新已就绪，点击应用后刷新；当前播放不会自动中断")
                return
            } catch (error: Exception) {
                ensureActive()
                emit("downloading", "界面增量不可用，正在下载完整资源", 0, web.full.size)
            }
        }
        emit("downloading", "正在下载完整界面资源", 0, web.full.size)
        val archive = downloader.download(web.full, directory)
        ensureActive()
        emit("verifying", "正在校验界面资源")
        store.stage(web.json, archive)
        stagedWeb = web
        ensureActive()
        readyWeb = true
        emit("ready_web", "界面更新已就绪，点击应用后刷新；当前播放不会自动中断")
    }

    @Suppress("DEPRECATION")
    private fun signatures(info: PackageInfo): Set<String> {
        val list = if (Build.VERSION.SDK_INT >= 28) info.signingInfo?.apkContentsSigners else info.signatures
        require(!list.isNullOrEmpty()) { "无法核验应用签名" }
        return list.map { UpdateManifest.sha256(it.toByteArray()) }.toSet()
    }
    @Suppress("DEPRECATION")
    private fun signingFlags() = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
    @Suppress("DEPRECATION")
    private fun installedCertificates() = signatures(activity.packageManager.getPackageInfo(activity.packageName, signingFlags()))
    @Suppress("DEPRECATION")
    private fun installedVersion(): Int = activity.packageManager.getPackageInfo(activity.packageName, 0).let { if (Build.VERSION.SDK_INT >= 28) it.longVersionCode.toInt() else it.versionCode }
    @Suppress("DEPRECATION")
    private fun validateApk(file: File, apk: ApkUpdate) {
        require(file.isFile && file.length() == apk.download.size && UpdateManifest.sha256(file) == apk.download.sha256) { "安装包大小或哈希校验失败" }
        val archive = activity.packageManager.getPackageArchiveInfo(file.absolutePath, signingFlags()) ?: throw IllegalArgumentException("安装包解析失败")
        val version = if (Build.VERSION.SDK_INT >= 28) archive.longVersionCode else archive.versionCode.toLong()
        require(archive.packageName == activity.packageName && version == apk.versionCode.toLong() && version > installedVersion()) { "安装包包名或版本不符合更新清单，拒绝降级" }
        val installed = installedCertificates()
        require(signatures(archive) == installed && installed == setOf(apk.certificateSha256)) { "当前应用与更新包签名不同（可能为调试版），无法保留数据覆盖安装；请勿卸载。" }
    }

    private fun commitInstall(file: File, apk: ApkUpdate) {
        val installer = activity.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(activity.packageName)
            setSize(apk.download.size)
            if (Build.VERSION.SDK_INT >= 31) setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED)
        }
        val id = installer.createSession(params)
        try {
            installer.openSession(id).use { session ->
                session.openWrite("base.apk", 0, apk.download.size).use { output ->
                    file.inputStream().use { input ->
                        val buffer = ByteArray(64 * 1024)
                        while (true) { ensureActive(); val count = input.read(buffer); if (count < 0) break; output.write(buffer, 0, count) }
                    }
                    session.fsync(output)
                }
                ensureActive()
                preferences.edit().putInt("session", id).remove("result").remove("message").commit()
                val callback = Intent(activity, UpdateInstallReceiver::class.java).setAction(INSTALL_ACTION).putExtra("auraSession", id)
                val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
                val sender = PendingIntent.getBroadcast(activity, id, callback, flags).intentSender
                emit("installing", "请在系统安装界面确认更新；无需卸载应用")
                session.commit(sender)
            }
        } catch (error: Exception) {
            runCatching { installer.abandonSession(id) }
            preferences.edit().remove("session").apply()
            throw error
        }
    }

    private fun ensureNoInstaller() {
        consumeInstallationResult()
        check(preferences.getInt("session", -1) < 0) { "安装确认仍在进行，请先完成或取消系统安装" }
    }

    internal fun consumeInstallationResult() {
        if (closed) return
        val result = preferences.getInt("result", Int.MIN_VALUE)
        val pendingSession = preferences.getInt("session", -1)
        if (result == PackageInstaller.STATUS_PENDING_USER_ACTION &&
            (pendingSession < 0 || activity.packageManager.packageInstaller.getSessionInfo(pendingSession) == null)) {
            preferences.edit().remove("result").remove("session").apply()
            emit(if (readyApk != null) "ready_apk" else "error", "上次安装未完成，可重新下载或安装，本地数据已保留")
            return
        }
        when {
            result == PackageInstaller.STATUS_PENDING_USER_ACTION -> emit("installing", "请在系统安装界面确认更新")
            result == PackageInstaller.STATUS_SUCCESS -> {
                preferences.edit().remove("result").remove("session").remove("message").apply()
                emit("current", "更新安装完成")
            }
            result != Int.MIN_VALUE -> {
                val session = preferences.getInt("session", -1)
                if (session >= 0) runCatching { activity.packageManager.packageInstaller.abandonSession(session) }
                preferences.edit().remove("result").remove("session").remove("message").apply()
                emit(if (readyApk != null) "ready_apk" else "error", if (result == PackageInstaller.STATUS_FAILURE_ABORTED) "已取消系统安装，本地数据保留，可重新安装" else "系统未能完成安装，本地数据保留，请重新安装")
            }
            preferences.getInt("session", -1) >= 0 -> {
                val id = preferences.getInt("session", -1)
                if (activity.packageManager.packageInstaller.getSessionInfo(id) == null) {
                    preferences.edit().remove("session").apply()
                    if (readyApk != null) emit("ready_apk", "安装尚未完成，可重新安装")
                }
            }
        }
    }

    private fun runJob(action: () -> Unit) {
        if (closed || !busy.compareAndSet(false, true)) return
        cancelled.set(false)
        try { executor.execute {
            workerThread = Thread.currentThread()
            try { action() }
            catch (_: CancellationException) { emit("cancelled", "已取消，可继续下载或重新检查") }
            catch (error: Exception) {
                if (cancelled.get() || closed) emit("cancelled", "已取消，可继续下载或重新检查")
                else emit("error", error.message?.take(300) ?: "更新失败，请重试")
            } finally {
                if (cancelled.get() && stagedWeb != null) runCatching { discardStagedWeb() }
                workerThread = null
                Thread.interrupted()
                busy.set(false)
                if (resumePending && !closed) {
                    resumePending = false
                    activity.runOnUiThread { onResume() }
                }
            }
        } } catch (_: java.util.concurrent.RejectedExecutionException) { busy.set(false) }
    }
    private fun ensureActive() { if (closed || cancelled.get() || Thread.currentThread().isInterrupted) throw CancellationException("已取消") }

    private fun discardStagedWeb() {
        stagedWeb?.let { store.discardPending(it.versionCode, it.filesHash) }
        stagedWeb = null
        readyWeb = false
    }

    private fun emit(status: String, message: String, downloaded: Long? = null, total: Long? = null) {
        if (closed) return
        val data = JSONObject().put("status", status).put("message", message).put("canRetry", status in listOf("error", "cancelled", "ready_apk", "available"))
        kind?.let { data.put("kind", it) }
        manifest?.let { data.put("version", if (kind == "web") "${it.releaseVersion} · 界面 ${it.web.versionCode}" else it.apk.versionName); data.put("notes", it.notes) }
        downloaded?.let { data.put("downloaded", it) }
        total?.let { data.put("total", it) }
        val serialized = data.toString()
        state = serialized
        activity.runOnUiThread {
            if (!closed && !activity.isFinishing && !activity.isDestroyed) activity.webView.evaluateJavascript("window.onAuraUpdateState && window.onAuraUpdateState($serialized);", null)
        }
    }

    private fun pruneCache() {
        val update = manifest ?: return
        val keep = (listOf(update.apk.download.sha256, update.web.full.sha256) + update.apk.patches.map { it.download.sha256 } + update.web.patches.map { it.download.sha256 }).toSet()
        directory.listFiles()?.filter { it.name.matches(Regex("[a-f0-9]{64}\\.(part|bin)")) && it.name.substringBefore('.') !in keep }?.forEach { it.delete() }
    }

    companion object {
        internal const val INSTALL_PREFS = "aura_update_install"
        internal const val INSTALL_ACTION = "com.jelly.audio.UPDATE_INSTALL_RESULT"
        internal var active = WeakReference<NativeUpdater>(null)
    }
}

private fun java.io.InputStream.readBytesBounded(limit: Int): ByteArray {
    val out = java.io.ByteArrayOutputStream()
    val buffer = ByteArray(8192)
    while (true) { val count = read(buffer); if (count < 0) break; require(out.size() + count <= limit); out.write(buffer, 0, count) }
    return out.toByteArray()
}
