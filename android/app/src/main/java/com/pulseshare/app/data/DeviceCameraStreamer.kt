package com.pulseshare.app.data

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.ImageFormat
import android.hardware.camera2.*
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import android.util.Log
import android.util.Size
import androidx.core.content.ContextCompat

object DeviceCameraStreamer {
    private const val TAG = "DeviceCameraStreamer"

    @Volatile
    var isStreaming = false
        private set

    @Volatile
    var currentFacing = "back"
        private set

    @Volatile
    var isTorchEnabled = false
        private set

    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var imageReader: ImageReader? = null
    private var backgroundThread: HandlerThread? = null
    private var backgroundHandler: Handler? = null

    private var frameCallback: ((ByteArray) -> Unit)? = null
    private var lastFrameTime = 0L
    private var currentJpegOrientation = 90
    private const val MIN_FRAME_INTERVAL_MS = 50L // ~20 FPS optimal for local network

    fun hasCameraPermission(context: Context): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun startBackgroundThread() {
        if (backgroundThread == null) {
            backgroundThread = HandlerThread("PulseShareCameraThread").apply { start() }
            backgroundHandler = Handler(backgroundThread!!.looper)
        }
    }

    private fun stopBackgroundThread() {
        backgroundThread?.quitSafely()
        try {
            backgroundThread?.join(500)
        } catch (e: Exception) {}
        backgroundThread = null
        backgroundHandler = null
    }

    @SuppressLint("MissingPermission")
    fun startStreaming(
        context: Context,
        facing: String = "back",
        onFrame: (ByteArray) -> Unit,
        onError: (String) -> Unit
    ) {
        if (!hasCameraPermission(context)) {
            onError("Camera permission is not granted on phone. Please allow Camera permission.")
            return
        }

        stopStreaming() // Stop any previous session cleanly

        startBackgroundThread()
        currentFacing = if (facing.equals("front", ignoreCase = true)) "front" else "back"
        frameCallback = onFrame
        lastFrameTime = 0L

        val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as? CameraManager
        if (cameraManager == null) {
            onError("Camera service unavailable on device.")
            return
        }

        val cameraId = findCameraId(cameraManager, currentFacing)
        if (cameraId == null) {
            onError("Could not find ${currentFacing.uppercase()} camera on this phone.")
            return
        }

        try {
            val chars = cameraManager.getCameraCharacteristics(cameraId)
            val sensorOrientation = chars.get(CameraCharacteristics.SENSOR_ORIENTATION) ?: 90
            currentJpegOrientation = if (currentFacing == "front") {
                (sensorOrientation + 360) % 360
            } else {
                sensorOrientation
            }
            val map = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
            val outputSizes = map?.getOutputSizes(ImageFormat.JPEG)

            // Select resolution near 640x480 (VGA) for smooth 20 FPS video streaming
            val chosenSize = outputSizes?.minByOrNull {
                val diffW = Math.abs(it.width - 640)
                val diffH = Math.abs(it.height - 480)
                diffW + diffH
            } ?: Size(640, 480)

            Log.d(TAG, "Selected Camera $cameraId ($currentFacing) resolution: ${chosenSize.width}x${chosenSize.height}")

            imageReader = ImageReader.newInstance(chosenSize.width, chosenSize.height, ImageFormat.JPEG, 2)
            imageReader?.setOnImageAvailableListener({ reader ->
                try {
                    val img = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
                    val now = SystemClock.elapsedRealtime()
                    if (now - lastFrameTime < MIN_FRAME_INTERVAL_MS) {
                        img.close()
                        return@setOnImageAvailableListener
                    }
                    lastFrameTime = now

                    val planes = img.planes
                    if (planes.isNotEmpty()) {
                        val buffer = planes[0].buffer
                        val bytes = ByteArray(buffer.remaining())
                        buffer.get(bytes)
                        img.close()
                        Log.d(TAG, "📸 Frame captured: ${bytes.size} bytes ($currentFacing)")
                        frameCallback?.invoke(bytes)
                    } else {
                        img.close()
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Frame capture error: ${e.message}")
                }
            }, backgroundHandler)

            cameraManager.openCamera(cameraId, object : CameraDevice.StateCallback() {
                override fun onOpened(camera: CameraDevice) {
                    cameraDevice = camera
                    isStreaming = true
                    createCaptureSession(camera, onError)
                }

                override fun onDisconnected(camera: CameraDevice) {
                    Log.w(TAG, "Camera disconnected")
                    camera.close()
                    cameraDevice = null
                    isStreaming = false
                }

                override fun onError(camera: CameraDevice, error: Int) {
                    Log.e(TAG, "Camera open error code: $error")
                    camera.close()
                    cameraDevice = null
                    isStreaming = false
                    onError("Failed to open camera (Error code: $error)")
                }
            }, backgroundHandler)

        } catch (e: Exception) {
            Log.e(TAG, "startStreaming exception: ${e.message}")
            onError("Camera error: ${e.message}")
            stopStreaming()
        }
    }

    private fun createCaptureSession(camera: CameraDevice, onError: (String) -> Unit) {
        val reader = imageReader ?: return
        try {
            val surface = reader.surface
            camera.createCaptureSession(
                listOf(surface),
                object : CameraCaptureSession.StateCallback() {
                    override fun onConfigured(session: CameraCaptureSession) {
                        captureSession = session
                        try {
                            val reqBuilder = camera.createCaptureRequest(CameraDevice.TEMPLATE_RECORD).apply {
                                addTarget(surface)
                                set(CaptureRequest.CONTROL_MODE, CameraMetadata.CONTROL_MODE_AUTO)
                                set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_VIDEO)
                                set(CaptureRequest.JPEG_ORIENTATION, currentJpegOrientation)
                                set(CaptureRequest.JPEG_QUALITY, 55.toByte())
                                if (currentFacing == "back" && isTorchEnabled) {
                                    set(CaptureRequest.FLASH_MODE, CaptureRequest.FLASH_MODE_TORCH)
                                }
                            }
                            session.setRepeatingRequest(reqBuilder.build(), null, backgroundHandler)
                            Log.d(TAG, "Camera repeating preview active ($currentFacing)!")
                        } catch (e: Exception) {
                            Log.e(TAG, "Failed to start repeating preview: ${e.message}")
                            onError("Preview error: ${e.message}")
                        }
                    }

                    override fun onConfigureFailed(session: CameraCaptureSession) {
                        Log.e(TAG, "Camera capture session configuration failed")
                        onError("Camera session configuration failed")
                    }
                },
                backgroundHandler
            )
        } catch (e: Exception) {
            Log.e(TAG, "createCaptureSession exception: ${e.message}")
            onError("Session error: ${e.message}")
        }
    }

