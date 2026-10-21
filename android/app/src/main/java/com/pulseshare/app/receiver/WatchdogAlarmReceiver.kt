package com.pulseshare.app.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import android.util.Log
import com.pulseshare.app.service.PulseShareForegroundService

/**
 * AlarmManager 2-Minute Watchdog Receiver
 * Wakes the CPU from Android Doze / Deep Sleep via ELAPSED_REALTIME_WAKEUP,
 * acquires a 15-second WakeLock, and verifies active socket connections.
 */
class WatchdogAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Log.d("WatchdogAlarmReceiver", "⏰ Watchdog Alarm fired! Verifying background connections...")
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val wakeLock = powerManager?.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "PulseShare::WatchdogWakeLock"
        )
        try {
            wakeLock?.acquire(15000L) // 15 seconds max
        } catch (e: Exception) {}

        try {
            PulseShareForegroundService.start(context)
            PulseShareForegroundService.pingWatchdog(context)
        } catch (e: Exception) {
            Log.e("WatchdogAlarmReceiver", "Error in watchdog alarm receive: ${e.message}")
        }
    }
}
