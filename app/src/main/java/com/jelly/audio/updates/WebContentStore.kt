package com.jelly.audio.updates

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.io.InputStream

class WebContentStore(context: Context) {
    private val app = context.applicationContext
    @Suppress("DEPRECATION")
    private val nativeVersion = app.packageManager.getPackageInfo(app.packageName, 0).versionCode
    private val files = WebContentFiles(
        File(app.filesDir, "web-updates"),
        app.assets.open("update-base.json").bufferedReader(Charsets.UTF_8).use { JSONObject(it.readText()) },
        nativeVersion
    ) { path -> runCatching { app.assets.open("web/$path") }.getOrNull() }

    fun currentVersion(): Int = files.currentVersion()
    fun currentFilesHash(): String = files.currentFilesHash()
    fun stage(web: JSONObject, archive: File) = files.stage(web, archive)
    fun prepareLaunch() = files.prepareLaunch()
    fun markHealthy() = files.markHealthy()
    fun open(path: String): InputStream? = files.open(path)
    fun discardPending(versionCode: Int, filesHash: String) = files.discardPending(versionCode, filesHash)
    fun useBundledForSession() = files.useBundledForSession()
}
