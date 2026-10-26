package com.jelly.audio

internal data class TimedLyric(val startMs: Long, val text: String, val endMs: Long? = null)
internal data class RemoteTrackText(val title: String, val artist: String)

internal class PlaybackLyrics {
    var enabled = false
        private set
    var currentLine = ""
        private set
    private var trackKey = ""
    private var timeline: List<TimedLyric> = emptyList()

    fun startTrack(key: String) {
        trackKey = key
        timeline = emptyList()
        currentLine = ""
    }

    fun replaceTimeline(key: String, lines: List<TimedLyric>): Boolean {
        if (key.isBlank() || key != trackKey) return false
        timeline = lines.filter { it.startMs >= 0 }
            .map { it.copy(text = it.text.trim(), endMs = it.endMs?.takeIf { end -> end > it.startMs }) }
            .sortedBy { it.startMs }
        return true
    }

    /** Uses the player's clock, so pauses, buffering and seeks need no wall-clock correction. */
    fun advance(positionMs: Long): Boolean {
        var low = 0
        var high = timeline.lastIndex
        var index = -1
        while (low <= high) {
            val middle = (low + high) ushr 1
            if (timeline[middle].startMs <= positionMs) {
                index = middle
                low = middle + 1
            } else {
                high = middle - 1
            }
        }
        val line = timeline.getOrNull(index)
        val text = if (line != null && (line.endMs == null || positionMs < line.endMs)) line.text else ""
        if (currentLine == text) return false
        currentLine = text
        return true
    }

    fun setEnabled(value: Boolean): Boolean {
        if (enabled == value) return false
        enabled = value
        return true
    }

    fun remoteText(title: String, artist: String, playing: Boolean, lyric: String = currentLine): RemoteTrackText {
        return if (enabled && playing && lyric.isNotBlank()) {
            RemoteTrackText(lyric, "$title - $artist")
        } else {
            RemoteTrackText(title, artist)
        }
    }
}
