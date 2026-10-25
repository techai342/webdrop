package com.pulseshare.app.data

import android.content.Context
import android.media.AudioManager
import android.os.Build
import android.util.Log
import org.json.JSONObject

/**
 * Helper to manage phone volume, mute states, and audio streams remotely.
 * Triggers native on-screen volume HUD (FLAG_SHOW_UI) on phone so user sees changes live.
 */
object DeviceVolumeHelper {
    private const val TAG = "DeviceVolumeHelper"

    fun getVolumeState(context: Context): JSONObject {
        val root = JSONObject()
        try {
            val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return root

            // 1. Media Stream (Music / Videos / Games / YouTube)
            val mediaMax = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            val mediaCurrent = am.getStreamVolume(AudioManager.STREAM_MUSIC)
            val isMediaMuted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.isStreamMute(AudioManager.STREAM_MUSIC)
            } else {
                mediaCurrent == 0
            }
            val mediaPercent = if (mediaMax > 0) ((mediaCurrent * 100) / mediaMax) else 0

            // 2. Ring Stream (Phone Calls / Ringtone)
            val ringMax = am.getStreamMaxVolume(AudioManager.STREAM_RING)
            val ringCurrent = am.getStreamVolume(AudioManager.STREAM_RING)
            val isRingMuted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.isStreamMute(AudioManager.STREAM_RING)
            } else {
                ringCurrent == 0
            }
            val ringPercent = if (ringMax > 0) ((ringCurrent * 100) / ringMax) else 0

            // 3. Notification Stream
            val notifMax = am.getStreamMaxVolume(AudioManager.STREAM_NOTIFICATION)
            val notifCurrent = am.getStreamVolume(AudioManager.STREAM_NOTIFICATION)
            val notifPercent = if (notifMax > 0) ((notifCurrent * 100) / notifMax) else 0

            // 4. Alarm Stream
            val alarmMax = am.getStreamMaxVolume(AudioManager.STREAM_ALARM)
            val alarmCurrent = am.getStreamVolume(AudioManager.STREAM_ALARM)
            val alarmPercent = if (alarmMax > 0) ((alarmCurrent * 100) / alarmMax) else 0

            // 5. Ringer Mode
            val ringerModeStr = when (am.ringerMode) {
                AudioManager.RINGER_MODE_SILENT -> "silent"
                AudioManager.RINGER_MODE_VIBRATE -> "vibrate"
                else -> "normal"
            }

            root.apply {
                put("type", "phone_volume_state")
                put("mediaVolume", mediaCurrent)
                put("mediaMaxVolume", mediaMax)
                put("mediaPercent", mediaPercent)
                put("isMediaMuted", isMediaMuted)

                put("ringVolume", ringCurrent)
                put("ringMaxVolume", ringMax)
                put("ringPercent", ringPercent)
                put("isRingMuted", isRingMuted)

                put("notifVolume", notifCurrent)
                put("notifMaxVolume", notifMax)
                put("notifPercent", notifPercent)

                put("alarmVolume", alarmCurrent)
                put("alarmMaxVolume", alarmMax)
                put("alarmPercent", alarmPercent)

                put("ringerMode", ringerModeStr)
                put("timestamp", System.currentTimeMillis())
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error getting volume state: ${e.message}")
        }
        return root
    }

    fun adjustVolume(
        context: Context,
        stream: String = "music",
        action: String = "toggle_mute",
        value: Int? = null,
        percent: Int? = null,
        showUi: Boolean = true
    ): JSONObject {
        try {
            val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return getVolumeState(context)
            val streamType = when (stream.lowercase()) {
                "ring", "ringtone", "call" -> AudioManager.STREAM_RING
                "notif", "notification" -> AudioManager.STREAM_NOTIFICATION
                "alarm" -> AudioManager.STREAM_ALARM
                else -> AudioManager.STREAM_MUSIC
            }

            val flags = if (showUi) AudioManager.FLAG_SHOW_UI else 0
            val maxVol = am.getStreamMaxVolume(streamType)

            when (action.lowercase()) {
                "up", "raise", "vol_up", "volume_up" -> {
                    am.adjustStreamVolume(streamType, AudioManager.ADJUST_RAISE, flags)
                    Log.d(TAG, "Volume raised for stream $streamType")
                }

                "down", "lower", "vol_down", "volume_down" -> {
                    am.adjustStreamVolume(streamType, AudioManager.ADJUST_LOWER, flags)
                    Log.d(TAG, "Volume lowered for stream $streamType")
                }

                "mute" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        am.adjustStreamVolume(streamType, AudioManager.ADJUST_MUTE, flags)
                    } else {
                        am.setStreamVolume(streamType, 0, flags)
                    }
                    Log.d(TAG, "Volume muted for stream $streamType")
                }

                "unmute" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        am.adjustStreamVolume(streamType, AudioManager.ADJUST_UNMUTE, flags)
                    } else {
                        val fallback = (maxVol / 2).coerceAtLeast(1)
                        am.setStreamVolume(streamType, fallback, flags)
                    }
                    Log.d(TAG, "Volume unmuted for stream $streamType")
                }

                "toggle_mute", "mute_toggle" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        am.adjustStreamVolume(streamType, AudioManager.ADJUST_TOGGLE_MUTE, flags)
                    } else {
                        val current = am.getStreamVolume(streamType)
                        if (current == 0) {
                            am.setStreamVolume(streamType, (maxVol / 2).coerceAtLeast(1), flags)
                        } else {
                            am.setStreamVolume(streamType, 0, flags)
                        }
                    }
                    Log.d(TAG, "Volume mute toggled for stream $streamType")
                }

                "set" -> {
                    if (value != null) {
                        val target = value.coerceIn(0, maxVol)
                        am.setStreamVolume(streamType, target, flags)
                        Log.d(TAG, "Volume set to $target for stream $streamType")
                    } else if (percent != null) {
                        val target = ((percent.coerceIn(0, 100) * maxVol) / 100).coerceIn(0, maxVol)
                        am.setStreamVolume(streamType, target, flags)
                        Log.d(TAG, "Volume set to $percent% ($target) for stream $streamType")
                    }
                }

                "set_percent" -> {
                    val p = percent ?: value ?: 50
                    val target = ((p.coerceIn(0, 100) * maxVol) / 100).coerceIn(0, maxVol)
                    am.setStreamVolume(streamType, target, flags)
                    Log.d(TAG, "Volume set to $p% ($target) for stream $streamType")
                }

                "set_ringer_mode" -> {
                    val mode = when (stream.lowercase()) {
                        "silent" -> AudioManager.RINGER_MODE_SILENT
                        "vibrate" -> AudioManager.RINGER_MODE_VIBRATE
                        else -> AudioManager.RINGER_MODE_NORMAL
                    }
                    try {
                        am.ringerMode = mode
                    } catch (e: Exception) {
                        Log.w(TAG, "Could not set ringer mode: ${e.message}")
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error adjusting volume: ${e.message}")
        }
        return getVolumeState(context)
    }
}
