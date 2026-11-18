package com.jelly.audio

import android.support.v4.media.session.PlaybackStateCompat
import android.view.KeyEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MediaControlPolicyTest {
    @Test
    fun bufferingPlayPauseKeyTogglesToPauseInsteadOfResuming() {
        val duringBuffering = MediaControlPolicy.resolveMediaKey(
            keyCode = KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
            isPlaying = false,
            isPlayDesired = true,
            playWhenReady = true
        )
        assertEquals(MediaButtonAction.PAUSE, duringBuffering)

        val whilePaused = MediaControlPolicy.resolveMediaKey(
            keyCode = KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
            isPlaying = false,
            isPlayDesired = false,
            playWhenReady = false
        )
        assertEquals(MediaButtonAction.PLAY, whilePaused)
    }

    @Test
    fun explicitHardwareKeysMapUnambiguouslyToTransportActions() {
        assertEquals(
            MediaButtonAction.PAUSE,
            MediaControlPolicy.resolveMediaKey(KeyEvent.KEYCODE_MEDIA_PAUSE, isPlaying = false, isPlayDesired = false, playWhenReady = false)
        )
        assertEquals(
            MediaButtonAction.NEXT,
            MediaControlPolicy.resolveMediaKey(KeyEvent.KEYCODE_MEDIA_NEXT, isPlaying = false, isPlayDesired = false, playWhenReady = false)
        )
        assertEquals(
            MediaButtonAction.PREV,
            MediaControlPolicy.resolveMediaKey(KeyEvent.KEYCODE_MEDIA_PREVIOUS, isPlaying = true, isPlayDesired = true, playWhenReady = true)
        )
    }

    @Test
    fun trackSwitchBufferingNeverFlickersPausedStateOrReleasesNotification() {
        assertEquals(
            BufferingTransition.KEEP_BUFFERING,
            MediaControlPolicy.classifyIsPlayingChange(playing = false, isPlayDesired = true, exoPlaybackState = 2)
        )
        assertEquals(
            BufferingTransition.REPORT_PAUSED,
            MediaControlPolicy.classifyIsPlayingChange(playing = false, isPlayDesired = false, exoPlaybackState = 3)
        )
        assertEquals(
            BufferingTransition.REPORT_PAUSED,
            MediaControlPolicy.classifyIsPlayingChange(playing = false, isPlayDesired = true, exoPlaybackState = 4)
        )
        assertEquals(PlaybackStateCompat.STATE_BUFFERING, MediaControlPolicy.sessionStateForBuffering(isPlaying = false, isPlayDesired = true))
    }

    @Test
    fun backgroundWebViewRemainsActiveWhenPausedOrLoadingWithLoadedTrack() {
        assertTrue(MediaControlPolicy.shouldKeepBackgroundWebSessionAlive(isPlaying = false, isPlayDesired = false, hasTrack = true))
        assertTrue(MediaControlPolicy.shouldKeepBackgroundWebSessionAlive(isPlaying = false, isPlayDesired = true, hasTrack = false))
        assertFalse(MediaControlPolicy.shouldKeepBackgroundWebSessionAlive(isPlaying = false, isPlayDesired = false, hasTrack = false))
    }
}
