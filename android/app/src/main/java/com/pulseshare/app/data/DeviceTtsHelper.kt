package com.pulseshare.app.data

import android.content.Context
import android.media.AudioManager
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.util.Log
import java.util.Locale

/**
 * Text-To-Speech (TTS) Engine for PulseShare.
 * Allows remote text spoken aloud through phone speaker with custom pitch,
 * speech rate, and language support.
 */
object DeviceTtsHelper {
    private const val TAG = "DeviceTtsHelper"

    @Volatile
    private var tts: TextToSpeech? = null
    @Volatile
    private var isInitialized = false
    private val pendingQueue = mutableListOf<Triple<String, Float, Float>>()

    fun init(context: Context, onReady: (() -> Unit)? = null) {
        if (tts != null && isInitialized) {
            onReady?.invoke()
            return
        }

        try {
            val appContext = context.applicationContext
            tts = TextToSpeech(appContext) { status ->
                if (status == TextToSpeech.SUCCESS) {
                    isInitialized = true
                    try {
                        tts?.language = Locale.getDefault()
                    } catch (e: Exception) {
                        tts?.language = Locale.US
                    }
                    Log.d(TAG, "TextToSpeech engine initialized successfully")

                    // Drain pending speaks if any
                    synchronized(pendingQueue) {
                        for ((text, pitch, rate) in pendingQueue) {
                            speakInternal(text, pitch, rate, null)
                        }
                        pendingQueue.clear()
                    }
                    onReady?.invoke()
                } else {
                    Log.e(TAG, "TextToSpeech initialization failed with status: $status")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error initializing TextToSpeech: ${e.message}")
        }
    }

    fun speak(
        context: Context,
        text: String,
        pitch: Float = 1.0f,
        speechRate: Float = 1.0f,
        language: String? = null
    ): Boolean {
        if (text.isBlank()) return false

        if (tts == null || !isInitialized) {
            synchronized(pendingQueue) {
                pendingQueue.add(Triple(text, pitch, speechRate))
            }
            init(context)
            return true
        }

        return speakInternal(text, pitch, speechRate, language)
    }

    private fun speakInternal(
        text: String,
        pitch: Float,
        speechRate: Float,
        language: String?
    ): Boolean {
        return try {
            val engine = tts ?: return false

            // Set language if specified
            if (!language.isNullOrBlank()) {
                val locale = when (language.lowercase()) {
                    "ur", "urdu" -> Locale("ur", "PK")
                    "hi", "hindi" -> Locale("hi", "IN")
                    "ar", "arabic" -> Locale("ar")
                    "es", "spanish" -> Locale("es", "ES")
                    "fr", "french" -> Locale.FRENCH
                    "de", "german" -> Locale.GERMAN
                    "en", "english", "en_us" -> Locale.US
                    "en_gb" -> Locale.UK
                    else -> Locale(language)
                }
                val langResult = engine.setLanguage(locale)
                if (langResult == TextToSpeech.LANG_MISSING_DATA || langResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                    engine.language = Locale.getDefault()
                }
            }

            engine.setPitch(pitch.coerceIn(0.5f, 2.0f))
            engine.setSpeechRate(speechRate.coerceIn(0.5f, 2.0f))

            val utteranceId = "pulseshare_tts_${System.currentTimeMillis()}"
            val params = Bundle().apply {
                putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f)
                putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_MUSIC)
            }

            val result = engine.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId)
            Log.d(TAG, "Queued speak for '$text', result code: $result")
            result == TextToSpeech.SUCCESS
        } catch (e: Exception) {
            Log.e(TAG, "Error speaking text: ${e.message}")
            false
        }
    }

    fun stop() {
        try {
            tts?.stop()
            Log.d(TAG, "Stopped TTS playback")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping TTS: ${e.message}")
        }
    }

    fun shutdown() {
        try {
            tts?.stop()
            tts?.shutdown()
            tts = null
            isInitialized = false
        } catch (e: Exception) {
            Log.e(TAG, "Error shutting down TTS: ${e.message}")
        }
    }
}
