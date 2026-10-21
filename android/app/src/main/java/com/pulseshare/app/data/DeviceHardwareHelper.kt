package com.pulseshare.app.data

import android.app.WallpaperManager
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.hardware.camera2.CameraAccessException
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.*
import android.util.Base64
import android.util.Log

object DeviceHardwareHelper {
    private const val TAG = "DeviceHardwareHelper"

    private var isTorchOn = false
    private var torchCallbackRegistered = false
    private var alertMediaPlayer: MediaPlayer? = null
    private var alertVibrator: Vibrator? = null
    private var isFindingPhone = false
    private var torchBlinkHandler: Handler? = null
    private var torchBlinkRunnable: Runnable? = null

    private fun registerTorchCallbackIfNeeded(cameraManager: CameraManager) {
        if (torchCallbackRegistered) return
        try {
            cameraManager.registerTorchCallback(object : CameraManager.TorchCallback() {
                override fun onTorchModeChanged(cameraId: String, enabled: Boolean) {
                    val targetId = getTorchCameraId(cameraManager)
                    if (cameraId == targetId) {
                        isTorchOn = enabled
                        Log.d(TAG, "Hardware Torch state updated: $enabled")
                    }
                }
            }, Handler(Looper.getMainLooper()))
            torchCallbackRegistered = true
        } catch (e: Exception) {
            Log.w(TAG, "Failed to register TorchCallback: ${e.message}")
        }
    }

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
        registerTorchCallbackIfNeeded(cameraManager)
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

    private var lastToggleTime = 0L

    /**
     * Toggle Flashlight ON/OFF with 800ms anti-duplicate / anti-strobe lock
     */
    fun toggleFlashlight(context: Context): Boolean {
        val now = SystemClock.elapsedRealtime()
        if (now - lastToggleTime < 800L) {
            Log.w(TAG, "Ignoring duplicate torch toggle within ${now - lastToggleTime}ms (Current state: $isTorchOn)")
            return isTorchOn
        }
        lastToggleTime = now

        val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as? CameraManager ?: return false
        registerTorchCallbackIfNeeded(cameraManager)
        val newState = !isTorchOn
        setFlashlight(context, newState)
        return newState
    }

    fun isTorchActive(): Boolean = isTorchOn

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

    /**
     * Set Phone Wallpaper (Home, Lock, or Both) from Bitmap
     */
    fun setPhoneWallpaper(context: Context, bitmap: Bitmap, screen: String = "both"): Boolean {
        return try {
            val wallpaperManager = WallpaperManager.getInstance(context)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                val which = when (screen.lowercase()) {
                    "home" -> WallpaperManager.FLAG_SYSTEM
                    "lock" -> WallpaperManager.FLAG_LOCK
                    else -> WallpaperManager.FLAG_SYSTEM or WallpaperManager.FLAG_LOCK
                }
                wallpaperManager.setBitmap(bitmap, null, true, which)
            } else {
                wallpaperManager.setBitmap(bitmap)
            }
            Log.d(TAG, "Wallpaper successfully set for: $screen")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to set wallpaper: ${e.message}", e)
            false
        }
    }

    /**
     * Set Phone Wallpaper from Base64 string sent from Laptop
     */
    fun setPhoneWallpaperFromBase64(context: Context, base64Data: String, screen: String = "both"): Boolean {
        return try {
            val clean = if (base64Data.contains(",")) base64Data.substringAfter(",") else base64Data
            val bytes = Base64.decode(clean, Base64.DEFAULT)
            val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return false
            setPhoneWallpaper(context, bitmap, screen)
        } catch (e: Exception) {
            Log.e(TAG, "Error decoding wallpaper base64: ${e.message}")
            false
        }
    }

    /**
     * Set Phone Wallpaper directly from an existing media file ID on phone
     */
    fun setPhoneWallpaperFromFileId(context: Context, fileId: String, screen: String = "both"): Boolean {
        return try {
            val result = DeviceMediaHelper.getMediaFileBytes(context, fileId) ?: return false
            val bitmap = BitmapFactory.decodeByteArray(result.second, 0, result.second.size) ?: return false
            setPhoneWallpaper(context, bitmap, screen)
        } catch (e: Exception) {
            Log.e(TAG, "Error setting wallpaper from fileId: ${e.message}")
            false
        }
    }

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
