package com.pulseshare.app.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.pulseshare.app.service.PulseShareForegroundService

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        Log.d("BootReceiver", "Device boot received with action: $action")
        if (action == Intent.ACTION_BOOT_COMPLETED ||
            action == Intent.ACTION_LOCKED_BOOT_COMPLETED ||
            action == "android.intent.action.QUICKBOOT_POWERON" ||
            action == "com.htc.intent.action.QUICKBOOT_POWERON"
        ) {
            try {
                // Auto-start PulseShare 24/7 background connection on reboot
                PulseShareForegroundService.start(context)
                Log.d("BootReceiver", "PulseShareForegroundService auto-started successfully on reboot")
            } catch (e: Exception) {
                Log.e("BootReceiver", "Failed to start service on boot: ${e.message}")
            }
        }
    }
}
