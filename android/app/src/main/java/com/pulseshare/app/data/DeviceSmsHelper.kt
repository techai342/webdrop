package com.pulseshare.app.data

import android.content.Context
import android.net.Uri
import android.os.Build
import android.provider.ContactsContract
import android.telephony.SmsManager
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

/**
 * High-performance SMS Manager & Smart OTP Extractor.
 * Reads phone SMS inbox/sent messages, resolves contact names, and auto-detects 2FA OTP codes.
 */
object DeviceSmsHelper {
    private const val TAG = "DeviceSmsHelper"

    fun getSmsMessages(
        context: Context,
        limit: Int = 60,
        offset: Int = 0,
        searchQuery: String = ""
    ): JSONObject {
        val root = JSONObject()
        val messagesArr = JSONArray()
        val contactNameCache = mutableMapOf<String, String>()

        try {
            val uri = Uri.parse("content://sms")
            val projection = arrayOf("_id", "address", "body", "date", "read", "type")

            val selection = if (searchQuery.isNotBlank()) {
                "body LIKE ? OR address LIKE ?"
            } else null

            val selectionArgs = if (searchQuery.isNotBlank()) {
                arrayOf("%$searchQuery%", "%$searchQuery%")
            } else null

            val sortOrder = "date DESC LIMIT $limit OFFSET $offset"

            val cursor = context.contentResolver.query(
                uri,
                projection,
                selection,
                selectionArgs,
                sortOrder
            )

            cursor?.use { c ->
                val idIdx = c.getColumnIndex("_id")
                val addressIdx = c.getColumnIndex("address")
                val bodyIdx = c.getColumnIndex("body")
                val dateIdx = c.getColumnIndex("date")
                val readIdx = c.getColumnIndex("read")
                val typeIdx = c.getColumnIndex("type")

                while (c.moveToNext()) {
                    val id = if (idIdx >= 0) c.getLong(idIdx) else 0L
                    val address = if (addressIdx >= 0) c.getString(addressIdx) ?: "" else ""
                    val body = if (bodyIdx >= 0) c.getString(bodyIdx) ?: "" else ""
                    val date = if (dateIdx >= 0) c.getLong(dateIdx) else 0L
                    val read = if (readIdx >= 0) c.getInt(readIdx) == 1 else true
                    val type = if (typeIdx >= 0) c.getInt(typeIdx) else 1 // 1=inbox, 2=sent

                    val contactName = resolveContactName(context, address, contactNameCache)
                    val otpCode = extractOtp(body)

                    val item = JSONObject().apply {
                        put("id", id)
                        put("address", address)
                        put("contactName", contactName)
                        put("body", body)
                        put("date", date)
                        put("read", read)
                        put("isInbox", type == 1)
                        if (otpCode != null) {
                            put("otpCode", otpCode)
                        }
                    }
                    messagesArr.put(item)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error querying SMS messages: ${e.message}")
            root.put("error", e.message ?: "Failed to read SMS messages")
        }

        root.apply {
            put("type", "remote_sms_list")
            put("messages", messagesArr)
            put("count", messagesArr.length())
            put("offset", offset)
            put("hasMore", messagesArr.length() >= limit)
            put("timestamp", System.currentTimeMillis())
        }

        return root
    }

    fun sendSms(context: Context, destinationAddress: String, text: String): Boolean {
        return try {
            val cleanNumber = destinationAddress.trim()
            val cleanText = text.trim()
            if (cleanNumber.isBlank() || cleanText.isBlank()) return false

            val smsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                context.getSystemService(SmsManager::class.java)
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getDefault()
            }

            if (cleanText.length > 160) {
                val parts = smsManager.divideMessage(cleanText)
                smsManager.sendMultipartTextMessage(cleanNumber, null, parts, null, null)
            } else {
                smsManager.sendTextMessage(cleanNumber, null, cleanText, null, null)
            }
            Log.d(TAG, "SMS sent successfully to $cleanNumber")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send SMS: ${e.message}")
            false
        }
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
        } catch (e: Exception) {
            // Ignore phone lookup failures for short codes
        }
        cache[phoneNumber] = name
        return name
    }

    fun extractOtp(body: String): String? {
        if (body.isBlank()) return null
        val lower = body.lowercase()

        val hasKeyword = lower.contains("code") || lower.contains("otp") ||
                lower.contains("verification") || lower.contains("pin") ||
                lower.contains("password") || lower.contains("is your") ||
                lower.contains("verify") || lower.contains("login") ||
                lower.contains("secure") || lower.contains("bank") ||
                lower.contains("auth")

        if (!hasKeyword) return null

        // Priority 1: Match after keywords like "code is 123456" or "OTP: 123456"
        val keywordPattern = Regex(
            "(?:code|otp|pin|verification|password|is)\\s*(?:is|:|#)?\\s*([0-9]{4,8})\\b",
            RegexOption.IGNORE_CASE
        )
        val keywordMatch = keywordPattern.find(body)
        if (keywordMatch != null && keywordMatch.groupValues.size > 1) {
            val candidate = keywordMatch.groupValues[1]
            if (candidate.isNotBlank()) return candidate
        }

        // Priority 2: Standalone 4 to 8 digit number
        val generalPattern = Regex("\\b([0-9]{4,8})\\b")
        val generalMatches = generalPattern.findAll(body).toList()
        for (m in generalMatches) {
            val candidate = m.groupValues[1]
            // Skip 4-digit years like 2024, 2025, 2026
            if (candidate.length == 4 && (candidate.startsWith("19") || candidate.startsWith("20"))) {
                continue
            }
            return candidate
        }

        return null
    }
}
