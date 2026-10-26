package com.jelly.audio.updates

import org.junit.Assert.*
import org.junit.Test

class ResumePolicyTest {
    @Test fun exactRangeCanAppendButIgnoredRangeRestarts() {
        assertTrue(ResumePolicy.validate(206, "bytes 40-99/100", 60, 40, 100))
        assertFalse(ResumePolicy.validate(200, null, 100, 40, 100))
    }
    @Test fun shiftedTruncatedAndUnknownTotalRangesAreRejected() {
        for (range in listOf("bytes 0-59/100", "bytes 40-99/101", "bytes 40-100/100", "bytes 40-99/*", "garbage")) {
            assertThrows(Exception::class.java) { ResumePolicy.validate(206, range, 60, 40, 100) }
        }
        assertThrows(Exception::class.java) { ResumePolicy.validate(206, "bytes 40-99/100", 59, 40, 100) }
        assertThrows(Exception::class.java) { ResumePolicy.validate(200, null, 101, 0, 100) }
        assertThrows(Exception::class.java) { ResumePolicy.validate(404, null, -1, 0, 100) }
    }
}
