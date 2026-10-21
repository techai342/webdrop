package com.pulseshare.app.data

import android.content.Context
import android.hardware.camera2.CameraAccessException
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.*
import android.util.Log

object DeviceHardwareHelper {
    private const val TAG = "DeviceHardwareHelper"

    private var isTorchOn = false
    private var alertMediaPlayer: MediaPlayer? = null
    private var alertVibrator: Vibrator? = null
    private var isFindingPhone = false
    private var torchBlinkHandler: Handler? = null
    private var torchBlinkRunnable: Runnable? = null

    /**
     * Vibrate phone with ultra-fast, maximum-intensity haptic pulse burst!
     */
    fun vibrate(context: Context, durationMs: Long = 1500L) {
        try {
            val vibrator = getVibrator(context)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // High-velocity sharp pulsing waveform for maximum tactile buzz
                val timings = longArrayOf(0, 180, 50, 180, 50, 250, 50, 250, 50, 350)
                val amplitudes = intArrayOf(0, 255, 0, 255, 0, 255, 0, 255, 0, 255)
                val effect = VibrationEffect.createWaveform(timings, amplitudes, -1)
                vibrator.vibrate(effect)
            } else {
                val timings = longArrayOf(0, 180, 50, 180, 50, 250, 50, 250, 50, 350)
                @Suppress("DEPRECATION")
                vibrator.vibrate(timings, -1)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Vibrate error: ${e.message}")
        }
    }

    /**
     * Set flashlight / torch mode ON or OFF
     */
    fun setFlashlight(context: Context, enable: Boolean): Boolean {
        val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as? CameraManager ?: return false
        return try {
            val cameraId = getTorchCameraId(cameraManager) ?: return false
            cameraManager.setTorchMode(cameraId, enable)
            isTorchOn = enable
            true
        } catch (e: CameraAccessException) {
            Log.e(TAG, "Camera torch error: ${e.message}")
            false
        } catch (e: Exception) {
            Log.e(TAG, "General torch error: ${e.message}")
            false
        }
    }

    /**
     * Toggle Flashlight ON/OFF
     */
    fun toggleFlashlight(context: Context): Boolean {
        val newState = !isTorchOn
        setFlashlight(context, newState)
        return newState
    }

    /**
     * Find My Phone: Loud Ringing + Flashing Torch + Continuous Vibration!
     * Perfect for locating misplaced phone from laptop.
     */
    fun startFindMyPhoneAlert(context: Context) {
        if (isFindingPhone) return
        isFindingPhone = true

        // 1. Play Loud Alarm / Ringtone
        try {
            val alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)

            alertMediaPlayer?.release()
            alertMediaPlayer = MediaPlayer().apply {
                setDataSource(context, alertUri)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                isLooping = true
                prepare()
                start()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Alarm sound error: ${e.message}")
        }

        // 2. Pulse Vibration Pattern
        try {
            alertVibrator = getVibrator(context)
            val pattern = longArrayOf(0, 500, 200, 500, 200, 800, 300)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val effect = VibrationEffect.createWaveform(pattern, 0) // 0 = repeat
                alertVibrator?.vibrate(effect)
            } else {
                @Suppress("DEPRECATION")
                alertVibrator?.vibrate(pattern, 0)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Alarm vibrator error: ${e.message}")
        }

        // 3. Strobe / Flashlight Blinking
        torchBlinkHandler = Handler(Looper.getMainLooper())
        var blinkState = false
        torchBlinkRunnable = object : Runnable {
            override fun run() {
                if (!isFindingPhone) return
                blinkState = !blinkState
                setFlashlight(context, blinkState)
                torchBlinkHandler?.postDelayed(this, 400)
            }
        }
        torchBlinkHandler?.post(torchBlinkRunnable!!)
    }

    /**
     * Stop Find My Phone Alert
     */
    fun stopFindMyPhoneAlert(context: Context) {
        isFindingPhone = false

        // Stop Audio
        try {
            alertMediaPlayer?.stop()
            alertMediaPlayer?.release()
            alertMediaPlayer = null
        } catch (e: Exception) {
            Log.e(TAG, "Stop audio error: ${e.message}")
        }

        // Stop Vibration
        try {
            alertVibrator?.cancel()
            alertVibrator = null
        } catch (e: Exception) {
            Log.e(TAG, "Stop vibrator error: ${e.message}")
        }

        // Stop Strobe Flashlight
        torchBlinkHandler?.removeCallbacksAndMessages(null)
        torchBlinkHandler = null
        torchBlinkRunnable = null
        setFlashlight(context, false)
    }

    fun isFindingPhoneActive(): Boolean = isFindingPhone

    private fun getVibrator(context: Context): Vibrator {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
    }

    private fun getTorchCameraId(cameraManager: CameraManager): String? {
        return try {
            cameraManager.cameraIdList.firstOrNull { id ->
                val characteristics = cameraManager.getCameraCharacteristics(id)
                val hasFlash = characteristics.get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
                val facing = characteristics.get(CameraCharacteristics.LENS_FACING)
                hasFlash && facing == CameraCharacteristics.LENS_FACING_BACK
            } ?: cameraManager.cameraIdList.firstOrNull()
        } catch (e: Exception) {
            null
        }
    }
}
