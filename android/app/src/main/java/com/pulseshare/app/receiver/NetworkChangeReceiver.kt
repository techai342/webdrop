package com.pulseshare.app.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.os.PowerManager
import android.util.Log
import com.pulseshare.app.service.PulseShareForegroundService

/**
 * 24/7 Network Change BroadcastReceiver
 * Automatically detects when Wi-Fi is toggled or restored, acquires a temporary WakeLock,
 * and triggers immediate zero-click reconnection back to the PC without needing to open the app.
 */
class NetworkChangeReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        Log.d("NetworkChangeReceiver", "📡 Network broadcast received: $action")

        val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val wakeLock = powerManager?.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "PulseShare::NetworkChangeWakeLock"
        )
        try {
            wakeLock?.acquire(15000L) // 15 seconds max CPU wake
        } catch (e: Exception) {}

        try {
            val connManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            val activeNetwork = connManager?.activeNetworkInfo
            val isConnected = activeNetwork?.isConnected == true

            Log.d("NetworkChangeReceiver", "Network state: isConnected=$isConnected (type: ${activeNetwork?.typeName})")

            if (isConnected) {
                // Network restored! Ensure service is running and reconnect immediately
                PulseShareForegroundService.start(context)
                PulseShareForegroundService.onNetworkRestored(context)
            }
        } catch (e: Exception) {
            Log.e("NetworkChangeReceiver", "Error in network change receive: ${e.message}")
        }
    }
}
