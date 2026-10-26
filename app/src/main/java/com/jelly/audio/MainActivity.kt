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
import android.widget.Toast
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    companion object {
        var instance: MainActivity? = null
    }

    lateinit var webView: WebView
    var musicService: MusicService? = null
    private var isBound = false
    private val mainHandler = Handler(Looper.getMainLooper())
    private var progressRunnable: Runnable? = null
    private var uploadMessage: ValueCallback<Array<Uri>>? = null

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
                if (pendingOpenFullPlayer) {
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
            if (shouldOpen) {
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

        webView = WebView(this).apply {
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = true
                allowContentAccess = true
                databaseEnabled = true
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                cacheMode = WebSettings.LOAD_DEFAULT
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
                    return false
                }
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
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
                        if (webView.canGoBack()) {
                            webView.goBack()
                        } else {
                            finish()
                        }
                    }
                }
            }
        })

        // Load frontend or restore saved state
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            webView.loadUrl("file:///android_asset/web/index.html")
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
        if (isBound) {
            unbindService(connection)
            isBound = false
        }
        if (instance == this) instance = null
        super.onDestroy()
    }
}
