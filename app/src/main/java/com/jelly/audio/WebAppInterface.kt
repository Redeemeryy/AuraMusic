package com.jelly.audio

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.widget.Toast
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class WebAppInterface(private val activity: MainActivity) {

    companion object {
        val largeBodyCache = java.util.concurrent.ConcurrentHashMap<String, String>()
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    @JavascriptInterface
    fun playMusic(url: String, trackJson: String) {
        mainHandler.post {
            activity.musicService?.play(url, trackJson)
        }
    }

    @JavascriptInterface
    fun pauseMusic() {
        mainHandler.post {
            activity.musicService?.pause()
        }
    }

    @JavascriptInterface
    fun resumeMusic() {
        mainHandler.post {
            activity.musicService?.resume()
        }
    }

    @JavascriptInterface
    fun seekTo(positionMs: Int) {
        mainHandler.post {
            activity.musicService?.seekTo(positionMs)
        }
    }

    @JavascriptInterface
    fun updateCurrentLyric(lyric: String) {
        mainHandler.post {
            activity.musicService?.updateCurrentLyric(lyric)
        }
    }

    @JavascriptInterface
    fun getSystemInsets(): String {
        return try {
            val json = JSONObject()
            json.put("top", activity.currentTopInsetDp)
            json.put("bottom", activity.currentBottomInsetDp)
            json.put("left", activity.currentLeftInsetDp)
            json.put("right", activity.currentRightInsetDp)
            json.toString()
        } catch (e: Exception) {
            "{\"top\":38,\"bottom\":24,\"left\":0,\"right\":0}"
        }
    }

    @JavascriptInterface
    fun getPlaybackState(): String {
        return try {
            val s = activity.musicService
            val json = JSONObject()
            json.put("isPlaying", s?.isPlaying ?: false)
            json.put("currentPosition", s?.currentPosition ?: 0)
            json.put("duration", s?.currentDuration ?: 0)
            json.put("track", if (s?.currentTrackJson != null) JSONObject(s.currentTrackJson!!) else null)
            json.toString()
        } catch (e: Exception) {
            JSONObject().apply {
                put("isPlaying", false)
                put("currentPosition", 0)
                put("duration", 0)
                put("track", null)
            }.toString()
        }
    }

    @JavascriptInterface
    fun toast(message: String) {
        mainHandler.post {
            Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun copyToClipboard(text: String) {
        mainHandler.post {
            val clipboard = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText("Copied Text", text)
            clipboard.setPrimaryClip(clip)
            Toast.makeText(activity, "已复制到剪贴板", Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun httpRequest(requestId: String, url: String, method: String, headersJson: String, body: String?) {
        val reqBuilder = Request.Builder().url(url)
        var contentTypeStr = "application/json; charset=utf-8"

        try {
            val headersObj = JSONObject(headersJson)
            val keys = headersObj.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                val value = headersObj.getString(key)
                if (key.equals("content-type", ignoreCase = true)) {
                    contentTypeStr = value
                }
                reqBuilder.header(key, value)
            }
        } catch (e: Exception) {}

        val httpMethod = method.uppercase()
        val requestBody = if (httpMethod in listOf("POST", "PUT", "PATCH")) {
            val contentType = contentTypeStr.toMediaTypeOrNull()
            (body ?: "").toRequestBody(contentType)
        } else null

        reqBuilder.method(httpMethod, requestBody)

        httpClient.newCall(reqBuilder.build()).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                activity.sendHttpResponseToWeb(requestId, 0, "{}", null, e.message ?: "网络请求失败")
            }

            override fun onResponse(call: Call, response: Response) {
                val statusCode = response.code
                val responseBody = response.body?.string() ?: ""
                val respHeaders = JSONObject()
                for ((name, value) in response.headers) {
                    respHeaders.put(name, value)
                }
                respHeaders.put("x-final-url", response.request.url.toString())
                activity.sendHttpResponseToWeb(requestId, statusCode, respHeaders.toString(), responseBody, null)
            }
        })
    }

    @JavascriptInterface
    fun getHttpResponseBody(requestId: String): String {
        return largeBodyCache.remove(requestId) ?: ""
    }

    @JavascriptInterface
    fun getClipboardText(): String {
        val future = java.util.concurrent.CompletableFuture<String>()
        mainHandler.post {
            try {
                val clipboard = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                val clip = clipboard.primaryClip
                if (clip != null && clip.itemCount > 0) {
                    val text = clip.getItemAt(0).coerceToText(activity)?.toString() ?: ""
                    future.complete(text)
                } else {
                    future.complete("")
                }
            } catch (e: Exception) {
                future.complete("")
            }
        }
        return try {
            future.get(1, TimeUnit.SECONDS)
        } catch (e: Exception) {
            ""
        }
    }

    @JavascriptInterface
    fun updateFavoriteState(isFav: Boolean) {
        mainHandler.post {
            activity.musicService?.updateFavoriteState(isFav)
        }
    }

    @JavascriptInterface
    fun pickPluginFile() {
        mainHandler.post {
            activity.openPluginFilePicker()
        }
    }

    @JavascriptInterface
    fun getAppVersion(): String {
        return try {
            val pInfo = activity.packageManager.getPackageInfo(activity.packageName, 0)
            val json = JSONObject()
            json.put("versionName", pInfo.versionName ?: "1.1.4")
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                json.put("versionCode", pInfo.longVersionCode)
            } else {
                json.put("versionCode", pInfo.versionCode.toLong())
            }
            json.toString()
        } catch (e: Exception) {
            "{\"versionName\":\"1.1.4\",\"versionCode\":6}"
        }
    }

    @JavascriptInterface
    fun downloadAndInstallApk(apkUrl: String, fileName: String) {
        mainHandler.post {
            try {
                val uri = android.net.Uri.parse(apkUrl)
                val request = android.app.DownloadManager.Request(uri).apply {
                    setTitle("正在下载 AuraMusic 新版本")
                    setDescription(fileName)
                    setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_DOWNLOADS, fileName)
                    setMimeType("application/vnd.android.package-archive")
                }
                val manager = activity.getSystemService(Context.DOWNLOAD_SERVICE) as android.app.DownloadManager
                manager.enqueue(request)
                Toast.makeText(activity, "已开始在后台下载更新包，下载完成后点击通知即可安装", Toast.LENGTH_LONG).show()
            } catch (e: Exception) {
                // Fallback to external browser
                openExternalUrl(apkUrl)
            }
        }
    }

    @JavascriptInterface
    fun scanDownloadedPlugin(): String? {
        return activity.tryAutoScanLocalPlugins()
    }

    @JavascriptInterface
    fun openExternalUrl(url: String) {
        mainHandler.post {
            try {
                val intent = Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url)).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                activity.startActivity(intent)
            } catch (e: Exception) {
                Toast.makeText(activity, "无法打开链接: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }
}

