package com.jelly.audio

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Binder
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.os.ResultReceiver
import android.support.v4.media.MediaBrowserCompat
import android.support.v4.media.MediaDescriptionCompat
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.RatingCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.media.MediaBrowserServiceCompat
import androidx.media.app.NotificationCompat.MediaStyle
import androidx.media.session.MediaButtonReceiver
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import android.os.PowerManager
import android.net.wifi.WifiManager
import androidx.media3.exoplayer.DefaultLoadControl
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import org.json.JSONObject
import java.net.URL
import java.util.concurrent.TimeUnit

class MusicService : MediaBrowserServiceCompat() {

    private val binder = LocalBinder()
    private var player: ExoPlayer? = null
    private var mediaSession: MediaSessionCompat? = null
    private val scope = CoroutineScope(Dispatchers.Main)
    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private var isForegroundServiceStarted = false

    private fun acquireLocks() {
        try {
            if (wakeLock == null) {
                val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "JellyAudio:PlaybackWakeLock")
                wakeLock?.setReferenceCounted(false)
            }
            if (wakeLock?.isHeld != true) {
                // Acquire with a 2-hour safety timeout instead of locking CPU indefinitely
                wakeLock?.acquire(2 * 3600 * 1000L)
            }
            if (wifiLock == null) {
                val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
                // Use standard WIFI_MODE_FULL instead of deprecated high-perf mode to prevent Wi-Fi modem thermal heating
                wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL, "JellyAudio:WifiLock")
                wifiLock?.setReferenceCounted(false)
            }
            if (wifiLock?.isHeld != true) {
                wifiLock?.acquire()
            }
        } catch (e: Exception) {
            android.util.Log.w("JellyAudio", "Failed to acquire wake/wifi locks: ${e.message}")
        }
    }

    private fun releaseLocks() {
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
            if (wifiLock?.isHeld == true) {
                wifiLock?.release()
            }
        } catch (e: Exception) {
            android.util.Log.w("JellyAudio", "Failed to release wake/wifi locks: ${e.message}")
        }
    }

    @Volatile var cachedDuration: Int = 0
    @Volatile var cachedPosition: Int = 0

    var currentTrackJson: String? = null
    var isPlaying: Boolean = false
        private set
    var isCurrentFav: Boolean = false
        private set
    var currentTrackId: String = ""
        private set

    val currentDuration: Int
        get() = cachedDuration

    val currentPosition: Int
        get() {
            return if (Looper.myLooper() == Looper.getMainLooper()) {
                val pos = player?.currentPosition?.toInt() ?: cachedPosition
                cachedPosition = pos
                pos
            } else {
                cachedPosition
            }
        }

    var onStateChangedListener: ((Boolean) -> Unit)? = null
    var onTrackCompletedListener: (() -> Unit)? = null
    private var isSuperxCreated: Boolean = false

    companion object {
        const val CHANNEL_ID = "aura_audio_playback_v3"
        const val NOTIFICATION_ID = 1001

        const val ACTION_PLAY = "com.auramusic.app.ACTION_PLAY"
        const val ACTION_PAUSE = "com.auramusic.app.ACTION_PAUSE"
        const val ACTION_PREV = "com.auramusic.app.ACTION_PREV"
        const val ACTION_NEXT = "com.auramusic.app.ACTION_NEXT"
        const val ACTION_FAV = "com.auramusic.app.ACTION_FAV"
        const val ACTION_LYRIC = "com.auramusic.app.ACTION_LYRIC"
        const val ACTION_STOP = "com.auramusic.app.ACTION_STOP"
    }

    inner class LocalBinder : Binder() {
        fun getService(): MusicService = this@MusicService
    }

    override fun onBind(intent: Intent?): IBinder? {
        val action = intent?.action
        return if (MediaBrowserServiceCompat.SERVICE_INTERFACE == action ||
            "com.vivo.musicwidgetmix.support.service" == action) {
            super.onBind(intent)
        } else {
            binder
        }
    }

    override fun onGetRoot(clientPackageName: String, clientUid: Int, rootHints: Bundle?): BrowserRoot {
        val extras = Bundle().apply {
            putBoolean("android.service.media.extra.RECENT", true)
            putBoolean("android.service.media.extra.OFFLINE", true)
            putBoolean("vivomusicmix.media.metadata.SUPPORT_FAVORITE", true)
            putBoolean("support_atomic_notification", true)
            putBoolean("supportAtomIsland", true)
            putBoolean("SUPPORT_ISLAND", true)
            putBoolean("vivo_superx_notification", true)
            putBoolean("vivo.liveNotification.support", true)
        }
        return BrowserRoot("root_media_id", extras)
    }

    override fun onLoadChildren(parentId: String, result: Result<MutableList<MediaBrowserCompat.MediaItem>>) {
        val items = mutableListOf<MediaBrowserCompat.MediaItem>()
        if (currentTrackJson != null) {
            try {
                val json = JSONObject(currentTrackJson!!)
                val title = json.optString("title", currentSongTitle)
                val artist = json.optString("artist", currentArtistName)
                val desc = MediaDescriptionCompat.Builder()
                    .setMediaId("current_playing_track")
                    .setTitle(title)
                    .setSubtitle(artist)
                    .setDescription("果冻音乐")
                    .build()
                items.add(MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE))
            } catch (ignored: Exception) {}
        }
        result.sendResult(items)
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        initMediaSession()
        mediaSession?.sessionToken?.let { token ->
            sessionToken = token
        }
        updateMediaSessionState(PlaybackStateCompat.STATE_NONE, 0)
        initExoPlayer()
    }

    private fun initExoPlayer() {
        val okHttpClient = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .followRedirects(true)
            .build()

        val dataSourceFactory = OkHttpDataSource.Factory(okHttpClient)
            .setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

        val mediaSourceFactory = DefaultMediaSourceFactory(dataSourceFactory)
            .setLoadErrorHandlingPolicy(androidx.media3.exoplayer.upstream.DefaultLoadErrorHandlingPolicy(3))

        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                /* minBufferMs = */ 30_000,
                /* maxBufferMs = */ 120_000,
                /* bufferForPlaybackMs = */ 1_500,
                /* bufferForPlaybackAfterRebufferMs = */ 3_000
            )
            .setPrioritizeTimeOverSizeThresholds(true)
            .setBackBuffer(15_000, true)
            .build()

        val audioAttributes = AudioAttributes.Builder()
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .setUsage(C.USAGE_MEDIA)
            .build()

        player = ExoPlayer.Builder(this)
            .setMediaSourceFactory(mediaSourceFactory)
            .setLoadControl(loadControl)
            .setAudioAttributes(audioAttributes, true)
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .setHandleAudioBecomingNoisy(true)
            .build().apply {
                addListener(object : Player.Listener {
                    override fun onIsPlayingChanged(playing: Boolean) {
                        if (this@MusicService.isPlaying != playing) {
                            this@MusicService.isPlaying = playing
                            if (playing) {
                                acquireLocks()
                            } else {
                                releaseLocks()
                            }
                            val pos = currentPosition.toLong()
                            cachedPosition = pos.toInt()
                            updateMediaSessionState(
                                if (playing) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED,
                                pos
                            )
                            postNotification(currentSongTitle, currentArtistName, currentCoverBitmap, playing)
                            onStateChangedListener?.invoke(playing)
                        }
                    }

                    override fun onPlaybackStateChanged(playbackState: Int) {
                        when (playbackState) {
                            Player.STATE_BUFFERING -> {
                                android.util.Log.d("JellyAudio", "ExoPlayer buffering...")
                            }
                            Player.STATE_READY -> {
                                val dur = duration.toInt()
                                cachedDuration = dur
                            }
                            Player.STATE_ENDED -> {
                                this@MusicService.isPlaying = false
                                releaseLocks()
                                updateMediaSessionState(PlaybackStateCompat.STATE_PAUSED, currentDuration.toLong())
                                onStateChangedListener?.invoke(false)
                                onTrackCompletedListener?.invoke()
                            }
                            else -> {}
                        }
                    }

                    override fun onPlayerError(error: PlaybackException) {
                        android.util.Log.e("JellyAudio", "ExoPlayer playback error: ${error.errorCodeName}", error)
                        this@MusicService.isPlaying = false
                        releaseLocks()
                        onStateChangedListener?.invoke(false)
                    }
                })
            }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "音乐播放与原子岛胶囊",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "正在播放音乐与vivo原子岛实时状态控制"
                setShowBadge(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                setSound(null, null)
                enableVibration(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun initMediaSession() {
        val sessionIntent = PendingIntent.getActivity(
            this, 1001,
            Intent(this, MainActivity::class.java).apply {
                action = "com.jelly.audio.ACTION_OPEN_PLAYER"
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("OPEN_FULL_PLAYER", true)
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val mbrComponent = ComponentName(this, MediaButtonReceiver::class.java)
        val mbrIntent = PendingIntent.getBroadcast(
            this, 0,
            Intent(Intent.ACTION_MEDIA_BUTTON, null, this, MediaButtonReceiver::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )

        mediaSession = MediaSessionCompat(this, "JellyAudioSession", mbrComponent, mbrIntent).apply {
            setRatingType(RatingCompat.RATING_HEART)
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() { resume() }
                override fun onPause() { pause() }
                override fun onSkipToNext() { MainActivity.instance?.postMediaEvent("next") }
                override fun onSkipToPrevious() { MainActivity.instance?.postMediaEvent("prev") }
                override fun onSeekTo(pos: Long) { seekTo(pos.toInt()) }
                override fun onStop() { stopPlayback() }
                override fun onSetRating(rating: RatingCompat?) {
                    android.util.Log.d("JellyAudio", "onSetRating: $rating (hasHeart=${rating?.hasHeart()})")
                    handleFavoriteChange(rating?.hasHeart())
                }
                override fun onSetRating(rating: RatingCompat?, extras: Bundle?) {
                    android.util.Log.d("JellyAudio", "onSetRating with extras: $rating, extras=$extras")
                    handleFavoriteChange(rating?.hasHeart())
                }
                override fun onCustomAction(action: String?, extras: Bundle?) {
                    android.util.Log.d("JellyAudio", "onCustomAction: $action, extras=$extras")
                    when (action) {
                        ACTION_FAV, "favorite", "like", "fav", "vivomusicmix.media.action.FAVORITE", "action_favorite", "com.vivo.action.FAVORITE", "vivo.intent.action.FAVORITE", "ACTION_FAV", "com.vivo.media.FAVORITE" -> {
                            val req = extras?.let {
                                if (it.containsKey("isFavorite")) it.getBoolean("isFavorite")
                                else if (it.containsKey("favorite")) it.getBoolean("favorite")
                                else null
                            }
                            handleFavoriteChange(req)
                        }
                        ACTION_LYRIC, "lyric" -> MainActivity.instance?.postMediaEvent("lyric")
                    }
                }
                override fun onCommand(command: String?, args: Bundle?, cb: ResultReceiver?) {
                    android.util.Log.d("JellyAudio", "onCommand: $command, args=$args")
                    when (command) {
                        ACTION_FAV, "favorite", "like", "fav", "vivomusicmix.media.action.FAVORITE", "action_favorite", "com.vivo.action.FAVORITE", "vivo.intent.action.FAVORITE", "ACTION_FAV", "com.vivo.media.FAVORITE" -> {
                            val req = args?.let {
                                if (it.containsKey("isFavorite")) it.getBoolean("isFavorite")
                                else if (it.containsKey("favorite")) it.getBoolean("favorite")
                                else null
                            }
                            handleFavoriteChange(req)
                        }
                    }
                }
                override fun onMediaButtonEvent(mediaButtonEvent: Intent?): Boolean {
                    return super.onMediaButtonEvent(mediaButtonEvent)
                }
            })
            setFlags(
                MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
                MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
            )
            setSessionActivity(sessionIntent)
            isActive = true
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        MediaButtonReceiver.handleIntent(mediaSession, intent)
        when (intent?.action) {
            ACTION_PLAY -> resume()
            ACTION_PAUSE -> pause()
            ACTION_NEXT -> MainActivity.instance?.postMediaEvent("next")
            ACTION_PREV -> MainActivity.instance?.postMediaEvent("prev")
            ACTION_FAV, "vivomusicmix.media.action.FAVORITE", "action_favorite" -> {
                val req = intent.extras?.let {
                    if (it.containsKey("isFavorite")) it.getBoolean("isFavorite")
                    else if (it.containsKey("favorite")) it.getBoolean("favorite")
                    else null
                }
                handleFavoriteChange(req)
            }
            ACTION_LYRIC -> MainActivity.instance?.postMediaEvent("lyric")
            ACTION_STOP -> stopPlayback()
        }
        return START_NOT_STICKY
    }

    fun handleFavoriteChange(targetState: Boolean? = null) {
        val newFav = targetState ?: !isCurrentFav
        android.util.Log.d("JellyAudio", "handleFavoriteChange: current=$isCurrentFav -> newFav=$newFav")
        updateFavoriteState(newFav)
        MainActivity.instance?.let { activity ->
            activity.runOnUiThread {
                activity.evaluateJavascript("if (window.onNativeFavoriteChanged) { window.onNativeFavoriteChanged($newFav); } else if (window.dispatchMediaEvent) { window.dispatchMediaEvent('fav'); }")
            }
        }
    }

    fun buildMetadata(
        title: String,
        artist: String,
        coverBitmap: Bitmap?,
        isFav: Boolean,
        durationMs: Long,
        lyricSubtitle: String? = null
    ): MediaMetadataCompat {
        val heartRating = RatingCompat.newHeartRating(isFav)
        val subtitle = lyricSubtitle ?: artist
        val builder = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID, currentTrackId.ifEmpty { "current_track_id" })
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "果冻音乐")
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, subtitle)
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_DESCRIPTION, subtitle)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs)
            .putRating(MediaMetadataCompat.METADATA_KEY_USER_RATING, heartRating)
            .putRating(MediaMetadataCompat.METADATA_KEY_RATING, heartRating)
            .putLong("vivomusicmix.media.metadata.support_event", -1L)
            .putLong("vivomusicmix.media.metadata.cast_state", 0L)
            .putLong("vivomusicmix.media.metadata.LOOP_MODE", 0L)
            .putString("vivo.music.isFavorite", isFav.toString())
            .putLong("vivo.music.favorite", if (isFav) 1L else 0L)
            .putString("isFavorite", isFav.toString())
            .putLong("isFavorite", if (isFav) 1L else 0L)

        if (lastLyricLine.isNotEmpty()) {
            builder.putString("android.media.metadata.LYRIC", lastLyricLine)
            builder.putString("lyric", lastLyricLine)
        }

        if (coverBitmap != null) {
            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, coverBitmap)
            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON, coverBitmap)
            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, coverBitmap)
        }
        return builder.build()
    }

    fun play(url: String, trackInfoJson: String) {
        currentTrackJson = trackInfoJson
        val json = try { JSONObject(trackInfoJson) } catch (e: Exception) { JSONObject() }
        val title = json.optString("title", "未知曲目")
        val artist = json.optString("artist", "未知艺术家")
        val coverUrl = json.optString("coverUrl", "")
        val durationMs = json.optInt("duration", 0)
        currentTrackId = json.optString("id", "")
        if (currentTrackId.isEmpty()) {
            val ref = json.optJSONObject("ref")
            if (ref != null) currentTrackId = ref.optString("id", "")
        }
        if (currentTrackId.isEmpty()) {
            currentTrackId = "${title}_${artist}".hashCode().toString()
        }
        if (durationMs > 0) cachedDuration = durationMs
        isCurrentFav = json.optBoolean("isFavorite", false)

        currentSongTitle = title
        currentArtistName = artist
        lastLyricLine = ""
        currentCoverBitmap = null
        isSuperxCreated = false

        android.util.Log.d("JellyAudio", "MusicService play via ExoPlayer: $url, title: $title, artist: $artist, duration: $durationMs, isFav: $isCurrentFav")

        updateMediaSessionState(PlaybackStateCompat.STATE_BUFFERING, 0)
        val initialMetadata = buildMetadata(title, artist, null, isCurrentFav, cachedDuration.toLong())
        mediaSession?.setMetadata(initialMetadata)

        player?.let { p ->
            val mediaItem = MediaItem.fromUri(url)
            p.setMediaItem(mediaItem)
            p.prepare()
            p.play()
        }

        updateNotification(title, artist, coverUrl, true)
    }

    fun updateFavoriteState(isFav: Boolean) {
        isCurrentFav = isFav
        mediaSession?.let { session ->
            val meta = buildMetadata(currentSongTitle, currentArtistName, currentCoverBitmap, isFav, currentDuration.toLong(), if (lastLyricLine.isNotEmpty()) lastLyricLine else null)
            session.setMetadata(meta)
            val bundle = Bundle().apply {
                putBoolean("isFavorite", isFav)
                putBoolean("favorite", isFav)
            }
            session.sendSessionEvent("vivomusicmix.media.action.FAVORITE", bundle)
        }
        val pos = currentPosition.toLong()
        updateMediaSessionState(
            if (isPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED,
            pos
        )
        postNotification(currentSongTitle, currentArtistName, currentCoverBitmap, isPlaying)
    }

    private var currentSongTitle: String = "未知曲目"
    private var currentArtistName: String = "未知艺术家"
    private var lastLyricLine: String = ""
    private var currentCoverBitmap: Bitmap? = null
    private var lastLyricNotifTime: Long = 0L

    fun updateCurrentLyric(lyric: String) {
        val cleanLyric = lyric.trim()
        if (cleanLyric.isEmpty() || cleanLyric == lastLyricLine) return
        lastLyricLine = cleanLyric

        try {
            // 1. Update MediaSessionCompat metadata (Car HUD / Bluetooth Display / Vivo Atomic Island)
            val meta = buildMetadata(currentSongTitle, currentArtistName, currentCoverBitmap, isCurrentFav, currentDuration.toLong(), cleanLyric)
            mediaSession?.setMetadata(meta)

            // Update notification subtitle throttled to avoid excessive SystemUI IPC overhead & heating
            val now = SystemClock.elapsedRealtime()
            if (isPlaying && (now - lastLyricNotifTime > 4000L)) {
                lastLyricNotifTime = now
                postNotification(currentSongTitle, currentArtistName, currentCoverBitmap, true)
            }

            // 2. Broadcast standard AVRCP Bluetooth Car Media Intents
            sendBluetoothCarLyricBroadcast(currentSongTitle, currentArtistName, cleanLyric)
        } catch (e: Exception) {
            android.util.Log.w("JellyAudio", "Failed to update Bluetooth lyric: ${e.message}")
        }
    }

    private fun sendBluetoothCarLyricBroadcast(title: String, artist: String, lyric: String) {
        val actionList = listOf(
            "com.android.music.metachanged",
            "com.kugou.android.music.metachanged",
            "com.tencent.qqmusic.metachanged",
            "com.netease.cloudmusic.metachanged"
        )
        for (act in actionList) {
            try {
                val it = Intent(act).apply {
                    putExtra("track", title)
                    putExtra("artist", "$artist - $lyric")
                    putExtra("lyric", lyric)
                    putExtra("playing", isPlaying)
                    putExtra("position", currentPosition.toLong())
                    putExtra("duration", currentDuration.toLong())
                }
                sendBroadcast(it)
            } catch (ignored: Exception) {}
        }
    }

    fun pause() {
        player?.pause()
        this.isPlaying = false
        releaseLocks()
        val pos = currentPosition.toLong()
        cachedPosition = pos.toInt()
        updateMediaSessionState(PlaybackStateCompat.STATE_PAUSED, pos)
        postNotification(currentSongTitle, currentArtistName, currentCoverBitmap, false)
        onStateChangedListener?.invoke(false)
    }

    fun resume() {
        player?.play()
        this.isPlaying = true
        acquireLocks()
        val pos = currentPosition.toLong()
        cachedPosition = pos.toInt()
        updateMediaSessionState(PlaybackStateCompat.STATE_PLAYING, pos)
        postNotification(currentSongTitle, currentArtistName, currentCoverBitmap, true)
        onStateChangedListener?.invoke(true)
    }

    fun seekTo(positionMs: Int) {
        player?.seekTo(positionMs.toLong())
        updateMediaSessionState(
            if (isPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED,
            positionMs.toLong()
        )
    }

    private fun stopPlayback() {
        player?.stop()
        player?.clearMediaItems()
        isPlaying = false
        releaseLocks()
        if (isSuperxCreated) {
            try {
                val dismissBuilder = NotificationCompat.Builder(this, CHANNEL_ID)
                    .setSmallIcon(R.drawable.ic_launcher)
                    .setContentTitle(currentSongTitle)
                    .setContentText(currentArtistName)
                    .setPriority(NotificationCompat.PRIORITY_MIN)
                    .setSilent(true)
                dismissBuilder.extras.apply {
                    putInt("notification.superx.operation", 2)
                    putInt("island.superx.operation", 2)
                    putBoolean("notification.superx.showNotify", false)
                    putBoolean("island.superx.showNotify", false)
                }
                val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.notify(NOTIFICATION_ID, dismissBuilder.build())
                manager.cancel(NOTIFICATION_ID)
            } catch (ignored: Exception) {}
            isSuperxCreated = false
        }
        if (isForegroundServiceStarted) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            isForegroundServiceStarted = false
        }
        stopSelf()
    }

    private fun updateMediaSessionState(state: Int, pos: Long) {
        val speed = if (state == PlaybackStateCompat.STATE_PLAYING) 1.0f else 0.0f
        val favIcon = if (isCurrentFav) R.drawable.ic_notif_fav_active else R.drawable.ic_notif_fav
        val favBundle = Bundle().apply {
            putBoolean("isFavorite", isCurrentFav)
            putBoolean("favorite", isCurrentFav)
        }
        val customFavAction = PlaybackStateCompat.CustomAction.Builder(
            ACTION_FAV,
            if (isCurrentFav) "已收藏" else "收藏",
            favIcon
        ).setExtras(favBundle).build()

        val vivoMixFavAction = PlaybackStateCompat.CustomAction.Builder(
            "vivomusicmix.media.action.FAVORITE",
            if (isCurrentFav) "已收藏" else "收藏",
            favIcon
        ).setExtras(favBundle).build()

        val stateBuilder = PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY or
                PlaybackStateCompat.ACTION_PAUSE or
                PlaybackStateCompat.ACTION_PLAY_PAUSE or
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                PlaybackStateCompat.ACTION_SEEK_TO or
                PlaybackStateCompat.ACTION_SET_RATING or
                PlaybackStateCompat.ACTION_STOP
            )
            .addCustomAction(customFavAction)
            .addCustomAction(vivoMixFavAction)
            .setState(state, pos, speed, SystemClock.elapsedRealtime())
        mediaSession?.setPlaybackState(stateBuilder.build())
    }

    private fun refreshNotificationState(playing: Boolean) {
        val json = try { JSONObject(currentTrackJson ?: "{}") } catch (e: Exception) { JSONObject() }
        val title = json.optString("title", currentSongTitle)
        val artist = json.optString("artist", currentArtistName)
        val coverUrl = json.optString("coverUrl", "")
        updateNotification(title, artist, coverUrl, playing)
    }

    private fun updateNotification(title: String, artist: String, coverUrl: String, playing: Boolean) {
        currentSongTitle = title
        currentArtistName = artist

        if (currentCoverBitmap != null || coverUrl.isEmpty()) {
            postNotification(title, artist, currentCoverBitmap, playing)
            return
        }

        scope.launch {
            val bitmap = withContext(Dispatchers.IO) {
                try {
                    BitmapFactory.decodeStream(URL(coverUrl).openStream())
                } catch (e: Exception) {
                    null
                }
            }
            currentCoverBitmap = bitmap

            val meta = buildMetadata(title, artist, bitmap, isCurrentFav, cachedDuration.toLong(), if (lastLyricLine.isNotEmpty()) lastLyricLine else null)
            mediaSession?.setMetadata(meta)

            postNotification(title, artist, bitmap, playing)
        }
    }

    private fun postNotification(title: String, artist: String, coverBitmap: Bitmap?, playing: Boolean) {
        val notification = buildNotification(title, artist, coverBitmap, playing)
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (playing) {
            if (!isForegroundServiceStarted) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
                } else {
                    startForeground(NOTIFICATION_ID, notification)
                }
                isForegroundServiceStarted = true
            } else {
                manager.notify(NOTIFICATION_ID, notification)
            }
        } else {
            manager.notify(NOTIFICATION_ID, notification)
        }
    }

    private fun buildNotification(title: String, artist: String, coverBitmap: Bitmap?, playing: Boolean): Notification {
        val contentIntent = PendingIntent.getActivity(
            this, 1002,
            Intent(this, MainActivity::class.java).apply {
                action = "com.jelly.audio.ACTION_OPEN_PLAYER"
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("OPEN_FULL_PLAYER", true)
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val favIntent = PendingIntent.getService(
            this, 10,
            Intent(this, MusicService::class.java).apply { action = ACTION_FAV },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val prevIntent = PendingIntent.getService(
            this, 1,
            Intent(this, MusicService::class.java).apply { action = ACTION_PREV },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val toggleAction = if (playing) ACTION_PAUSE else ACTION_PLAY
        val toggleIcon = if (playing) R.drawable.ic_notif_pause else R.drawable.ic_notif_play
        val toggleText = if (playing) "暂停" else "播放"
        val toggleIntent = PendingIntent.getService(
            this, 2,
            Intent(this, MusicService::class.java).apply { action = toggleAction },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val nextIntent = PendingIntent.getService(
            this, 3,
            Intent(this, MusicService::class.java).apply { action = ACTION_NEXT },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val lyricIntent = PendingIntent.getService(
            this, 11,
            Intent(this, MusicService::class.java).apply { action = ACTION_LYRIC },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val subtitle = if (lastLyricLine.isNotEmpty()) lastLyricLine else "$artist - $title"

        val favIcon = if (isCurrentFav) R.drawable.ic_notif_fav_active else R.drawable.ic_notif_fav
        val favText = if (isCurrentFav) "已收藏" else "收藏"

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(subtitle)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentIntent(contentIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setSilent(true)
            .setShowWhen(false)
            .addAction(favIcon, favText, favIntent)
            .addAction(R.drawable.ic_notif_prev, "上一首", prevIntent)
            .addAction(toggleIcon, toggleText, toggleIntent)
            .addAction(R.drawable.ic_notif_next, "下一首", nextIntent)
            .addAction(R.drawable.ic_notif_lyric, "歌词", lyricIntent)
            .setStyle(
                MediaStyle()
                    .setMediaSession(mediaSession?.sessionToken)
                    .setShowActionsInCompactView(1, 2, 3)
            )
            .setOngoing(playing)

        if (coverBitmap != null) {
            builder.setLargeIcon(coverBitmap)
        }

        val op = if (!isSuperxCreated && playing) {
            isSuperxCreated = true
            0 // 0: Create atomic capsule
        } else {
            1 // 1: Update atomic capsule
        }

        // 1. Vivo OriginOS 4/5/6 SuperX Capsule (原子岛顶栏实时胶囊)
        val capsuleBundle = Bundle().apply {
            putInt("state", if (playing) 1 else 0)
            putInt("notification.superx.capsule.state", if (playing) 1 else 0)
            coverBitmap?.let {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    val icon = android.graphics.drawable.Icon.createWithBitmap(it)
                    putParcelable("icon", icon)
                    putParcelable("notification.superx.capsule.icon", icon)
                }
            }
            putString("title", title)
            putString("content", title)
            putString("notification.superx.capsule.content", title)
            putString("artist", artist)
            putString("subTitle", artist)
            putString("notification.superx.capsule.subTitle", artist)
            putBoolean("isFav", isCurrentFav)
            putBoolean("notification.superx.capsule.isFav", isCurrentFav)
            putParcelable("favIntent", favIntent)
            putParcelable("notification.superx.capsule.favIntent", favIntent)
            putParcelable("playIntent", toggleIntent)
            putParcelable("toggleIntent", toggleIntent)
            putParcelable("nextIntent", nextIntent)
            putParcelable("prevIntent", prevIntent)
            putParcelable("clickResp", contentIntent)
        }

        builder.extras.apply {
            putBundle("notification.superx.capsule", capsuleBundle)
            putInt("notification.superx.operation", op)
            putBoolean("notification.superx.showNotify", true)
            putString("notification.superx.template", "music")
            putString("notification.superx.scene", "music")
            putParcelable("notification.superx.clickResp", contentIntent)

            // Mirror for OriginOS island.superx.* namespace
            putBundle("island.superx.capsule", capsuleBundle)
            putInt("island.superx.operation", op)
            putBoolean("island.superx.showNotify", true)
            putString("island.superx.template", "music")
            putString("island.superx.scene", "music")
            putParcelable("island.superx.clickResp", contentIntent)

            // 2. Vivo OriginOS 4/5/6 Live Notification & Capsule compatibility extras
            putBoolean("vivo.summaryNotification", true)
            putString("vivo.liveNotification.type", "music")
            putString("com.vivo.liveNotification.type", "music")
            putString("origin.liveNotification.type", "media")
            putBoolean("vivo.origin.capsule", true)
            putBoolean("vivo.liveNotification.support", true)
            putBoolean("origin.capsule.enable", true)
            putString("origin.capsule.type", "music")
            putBoolean("vivo.isMusicPlaying", playing)
            putString("vivo.music.title", title)
            putString("vivo.music.artist", artist)
            putLong("vivo.music.duration", cachedDuration.toLong())
            putBoolean("vivo.music.isFavorite", isCurrentFav)
            putBoolean("origin.music.favorite", isCurrentFav)
            putParcelable("vivo.music.favIntent", favIntent)
            putParcelable("origin.music.favIntent", favIntent)
            putParcelable("origin.music.toggleIntent", toggleIntent)
            putParcelable("origin.music.nextIntent", nextIntent)
            putParcelable("origin.music.prevIntent", prevIntent)
        }

        return builder.build()
    }

    override fun onDestroy() {
        releaseLocks()
        player?.release()
        player = null
        mediaSession?.release()
        super.onDestroy()
    }
}
