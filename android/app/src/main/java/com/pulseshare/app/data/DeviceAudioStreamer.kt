package com.pulseshare.app.data

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import androidx.core.content.ContextCompat
import kotlin.math.sqrt

/**
 * High-performance, low-latency live microphone audio streamer.
 * Captures 16000Hz 16-bit Mono PCM audio in 100ms chunks and calculates real-time RMS sound levels.
 */
object DeviceAudioStreamer {
    private const val TAG = "DeviceAudioStreamer"

    const val SAMPLE_RATE = 16000
    const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
    const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT

    @Volatile
    var isStreaming = false
        private set

    @Volatile
    private var isStopping = false

    private var audioRecord: AudioRecord? = null
    private var recordingThread: Thread? = null

    fun hasMicPermission(context: Context): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }

    @Synchronized
    @SuppressLint("MissingPermission")
    fun startStreaming(
        context: Context,
        onAudioChunk: (bytes: ByteArray, volumeRms: Int) -> Unit,
        onError: (String) -> Unit
    ) {
        if (!hasMicPermission(context)) {
            onError("Microphone permission (RECORD_AUDIO) not granted on phone. Please grant permission.")
            return
        }

        stopStreaming()

        isStopping = false
        isStreaming = true

        recordingThread = Thread({
            android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_URGENT_AUDIO)

            val minBufferSize = AudioRecord.getMinBufferSize(
                SAMPLE_RATE,
                CHANNEL_CONFIG,
                AUDIO_FORMAT
            )

            // Chunk size: 100ms at 16000Hz 16-bit mono = 1600 samples = 3200 bytes
            val chunkSize = 3200
            val bufferSize = maxOf(minBufferSize * 2, chunkSize * 4)

            try {
                audioRecord = AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    SAMPLE_RATE,
                    CHANNEL_CONFIG,
                    AUDIO_FORMAT,
                    bufferSize
                )

                if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                    onError("Failed to initialize AudioRecord hardware.")
                    stopStreaming()
                    return@Thread
                }

                audioRecord?.startRecording()
                Log.d(TAG, "🎙️ AudioRecord started recording successfully at ${SAMPLE_RATE}Hz mono!")

                val pcmBuffer = ByteArray(chunkSize)

                while (isStreaming && !isStopping && !Thread.currentThread().isInterrupted) {
                    val bytesRead = audioRecord?.read(pcmBuffer, 0, pcmBuffer.size) ?: -1
                    if (bytesRead > 0) {
                        // Calculate RMS volume level (0-100)
                        var sum = 0.0
                        var sampleCount = 0
                        var i = 0
                        while (i < bytesRead - 1) {
                            val sample = (pcmBuffer[i].toInt() and 0xFF) or (pcmBuffer[i + 1].toInt() shl 8)
                            val shortSample = sample.toShort()
                            sum += (shortSample * shortSample).toDouble()
                            sampleCount++
                            i += 2
                        }
                        val rms = if (sampleCount > 0) sqrt(sum / sampleCount) else 0.0
                        val volumePercent = (rms / 32768.0 * 200.0).coerceIn(0.0, 100.0).toInt()

                        val chunkCopy = pcmBuffer.copyOf(bytesRead)
                        onAudioChunk(chunkCopy, volumePercent)
                    } else if (bytesRead < 0) {
                        Log.w(TAG, "AudioRecord read error: $bytesRead")
                        break
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Audio streaming exception: ${e.message}")
                onError("Microphone error: ${e.message}")
            } finally {
                cleanUpAudioRecord()
                isStreaming = false
                Log.d(TAG, "🎙️ AudioRecord stopped and released.")
            }
        }, "PulseShareAudioRecordThread")

        recordingThread?.start()
    }

    @Synchronized
    fun stopStreaming() {
        if (!isStreaming && recordingThread == null) return
        isStopping = true
        isStreaming = false
        try {
            audioRecord?.stop()
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping audioRecord: ${e.message}")
        }
        try {
            recordingThread?.interrupt()
            recordingThread?.join(500L)
        } catch (e: Exception) {}
        recordingThread = null
        cleanUpAudioRecord()
    }

    private fun cleanUpAudioRecord() {
        try {
            audioRecord?.release()
        } catch (e: Exception) {}
        audioRecord = null
    }
}
