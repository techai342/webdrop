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
            action == Intent.ACTION_MY_PACKAGE_REPLACED ||
            action == "android.intent.action.QUICKBOOT_POWERON" ||
            action == "com.htc.intent.action.QUICKBOOT_POWERON"
        ) {
            try {
                // Read last active Room ID from persistent storage
                val prefs = context.getSharedPreferences("pulseshare_prefs", Context.MODE_PRIVATE)
                val savedRoom = prefs.getString("last_room_id", "PULSE1") ?: "PULSE1"

                // Auto-start PulseShare 24/7 background connection on reboot
                PulseShareForegroundService.start(context, savedRoom)
                Log.d("BootReceiver", "PulseShareForegroundService auto-started successfully on reboot for room: $savedRoom")
            } catch (e: Exception) {
                Log.e("BootReceiver", "Failed to start service on boot: ${e.message}")
            }
        }
    }
}