    fun switchCamera(
        context: Context,
        targetFacing: String? = null,
        onFrame: (ByteArray) -> Unit,
        onError: (String) -> Unit
    ) {
        val newFacing = if (!targetFacing.isNullOrBlank()) {
            if (targetFacing.equals("front", ignoreCase = true)) "front" else "back"
        } else {
            if (currentFacing == "back") "front" else "back"
        }
        isTorchEnabled = false // Reset torch on switch
        startStreaming(context, newFacing, onFrame, onError)
    }

    fun setTorch(enable: Boolean) {
        if (currentFacing != "back") return
        isTorchEnabled = enable
        val session = captureSession ?: return
        val camera = cameraDevice ?: return
        val surface = imageReader?.surface ?: return

        try {
            val reqBuilder = camera.createCaptureRequest(CameraDevice.TEMPLATE_RECORD).apply {
                addTarget(surface)
                set(CaptureRequest.CONTROL_MODE, CameraMetadata.CONTROL_MODE_AUTO)
                set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_VIDEO)
                set(CaptureRequest.JPEG_ORIENTATION, currentJpegOrientation)
                set(CaptureRequest.JPEG_QUALITY, 55.toByte())
                if (enable) {
                    set(CaptureRequest.FLASH_MODE, CaptureRequest.FLASH_MODE_TORCH)
                } else {
                    set(CaptureRequest.FLASH_MODE, CaptureRequest.FLASH_MODE_OFF)
                }
            }
            session.setRepeatingRequest(reqBuilder.build(), null, backgroundHandler)
        } catch (e: Exception) {
            Log.e(TAG, "Error setting camera torch: ${e.message}")
        }
    }

    fun stopStreaming() {
        isStreaming = false
        isTorchEnabled = false
        frameCallback = null

        try {
            captureSession?.stopRepeating()
            captureSession?.close()
        } catch (e: Exception) {}
        captureSession = null

        try {
            cameraDevice?.close()
        } catch (e: Exception) {}
        cameraDevice = null

        try {
            imageReader?.close()
        } catch (e: Exception) {}
        imageReader = null

        stopBackgroundThread()
        Log.d(TAG, "DeviceCameraStreamer fully stopped.")
    }

    private fun findCameraId(cameraManager: CameraManager, desiredFacing: String): String? {
        val targetFacing = if (desiredFacing.equals("front", ignoreCase = true)) {
            CameraCharacteristics.LENS_FACING_FRONT
        } else {
            CameraCharacteristics.LENS_FACING_BACK
        }

        for (id in cameraManager.cameraIdList) {
            val chars = cameraManager.getCameraCharacteristics(id)
            if (chars.get(CameraCharacteristics.LENS_FACING) == targetFacing) {
                return id
            }
        }
        return cameraManager.cameraIdList.firstOrNull()
    }
}
