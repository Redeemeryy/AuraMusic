package com.jelly.audio

import android.Manifest
import android.annotation.SuppressLint
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.View
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebResourceError
import android.webkit.MimeTypeMap
import android.app.Activity
import android.net.Uri
import android.webkit.ValueCallback
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.content.res.Configuration
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import android.widget.Toast
import com.jelly.audio.updates.NativeUpdater
import com.jelly.audio.updates.WebContentStore
import com.jelly.audio.updates.StorageMigrationBridge
import java.io.ByteArrayInputStream
import java.io.File
import java.util.UUID
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    companion object {
        var instance: MainActivity? = null
        private const val STABLE_WEB_URL = "https://appassets.androidplatform.net/assets/web/index.html"
        private const val LEGACY_WEB_URL = "file:///android_asset/web/index.html"
    }

    lateinit var webView: WebView
    var musicService: MusicService? = null
    private var isBound = false
    private val mainHandler = Handler(Looper.getMainLooper())
    private var progressRunnable: Runnable? = null
    private var uploadMessage: ValueCallback<Array<Uri>>? = null
    private lateinit var webContentStore: WebContentStore
    private lateinit var updater: NativeUpdater
    private lateinit var storageMigration: StorageMigrationBridge
    @Volatile private var currentLocalDocument: String? = null
    @Volatile private var webLaunchToken = ""
    private var recoveredWebLaunch = false
    private var webLaunchHealthy = false
    private val webHealthTimeout = Runnable {
        if (!webLaunchHealthy && currentLocalDocument == STABLE_WEB_URL) recoverWebLaunch()
    }

    private val pluginFilePickerLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val uri = result.data?.data
            if (uri != null) {
                readAndLoadPluginUri(uri)
            }
        }
    }

    private val fileChooserLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val data = result.data
            val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, data)
            uploadMessage?.onReceiveValue(uris)
        } else {
            uploadMessage?.onReceiveValue(null)
        }
        uploadMessage = null
    }

    var currentTopInsetDp: Int = 38
    var currentBottomInsetDp: Int = 24
    var currentLeftInsetDp: Int = 0
    var currentRightInsetDp: Int = 0

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(className: ComponentName, service: IBinder) {
            val binder = service as MusicService.LocalBinder
            musicService = binder.getService()
            isBound = true

            musicService?.onStateChangedListener = { isPlaying ->
                mainHandler.post {
                    evaluateJavascript("window.onNativePlaybackStateChanged && window.onNativePlaybackStateChanged($isPlaying);")
                }
            }

            musicService?.onTrackCompletedListener = {
                mainHandler.post {
                    evaluateJavascript("window.onNativeTrackCompleted && window.onNativeTrackCompleted();")
                }
            }

            mainHandler.post {
                evaluateJavascript("window.syncBluetoothLyricsPreference && window.syncBluetoothLyricsPreference();")
                evaluateJavascript("window.syncPlaybackFromNative && window.syncPlaybackFromNative();")
                if (pendingOpenFullPlayer && !isMigratingLegacyPage()) {
                    pendingOpenFullPlayer = false
                    evaluateJavascript("window.openFullPlayer && window.openFullPlayer();")
                }
            }
        }

        override fun onServiceDisconnected(arg0: ComponentName) {
            isBound = false
            musicService = null
        }
    }

    private var pendingOpenFullPlayer = false

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val shouldOpen = checkOpenPlayerIntent(intent)
        mainHandler.post {
            evaluateJavascript("window.syncPlaybackFromNative && window.syncPlaybackFromNative();")
            if (shouldOpen && !isMigratingLegacyPage()) {
                evaluateJavascript("window.openFullPlayer && window.openFullPlayer();")
            }
        }
    }

    private fun checkOpenPlayerIntent(intent: Intent?): Boolean {
        if (intent == null) return false
        val open = intent.getBooleanExtra("OPEN_FULL_PLAYER", false) ||
                   intent.action == "com.jelly.audio.ACTION_OPEN_PLAYER"
        if (open) {
            pendingOpenFullPlayer = true
        }
        return open
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (::webView.isInitialized) {
            webView.saveState(outState)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        instance = this
        checkOpenPlayerIntent(intent)

        // 1. Edge-to-Edge & Cutout Mode for modern tall screens (Vivo X200 Pro mini / Xiaomi 13 Ultra)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

        val insetsController = WindowCompat.getInsetsController(window, window.decorView)
        insetsController.isAppearanceLightStatusBars = true
        insetsController.isAppearanceLightNavigationBars = true

        WebView.setWebContentsDebuggingEnabled(
            (applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0
        )

        requestNotificationPermission()

        webContentStore = WebContentStore(this)
        updater = NativeUpdater(this, webContentStore)
        storageMigration = StorageMigrationBridge(
            File(filesDir, "storage-migration"),
            { currentLocalDocument == LEGACY_WEB_URL },
            { currentLocalDocument == STABLE_WEB_URL },
            { webLaunchToken },
            { mainHandler.post { launchStableWebContent() } },
            { mainHandler.post {
                mainHandler.removeCallbacks(webHealthTimeout)
                Toast.makeText(this, "本地数据迁移未完成，已恢复原界面，备份已保留", Toast.LENGTH_LONG).show()
                loadTrustedPage(LEGACY_WEB_URL)
            } },
            { token -> mainHandler.post {
                if (token == webLaunchToken && currentLocalDocument == STABLE_WEB_URL) {
                    runCatching { webContentStore.markHealthy() }.onSuccess {
                        webLaunchHealthy = true
                        mainHandler.removeCallbacks(webHealthTimeout)
                    }.onFailure { recoverWebLaunch() }
                }
            } }
        )
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/web/") { path ->
                val stream = webContentStore.open(path)
                val mime = when (path.substringAfterLast('.', "").lowercase()) {
                    "js" -> "application/javascript"
                    "css" -> "text/css"
                    "html" -> "text/html"
                    else -> MimeTypeMap.getSingleton().getMimeTypeFromExtension(path.substringAfterLast('.')) ?: "application/octet-stream"
                }
                WebResourceResponse(mime, "UTF-8", if (stream == null) 404 else 200,
                    if (stream == null) "Not Found" else "OK",
                    mapOf("Cache-Control" to "no-store", "X-Content-Type-Options" to "nosniff",
                        "Content-Security-Policy" to "script-src 'self' 'unsafe-inline' 'unsafe-eval'; frame-src 'none'; object-src 'none'; base-uri 'self'"),
                    stream ?: ByteArrayInputStream(ByteArray(0)))
            }.build()

        webView = WebView(this).apply {
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = true
                allowContentAccess = true
                allowFileAccessFromFileURLs = false
                allowUniversalAccessFromFileURLs = false
                databaseEnabled = true
                mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
                cacheMode = WebSettings.LOAD_NO_CACHE
                useWideViewPort = true
                loadWithOverviewMode = true
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    offscreenPreRaster = true
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    uploadMessage?.onReceiveValue(null)
                    uploadMessage = filePathCallback
                    val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                        type = "*/*"
                        addCategory(Intent.CATEGORY_OPENABLE)
                    }
                    try {
                        fileChooserLauncher.launch(intent)
                    } catch (e: Exception) {
                        uploadMessage = null
                        return false
                    }
                    return true
                }
            }
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val uri = request?.url ?: return true
                    val destination = uri.toString().substringBefore('#')
                    if (request.isForMainFrame && destination == currentLocalDocument && isTrustedPage(destination)) return false
                    if (request.isForMainFrame && uri.scheme in listOf("https", "http")) {
                        runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                    }
                    return true
                }
                override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                    val uri = request?.url ?: return null
                    if (uri.host == "appassets.androidplatform.net") {
                        return assetLoader.shouldInterceptRequest(uri)
                            ?: WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)))
                    }
                    return null
                }
                override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                    if (!isTrustedPage(url)) {
                        currentLocalDocument = null
                        view?.stopLoading()
                        view?.removeJavascriptInterface("AndroidBridge")
                        view?.removeJavascriptInterface("AuraUpdater")
                        view?.removeJavascriptInterface("AuraStorage")
                        return
                    }
                    currentLocalDocument = url?.substringBefore('#')
                    super.onPageStarted(view, url, favicon)
                }
                override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                    super.onReceivedError(view, request, error)
                    if (request?.isForMainFrame == true && currentLocalDocument == STABLE_WEB_URL) recoverWebLaunch()
                }
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    if (!isTrustedPage(url) || isMigratingLegacyPage()) return
                    // The file origin is migration-only and must never remain on the Back stack.
                    if (currentLocalDocument == STABLE_WEB_URL) webView.clearHistory()
                    evaluateJavascript("window.syncBluetoothLyricsPreference && window.syncBluetoothLyricsPreference();")
                    evaluateJavascript("window.syncPlaybackFromNative && window.syncPlaybackFromNative();")
                    if (pendingOpenFullPlayer) {
                        pendingOpenFullPlayer = false
                        mainHandler.postDelayed({
                            evaluateJavascript("window.openFullPlayer && window.openFullPlayer();")
                        }, 250)
                    }
                }
            }

            addJavascriptInterface(WebAppInterface(this@MainActivity), "AndroidBridge")
            addJavascriptInterface(updater, "AuraUpdater")
            addJavascriptInterface(storageMigration, "AuraStorage")
        }

        // Listen for system insets (status bar, navigation bar, cutout)
        ViewCompat.setOnApplyWindowInsetsListener(webView) { _, windowInsets ->
            val insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            val density = resources.displayMetrics.density
            val keyboardVisible = windowInsets.isVisible(WindowInsetsCompat.Type.ime())
            mainHandler.post {
                evaluateJavascript("window.onNativeKeyboardChanged && window.onNativeKeyboardChanged($keyboardVisible);")
            }
            if (density > 0) {
                currentTopInsetDp = (insets.top / density).toInt()
                currentBottomInsetDp = (insets.bottom / density).toInt()
                currentLeftInsetDp = (insets.left / density).toInt()
                currentRightInsetDp = (insets.right / density).toInt()

                mainHandler.post {
                    evaluateJavascript(
                        "window.applyNativeInsets && window.applyNativeInsets($currentTopInsetDp, $currentBottomInsetDp, $currentLeftInsetDp, $currentRightInsetDp);"
                    )
                }
            }
            windowInsets
        }

        setContentView(webView)

        // Bind music service
        val intent = Intent(this, MusicService::class.java)
        try {
            startService(intent)
        } catch (e: Exception) {
            // Handled gracefully for background launch on Android 8.0+
        }
        bindService(intent, connection, Context.BIND_AUTO_CREATE)

        // Start progress polling loop
        startProgressPolling()

        // Handle Back Press in Web UI
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript("window.handleBackPress ? window.handleBackPress() : false;") { result ->
                    if (result != "true") {
                        // App navigation is handled above. Returning through WebView history could
                        // revisit the pre-migration file origin and fork the user's local storage.
                        finish()
                    }
                }
            }
        })

        // Recreate the document at the fixed origin; app UI/playback state lives in persistent storage.
        if (storageMigration.isComplete()) launchStableWebContent() else loadTrustedPage(LEGACY_WEB_URL)
    }

    private fun isTrustedPage(url: String?): Boolean {
        val document = url?.substringBefore('#') ?: return false
        return document == STABLE_WEB_URL || document == LEGACY_WEB_URL
    }

    private fun isMigratingLegacyPage(): Boolean = currentLocalDocument == LEGACY_WEB_URL &&
        ::storageMigration.isInitialized && !storageMigration.legacyFallback

    private fun loadTrustedPage(url: String) {
        require(isTrustedPage(url))
        webLaunchToken = UUID.randomUUID().toString()
        currentLocalDocument = url
        webView.loadUrl(url)
    }

    private fun launchStableWebContent() {
        try {
            webContentStore.prepareLaunch()
            webLaunchHealthy = false
            mainHandler.removeCallbacks(webHealthTimeout)
            mainHandler.postDelayed(webHealthTimeout, 30000)
            loadTrustedPage(STABLE_WEB_URL)
        } catch (_: Exception) {
            mainHandler.removeCallbacks(webHealthTimeout)
            if (storageMigration.isComplete()) {
                // Once migrated, all recoveries keep the same origin and user data, even if disk is full.
                webContentStore.useBundledForSession()
                loadTrustedPage(STABLE_WEB_URL)
            } else {
                storageMigration.useLegacyFallback()
                loadTrustedPage(LEGACY_WEB_URL)
            }
            Toast.makeText(this, "网页更新暂不可用，已恢复内置界面", Toast.LENGTH_LONG).show()
        }
    }

    private fun recoverWebLaunch() {
        mainHandler.removeCallbacks(webHealthTimeout)
        if (!storageMigration.isComplete()) {
            storageMigration.useLegacyFallback()
            loadTrustedPage(LEGACY_WEB_URL)
        } else if (!recoveredWebLaunch) {
            recoveredWebLaunch = true
            Toast.makeText(this, "新版界面未完成启动，正在恢复上个版本", Toast.LENGTH_LONG).show()
            launchStableWebContent()
        }
    }

    fun reloadUpdatedWebContent() {
        runOnUiThread {
            recoveredWebLaunch = false
            if (storageMigration.isComplete()) launchStableWebContent()
            else {
                Toast.makeText(this, "本地数据迁移尚未完成，请下次启动时重试", Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        // Request insets refresh and notify web frontend of landscape / portrait mode switch
        webView.post {
            ViewCompat.requestApplyInsets(webView)
            val isLandscape = newConfig.orientation == Configuration.ORIENTATION_LANDSCAPE
            evaluateJavascript("window.onOrientationChanged && window.onOrientationChanged($isLandscape);")
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    101
                )
            }
        }
    }

    private fun startProgressPolling() {
        stopProgressPolling()
        progressRunnable = object : Runnable {
            override fun run() {
                musicService?.let { service ->
                    if (service.isPlaying) {
                        val pos = service.currentPosition
                        val dur = service.currentDuration
                        evaluateJavascript("window.onNativePlaybackProgress && window.onNativePlaybackProgress($pos, $dur);")
                    }
                }
                mainHandler.postDelayed(this, 500)
            }
        }
        mainHandler.post(progressRunnable!!)
    }

    private fun stopProgressPolling() {
        progressRunnable?.let {
            mainHandler.removeCallbacks(it)
            progressRunnable = null
        }
    }

    fun postMediaEvent(event: String) {
        mainHandler.post {
            evaluateJavascript("window.dispatchMediaEvent && window.dispatchMediaEvent('$event');")
        }
    }

    fun openPluginFilePicker() {
        val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
            type = "*/*"
            addCategory(Intent.CATEGORY_OPENABLE)
        }
        try {
            pluginFilePickerLauncher.launch(Intent.createChooser(intent, "选择音源插件文件 (.js)"))
        } catch (e: Exception) {
            Toast.makeText(this, "打开文件选择器失败: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    fun readAndLoadPluginUri(uri: Uri) {
        try {
            var fileName = "plugin.js"
            contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                val nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                if (nameIndex != -1 && cursor.moveToFirst()) {
                    fileName = cursor.getString(nameIndex) ?: "plugin.js"
                }
            }

            val inputStream = contentResolver.openInputStream(uri)
            val code = inputStream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
            if (code.isBlank()) {
                Toast.makeText(this, "文件内容为空", Toast.LENGTH_SHORT).show()
                return
            }

            mainHandler.post {
                val escapedCode = JSONObject.quote(code)
                val escapedName = JSONObject.quote(fileName)
                webView.evaluateJavascript("window.onPluginFileLoaded && window.onPluginFileLoaded($escapedCode, $escapedName);", null)
            }
        } catch (e: Exception) {
            Toast.makeText(this, "读取插件文件失败: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    fun tryAutoScanLocalPlugins(): String? {
        val candidateDirs = listOf(
            java.io.File("/sdcard/Download/vivo办公套件"),
            java.io.File("/sdcard/Download"),
            java.io.File("/storage/emulated/0/Download/vivo办公套件"),
            java.io.File("/storage/emulated/0/Download")
        )
        for (dir in candidateDirs) {
            if (dir.exists() && dir.isDirectory) {
                val files = dir.listFiles { file ->
                    file.isFile && file.name.endsWith(".js", ignoreCase = true) &&
                    (file.name.contains("cr2", ignoreCase = true) || file.name.contains("music-source", ignoreCase = true) || file.name.contains("lx", ignoreCase = true))
                }
                if (!files.isNullOrEmpty()) {
                    val newest = files.maxByOrNull { it.lastModified() }
                    if (newest != null && newest.canRead()) {
                        try {
                            val code = newest.readText(Charsets.UTF_8)
                            if (code.isNotBlank()) {
                                return JSONObject().apply {
                                    put("name", newest.name)
                                    put("path", newest.absolutePath)
                                    put("code", code)
                                }.toString()
                            }
                        } catch (ignored: Exception) {}
                    }
                }
            }
        }
        return null
    }

    fun sendHttpResponseToWeb(requestId: String, status: Int, headersJson: String, body: String?, error: String?) {
        mainHandler.post {
            try {
                val payload = JSONObject()
                payload.put("requestId", requestId)
                payload.put("status", status)
                payload.put("headers", JSONObject(headersJson))
                payload.put("error", error)

                if (body != null && body.length > 48 * 1024) {
                    WebAppInterface.largeBodyCache[requestId] = body
                    payload.put("isLargeBody", true)
                    payload.put("body", null)
                } else {
                    payload.put("isLargeBody", false)
                    payload.put("body", body)
                }

                val bytes = payload.toString().toByteArray(Charsets.UTF_8)
                val b64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
                evaluateJavascript("window.onNativeHttpResponseBase64 && window.onNativeHttpResponseBase64('$b64');")
            } catch (e: Exception) {
                e.printStackTrace()
                evaluateJavascript("window.onNativeHttpResponse && window.onNativeHttpResponse('{\"requestId\":\"$requestId\",\"status\":0,\"error\":\"${e.message}\"}');")
            }
        }
    }

    fun evaluateJavascript(script: String) {
        if (::webView.isInitialized) {
            webView.evaluateJavascript(script, null)
        }
    }

    override fun onStart() {
        super.onStart()
        if (::webView.isInitialized) {
            webView.onResume()
        }
        startProgressPolling()
    }

    override fun onResume() {
        super.onResume()
        if (::updater.isInitialized) updater.onResume()
        musicService?.let { service ->
            val playing = service.isPlaying
            val pos = service.currentPosition
            val dur = service.currentDuration
            evaluateJavascript("window.onNativePlaybackStateChanged && window.onNativePlaybackStateChanged($playing);")
            evaluateJavascript("window.onNativePlaybackProgress && window.onNativePlaybackProgress($pos, $dur);")
        }
    }

    override fun onPause() {
        stopProgressPolling()
        super.onPause()
    }

    override fun onStop() {
        stopProgressPolling()
        if (::webView.isInitialized) {
            webView.onPause()
        }
        super.onStop()
    }

    override fun onDestroy() {
        stopProgressPolling()
        mainHandler.removeCallbacks(webHealthTimeout)
        if (::updater.isInitialized) updater.close()
        if (isBound) {
            unbindService(connection)
            isBound = false
        }
        if (instance == this) instance = null
        super.onDestroy()
    }
}
