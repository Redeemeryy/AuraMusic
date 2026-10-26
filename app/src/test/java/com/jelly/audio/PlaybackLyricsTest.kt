package com.jelly.audio

import org.junit.Assert.*
import org.junit.Test

class PlaybackLyricsTest {
    private fun ready() = PlaybackLyrics().apply {
        startTrack("wy:42")
        replaceTimeline("wy:42", listOf(
            TimedLyric(1_000, "第一句"),
            TimedLyric(3_000, "第二句", 4_000),
            TimedLyric(5_000, "尾声")
        ))
    }

    @Test fun exactBoundaryAndSeekSelectTheCurrentLine() {
        val lyrics = ready()
        assertFalse(lyrics.advance(999))
        assertEquals("", lyrics.currentLine)
        assertTrue(lyrics.advance(1_000))
        assertEquals("第一句", lyrics.currentLine)
        assertTrue(lyrics.advance(3_500))
        assertEquals("第二句", lyrics.currentLine)
        assertTrue(lyrics.advance(1_500))
        assertEquals("第一句", lyrics.currentLine)
        assertTrue(lyrics.advance(0))
        assertEquals("", lyrics.currentLine)
    }

    @Test fun explicitEndAndEmptyLinesClearInsteadOfLeakingPreviousLyrics() {
        val lyrics = ready()
        lyrics.advance(3_500)
        assertTrue(lyrics.advance(4_000))
        assertEquals("", lyrics.currentLine)
        lyrics.replaceTimeline("wy:42", listOf(TimedLyric(0, "唱词"), TimedLyric(2_000, "  ")))
        lyrics.advance(1_000)
        assertEquals("唱词", lyrics.currentLine)
        lyrics.advance(2_000)
        assertEquals("", lyrics.currentLine)
    }

    @Test fun lateLyricsCannotReplaceTheNewTrack() {
        val lyrics = ready()
        lyrics.advance(1_500)
        lyrics.startTrack("tx:42")
        assertEquals("", lyrics.currentLine)
        assertFalse(lyrics.replaceTimeline("wy:42", listOf(TimedLyric(0, "旧歌"))))
        lyrics.advance(2_000)
        assertEquals("", lyrics.currentLine)
        assertTrue(lyrics.replaceTimeline("tx:42", listOf(TimedLyric(0, "新歌"))))
        lyrics.advance(2_000)
        assertEquals("新歌", lyrics.currentLine)
    }

    @Test fun sameLineDoesNotCauseRepeatedMetadataUpdates() {
        val lyrics = ready()
        assertTrue(lyrics.advance(1_000))
        for (position in listOf(1_250L, 1_500L, 1_750L, 2_500L)) {
            assertFalse(lyrics.advance(position))
        }
    }

    @Test fun bluetoothUsesStandardTitleAndPreservesTheSongInArtist() {
        val lyrics = ready()
        lyrics.setEnabled(true)
        lyrics.advance(1_500)
        assertEquals(RemoteTrackText("第一句", "歌曲 - 歌手"), lyrics.remoteText("歌曲", "歌手", true))
    }

    @Test fun disablingOrPausingRestoresOriginalTrackMetadataImmediately() {
        val lyrics = ready()
        lyrics.setEnabled(true)
        lyrics.advance(1_500)
        assertEquals(RemoteTrackText("歌曲", "歌手"), lyrics.remoteText("歌曲", "歌手", false))
        assertEquals(RemoteTrackText("第一句", "歌曲 - 歌手"), lyrics.remoteText("歌曲", "歌手", true))
        assertTrue(lyrics.setEnabled(false))
        assertEquals(RemoteTrackText("歌曲", "歌手"), lyrics.remoteText("歌曲", "歌手", true))
        assertFalse(lyrics.setEnabled(false))
    }

    @Test fun unavailableLyricsAndDisabledDefaultKeepOriginalSong() {
        val lyrics = ready()
        lyrics.advance(1_500)
        assertEquals(RemoteTrackText("歌曲", "歌手"), lyrics.remoteText("歌曲", "歌手", true))
        lyrics.setEnabled(true)
        lyrics.replaceTimeline("wy:42", emptyList())
        lyrics.advance(2_000)
        assertEquals(RemoteTrackText("歌曲", "歌手"), lyrics.remoteText("歌曲", "歌手", true))
    }

    @Test fun unsortedTimelineIsNormalizedAndDuplicateTimeUsesLastLine() {
        val lyrics = PlaybackLyrics()
        lyrics.startTrack("track")
        lyrics.replaceTimeline("track", listOf(
            TimedLyric(3_000, "后句"), TimedLyric(-50, "无效"),
            TimedLyric(1_000, "旧句"), TimedLyric(1_000, "  新句  ")
        ))
        lyrics.advance(0)
        assertEquals("", lyrics.currentLine)
        lyrics.advance(1_000)
        assertEquals("新句", lyrics.currentLine)
        lyrics.advance(5_000)
        assertEquals("后句", lyrics.currentLine)
    }
}
