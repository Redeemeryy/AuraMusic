package com.jelly.audio

import android.support.v4.media.session.PlaybackStateCompat
import android.view.KeyEvent

internal enum class MediaButtonAction {
    NONE,
    PLAY,
    PAUSE,
    NEXT,
    PREV,
    STOP
}

internal enum class BufferingTransition {
    KEEP_BUFFERING,
    REPORT_PLAYING,
    REPORT_PAUSED
}

/**
 * Pure control rules shared by MusicService and MainActivity so background lockscreen,
 * quick-settings, and buffering transitions behave deterministically without UI involvement.
 */
internal object MediaControlPolicy {
    fun resolveMediaKey(keyCode: Int, isPlaying: Boolean, isPlayDesired: Boolean, playWhenReady: Boolean): MediaButtonAction {
        return when (keyCode) {
            KeyEvent.KEYCODE_MEDIA_PAUSE -> MediaButtonAction.PAUSE
            KeyEvent.KEYCODE_MEDIA_PLAY -> MediaButtonAction.PLAY
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
            KeyEvent.KEYCODE_HEADSETHOOK -> {
                if (isPlaying || isPlayDesired || playWhenReady) MediaButtonAction.PAUSE else MediaButtonAction.PLAY
            }
            KeyEvent.KEYCODE_MEDIA_NEXT -> MediaButtonAction.NEXT
            KeyEvent.KEYCODE_MEDIA_PREVIOUS -> MediaButtonAction.PREV
            KeyEvent.KEYCODE_MEDIA_STOP -> MediaButtonAction.STOP
            else -> MediaButtonAction.NONE
        }
    }

    fun classifyIsPlayingChange(
        playing: Boolean,
        isPlayDesired: Boolean,
        exoPlaybackState: Int
    ): BufferingTransition {
        // Player states aligned with Media3 Player constants: IDLE=1, BUFFERING=2, READY=3, ENDED=4.
        if (!playing && isPlayDesired && exoPlaybackState != 1 && exoPlaybackState != 4) {
            return BufferingTransition.KEEP_BUFFERING
        }
        return if (playing) BufferingTransition.REPORT_PLAYING else BufferingTransition.REPORT_PAUSED
    }

    fun shouldKeepBackgroundWebSessionAlive(isPlaying: Boolean, isPlayDesired: Boolean, hasTrack: Boolean): Boolean {
        return isPlaying || isPlayDesired || hasTrack
    }

    fun sessionStateForBuffering(isPlaying: Boolean, isPlayDesired: Boolean): Int {
        return when {
            isPlaying -> PlaybackStateCompat.STATE_PLAYING
            isPlayDesired -> PlaybackStateCompat.STATE_BUFFERING
            else -> PlaybackStateCompat.STATE_PAUSED
        }
    }
}
