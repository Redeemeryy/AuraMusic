package com.jelly.audio.updates

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build

/** Explicit, non-exported receiver; only the session's PendingIntent can deliver a result. */
class UpdateInstallReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != NativeUpdater.INSTALL_ACTION) return
        val preferences = context.getSharedPreferences(NativeUpdater.INSTALL_PREFS, 0)
        val session = preferences.getInt("session", -1)
        if (session < 0 || intent.getIntExtra("auraSession", -2) != session || intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, -2) != session) return
        var status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            val confirmation: Intent? = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
            else @Suppress("DEPRECATION") intent.getParcelableExtra(Intent.EXTRA_INTENT)
            try {
                check(confirmation != null) { "系统安装确认未返回" }
                context.startActivity(confirmation.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            } catch (_: Exception) {
                status = PackageInstaller.STATUS_FAILURE
                runCatching { context.packageManager.packageInstaller.abandonSession(session) }
            }
        }
        preferences.edit().putInt("result", status).commit()
        NativeUpdater.active.get()?.consumeInstallationResult()
    }
}
