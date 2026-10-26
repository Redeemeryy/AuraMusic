package com.jelly.audio.updates

object ResumePolicy {
    /** True means append; false means a complete response and truncate the old partial file. */
    fun validate(status: Int, range: String?, length: Long, offset: Long, expected: Long): Boolean {
        require(offset in 0 until expected) { "下载偏移无效" }
        if (status == 200) {
            require(length == -1L || length == expected) { "完整下载长度不匹配" }
            return false
        }
        require(status == 206) { "下载服务器返回 HTTP $status" }
        val match = Regex("bytes (\\d+)-(\\d+)/(\\d+)").matchEntire(range ?: "") ?: throw IllegalArgumentException("下载 Content-Range 无效")
        val (start, end, total) = match.destructured
        val first = start.toLong(); val last = end.toLong()
        require(first == offset && last in first until expected && total.toLong() == expected) { "下载续传区间不匹配" }
        require(length == -1L || length == last - first + 1) { "下载续传长度不匹配" }
        return true
    }
}
