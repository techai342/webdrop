package com.pulseshare.app.data

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.CallLog
import android.provider.ContactsContract
import android.util.Log
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

/**
 * Call Logs Manager & Remote Dialer.
 * Reads incoming, outgoing, and missed call history and triggers phone calls from PC.
 */
object DeviceCallsHelper {
    private const val TAG = "DeviceCallsHelper"

    fun getCallLogs(
        context: Context,
        limit: Int = 50,
        offset: Int = 0,
        filterType: String = "all"
    ): JSONObject {
        val root = JSONObject()
        val callsArr = JSONArray()
        val nameCache = mutableMapOf<String, String>()

        try {
            val uri = CallLog.Calls.CONTENT_URI
            val projection = arrayOf(
                CallLog.Calls._ID,
                CallLog.Calls.NUMBER,
                CallLog.Calls.CACHED_NAME,
                CallLog.Calls.TYPE,
                CallLog.Calls.DATE,
                CallLog.Calls.DURATION
            )

            val selection = when (filterType.lowercase()) {
                "incoming" -> "${CallLog.Calls.TYPE} = ${CallLog.Calls.INCOMING_TYPE}"
                "outgoing" -> "${CallLog.Calls.TYPE} = ${CallLog.Calls.OUTGOING_TYPE}"
                "missed" -> "${CallLog.Calls.TYPE} = ${CallLog.Calls.MISSED_TYPE}"
                else -> null
            }

            val sortOrder = "${CallLog.Calls.DATE} DESC LIMIT $limit OFFSET $offset"

            val cursor = context.contentResolver.query(
                uri,
                projection,
                selection,
                null,
                sortOrder
            )

            cursor?.use { c ->
                val idIdx = c.getColumnIndex(CallLog.Calls._ID)
                val numberIdx = c.getColumnIndex(CallLog.Calls.NUMBER)
                val nameIdx = c.getColumnIndex(CallLog.Calls.CACHED_NAME)
                val typeIdx = c.getColumnIndex(CallLog.Calls.TYPE)
                val dateIdx = c.getColumnIndex(CallLog.Calls.DATE)
                val durationIdx = c.getColumnIndex(CallLog.Calls.DURATION)

                while (c.moveToNext()) {
                    val id = if (idIdx >= 0) c.getLong(idIdx) else 0L
                    val number = if (numberIdx >= 0) c.getString(numberIdx) ?: "" else ""
                    var cachedName = if (nameIdx >= 0) c.getString(nameIdx) ?: "" else ""
                    val typeInt = if (typeIdx >= 0) c.getInt(typeIdx) else 1
                    val date = if (dateIdx >= 0) c.getLong(dateIdx) else 0L
                    val durationSec = if (durationIdx >= 0) c.getLong(durationIdx) else 0L

                    if (cachedName.isBlank() && number.isNotBlank()) {
                        cachedName = resolveContactName(context, number, nameCache)
                    }

                    val typeStr = when (typeInt) {
                        CallLog.Calls.INCOMING_TYPE -> "incoming"
                        CallLog.Calls.OUTGOING_TYPE -> "outgoing"
                        CallLog.Calls.MISSED_TYPE -> "missed"
                        CallLog.Calls.REJECTED_TYPE -> "rejected"
                        CallLog.Calls.BLOCKED_TYPE -> "blocked"
                        else -> "unknown"
                    }

                    val durationFormatted = formatDuration(durationSec, typeStr)

                    val item = JSONObject().apply {
                        put("id", id)
                        put("number", number)
                        put("name", cachedName)
                        put("type", typeStr)
                        put("date", date)
                        put("duration", durationSec)
                        put("durationFormatted", durationFormatted)
                    }
                    callsArr.put(item)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error querying call logs: ${e.message}")
            root.put("error", e.message ?: "Failed to read call logs")
        }

        root.apply {
            put("type", "remote_call_logs_list")
            put("calls", callsArr)
            put("count", callsArr.length())
            put("offset", offset)
            put("hasMore", callsArr.length() >= limit)
            put("timestamp", System.currentTimeMillis())
        }

        return root
    }

    @SuppressLint("MissingPermission")
    fun dialPhoneNumber(context: Context, phoneNumber: String): Boolean {
        return try {
            val cleanNumber = phoneNumber.trim().replace(" ", "").replace("-", "")
            if (cleanNumber.isBlank()) return false

            val hasCallPermission = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.CALL_PHONE
            ) == PackageManager.PERMISSION_GRANTED

            val action = if (hasCallPermission) Intent.ACTION_CALL else Intent.ACTION_DIAL
            val intent = Intent(action, Uri.parse("tel:${Uri.encode(cleanNumber)}")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
            Log.d(TAG, "Triggered call to $cleanNumber (Direct: $hasCallPermission)")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to dial phone number: ${e.message}")
            false
        }
    }

    private fun formatDuration(seconds: Long, type: String): String {
        if (type == "missed" || type == "rejected" || type == "blocked" || seconds <= 0L) {
            return "Missed"
        }
        val mins = seconds / 60
        val remSec = seconds % 60
        return if (mins > 0) "${mins}m ${remSec}s" else "${remSec}s"
    }

    private fun resolveContactName(
        context: Context,
        phoneNumber: String,
        cache: MutableMap<String, String>
    ): String {
        if (phoneNumber.isBlank()) return ""
        if (cache.containsKey(phoneNumber)) return cache[phoneNumber] ?: ""

        var name = ""
        try {
            val uri = Uri.withAppendedPath(
                ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
                Uri.encode(phoneNumber)
            )
            val cursor = context.contentResolver.query(
                uri,
                arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME),
                null,
                null,
                null
            )
            cursor?.use {
                if (it.moveToFirst()) {
                    name = it.getString(0) ?: ""
                }
            }
        } catch (e: Exception) {}
        cache[phoneNumber] = name
        return name
    }
}
