package com.pulseshare.app.data

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object DeviceClipboardHelper {

    private const val PREFS_NAME = "pulseshare_clipboard_prefs"
    private const val KEY_HISTORY = "clip_history_json"
    private const val MAX_HISTORY_ITEMS = 60

    fun addClip(context: Context, text: String, source: String = "mobile"): JSONObject? {
        val cleanText = text.trim()
        if (cleanText.isEmpty()) return null

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val historyArray = getHistory(context)

        // Avoid adding duplicate of the very latest item
        if (historyArray.length() > 0) {
            val latest = historyArray.getJSONObject(0)
            if (latest.optString("text") == cleanText) {
                return latest
            }
        }

        val clipId = "clip_${System.currentTimeMillis()}_${(100..999).random()}"
        val clipObj = JSONObject().apply {
            put("id", clipId)
            put("text", cleanText)
            put("timestamp", System.currentTimeMillis())
            put("source", source)
            put("length", cleanText.length)
        }

        val newArray = JSONArray()
        newArray.put(clipObj)

        for (i in 0 until minOf(historyArray.length(), MAX_HISTORY_ITEMS - 1)) {
            newArray.put(historyArray.getJSONObject(i))
        }

        prefs.edit().putString(KEY_HISTORY, newArray.toString()).apply()
        return clipObj
    }

    fun getHistory(context: Context): JSONArray {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_HISTORY, null) ?: return JSONArray()
        return try {
            JSONArray(raw)
        } catch (e: Exception) {
            JSONArray()
        }
    }

    fun clearHistory(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().remove(KEY_HISTORY).apply()
    }

    fun setPrimaryClip(context: Context, text: String): Boolean {
        return try {
            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
            val clip = ClipData.newPlainText("PulseShare Sync", text)
            clipboard?.setPrimaryClip(clip)
            addClip(context, text, "pc")
            true
        } catch (e: Exception) {
            false
        }
    }
}
