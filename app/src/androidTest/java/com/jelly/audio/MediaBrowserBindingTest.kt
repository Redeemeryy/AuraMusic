package com.jelly.audio

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class MediaBrowserBindingTest {
    private fun assertBrowserBinder(action: String) {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val complete = CountDownLatch(1)
        var descriptor: String? = null
        val connection = object : ServiceConnection {
            override fun onServiceConnected(name: ComponentName, binder: IBinder) {
                descriptor = binder.interfaceDescriptor
                complete.countDown()
            }
            override fun onNullBinding(name: ComponentName) { complete.countDown() }
            override fun onServiceDisconnected(name: ComponentName) = Unit
        }
        val bound = context.bindService(Intent(action).setClassName(context.packageName, MusicService::class.java.name), connection, Context.BIND_AUTO_CREATE)
        try {
            assertTrue("Service must accept $action", bound)
            assertTrue("Binding callback timed out for $action", complete.await(5, TimeUnit.SECONDS))
            assertEquals("Must expose a media browser, not null or LocalBinder: $action", "android.service.media.IMediaBrowserService", descriptor)
        } finally {
            if (bound) context.unbindService(connection)
        }
    }

    @Test fun standardActionReturnsBrowserBinder() = assertBrowserBinder("android.media.browse.MediaBrowserService")
    @Test fun vivoActionReturnsBrowserBinder() = assertBrowserBinder("com.vivo.musicwidgetmix.support.service")
}
