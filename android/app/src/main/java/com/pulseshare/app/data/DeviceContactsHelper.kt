package com.pulseshare.app.data

import android.content.ContentUris
import android.content.Context
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.provider.ContactsContract
import android.util.Log
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

object DeviceContactsHelper {
    private const val TAG = "DeviceContactsHelper"

    fun hasContactsPermission(context: Context): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.READ_CONTACTS
        ) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Reads device contacts progressively (e.g. 20-30 per batch) with total count,
     * favorites count, multiple phone numbers, and emails.
     */
    fun getDeviceContacts(
        context: Context,
        searchQuery: String = "",
        onlyFavorites: Boolean = false,
        limit: Int = 30,
        offset: Int = 0
    ): JSONObject {
        val root = JSONObject().apply {
            put("type", "remote_contacts_list")
        }

        if (!hasContactsPermission(context)) {
            root.put("hasPermission", false)
            root.put("error", "permission_denied")
            root.put("message", "Contacts permission not granted. Please allow Contacts permission in PulseShare on your phone.")
            root.put("contacts", JSONArray())
            root.put("total", 0)
            root.put("favoritesCount", 0)
            root.put("offset", offset)
            root.put("limit", limit)
            root.put("hasMore", false)
            return root
        }

        root.put("hasPermission", true)

        try {
            // 1. Ultra-fast total contacts & starred count query
            var totalPhoneContacts = 0
            var totalStarredContacts = 0
            try {
                val countProj = arrayOf(
                    ContactsContract.Contacts._ID,
                    ContactsContract.Contacts.STARRED
                )
                val countSelection = "${ContactsContract.Contacts.HAS_PHONE_NUMBER} > 0"
                context.contentResolver.query(
                    ContactsContract.Contacts.CONTENT_URI,
                    countProj,
                    countSelection,
                    null,
                    null
                )?.use { cursor ->
                    totalPhoneContacts = cursor.count
                    val starredCol = cursor.getColumnIndex(ContactsContract.Contacts.STARRED)
                    while (cursor.moveToNext()) {
                        if (starredCol >= 0 && cursor.getInt(starredCol) == 1) {
                            totalStarredContacts++
                        }
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Count query error: ${e.message}")
            }

            // 2. Query Phone Numbers & Contact Details with pagination
            val phoneProjection = arrayOf(
                ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                ContactsContract.CommonDataKinds.Phone.NUMBER,
                ContactsContract.CommonDataKinds.Phone.STARRED,
                ContactsContract.CommonDataKinds.Phone.PHOTO_URI
            )

            val sortOrder = "${ContactsContract.CommonDataKinds.Phone.STARRED} DESC, ${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} COLLATE NOCASE ASC"

            val selectionList = mutableListOf<String>()
            val selectionArgsList = mutableListOf<String>()

            if (searchQuery.isNotBlank()) {
                selectionList.add("(${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} LIKE ? OR ${ContactsContract.CommonDataKinds.Phone.NUMBER} LIKE ?)")
                val likeQuery = "%$searchQuery%"
                selectionArgsList.add(likeQuery)
                selectionArgsList.add(likeQuery)
            }

            if (onlyFavorites) {
                selectionList.add("${ContactsContract.CommonDataKinds.Phone.STARRED} = 1")
            }

            val selection = if (selectionList.isEmpty()) null else selectionList.joinToString(" AND ")
            val selectionArgs = if (selectionArgsList.isEmpty()) null else selectionArgsList.toTypedArray()

            val skippedContactIds = mutableSetOf<String>()
            val contactsMap = LinkedHashMap<String, ContactBuilder>()
            var hasMore = false

            context.contentResolver.query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                phoneProjection,
                selection,
                selectionArgs,
                sortOrder
            )?.use { cursor ->
                val idCol = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.CONTACT_ID)
                val nameCol = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
                val numberCol = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                val starredCol = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.STARRED)
                val photoCol = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.PHOTO_URI)

                while (cursor.moveToNext()) {
                    val contactId = if (idCol >= 0) cursor.getString(idCol) ?: "" else ""
                    if (contactId.isBlank()) continue

                    val number = if (numberCol >= 0) cursor.getString(numberCol) ?: "" else ""
                    val cleanNumber = number.trim()
                    if (cleanNumber.isBlank()) continue

                    // If this contact was already skipped
                    if (skippedContactIds.contains(contactId)) {
                        continue
                    }

                    // If we haven't reached the requested offset yet:
                    if (skippedContactIds.size < offset && !contactsMap.containsKey(contactId)) {
                        skippedContactIds.add(contactId)
                        continue
                    }

                    // If we have collected limit contacts and encounter a new contactId:
                    if (contactsMap.size >= limit && !contactsMap.containsKey(contactId)) {
                        hasMore = true
                        break
                    }

                    val name = if (nameCol >= 0) cursor.getString(nameCol) ?: "Unknown" else "Unknown"
                    val isStarred = if (starredCol >= 0) cursor.getInt(starredCol) == 1 else false
                    val photoUri = if (photoCol >= 0) cursor.getString(photoCol) else null

                    val existing = contactsMap[contactId]
                    if (existing == null) {
                        val builder = ContactBuilder(
                            id = contactId,
                            name = name,
                            primaryPhone = cleanNumber,
                            isStarred = isStarred,
                            photoUri = photoUri,
                            email = null
                        )
                        builder.phones.add(cleanNumber)
                        contactsMap[contactId] = builder
                    } else {
                        if (!existing.phones.contains(cleanNumber)) {
                            existing.phones.add(cleanNumber)
                        }
                    }
                }
            }

            // 3. Query emails ONLY for the loaded batch (0ms overhead)
            if (contactsMap.isNotEmpty()) {
                try {
                    val ids = contactsMap.keys.toList()
                    val placeholders = ids.joinToString(",") { "?" }
                    context.contentResolver.query(
                        ContactsContract.CommonDataKinds.Email.CONTENT_URI,
                        arrayOf(ContactsContract.CommonDataKinds.Email.CONTACT_ID, ContactsContract.CommonDataKinds.Email.ADDRESS),
                        "${ContactsContract.CommonDataKinds.Email.CONTACT_ID} IN ($placeholders)",
                        ids.toTypedArray(),
                        null
                    )?.use { emailCursor ->
                        val cIdCol = emailCursor.getColumnIndex(ContactsContract.CommonDataKinds.Email.CONTACT_ID)
                        val emailCol = emailCursor.getColumnIndex(ContactsContract.CommonDataKinds.Email.ADDRESS)
                        while (emailCursor.moveToNext()) {
                            val cid = if (cIdCol >= 0) emailCursor.getString(cIdCol) else null
                            val email = if (emailCol >= 0) emailCursor.getString(emailCol) else null
                            if (!cid.isNullOrBlank() && !email.isNullOrBlank()) {
                                val builder = contactsMap[cid]
                                if (builder != null && builder.email == null) {
                                    builder.email = email
                                }
                            }
                        }
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Email batch query error: ${e.message}")
                }
            }

            val contactsArray = JSONArray()
            for ((_, builder) in contactsMap) {
                val cObj = JSONObject().apply {
                    put("id", builder.id)
                    put("name", builder.name)
                    put("phone", builder.primaryPhone)
                    val phonesArr = JSONArray()
                    for (p in builder.phones) {
                        phonesArr.put(p)
                    }
                    put("allPhones", phonesArr)
                    put("isStarred", builder.isStarred)
                    if (!builder.email.isNullOrBlank()) {
                        put("email", builder.email)
                    }
                    if (!builder.photoUri.isNullOrBlank()) {
                        put("photoUri", builder.photoUri)
                    }
                }
                contactsArray.put(cObj)
            }

            val totalCount = if (onlyFavorites) {
                totalStarredContacts
            } else if (searchQuery.isNotBlank()) {
                contactsArray.length()
            } else {
                totalPhoneContacts
            }

            root.put("contacts", contactsArray)
            root.put("total", totalCount)
            root.put("favoritesCount", totalStarredContacts)
            root.put("offset", offset)
            root.put("limit", limit)
            root.put("hasMore", hasMore || (offset + contactsMap.size < totalCount))

        } catch (e: Exception) {
            Log.e(TAG, "getDeviceContacts error: ${e.message}", e)
            root.put("error", e.message ?: "Failed to read contacts")
            root.put("contacts", JSONArray())
            root.put("total", 0)
            root.put("favoritesCount", 0)
            root.put("offset", offset)
            root.put("limit", limit)
            root.put("hasMore", false)
        }

        return root
    }

    private data class ContactBuilder(
        val id: String,
        val name: String,
        val primaryPhone: String,
        val isStarred: Boolean,
        val photoUri: String?,
        var email: String? = null,
        val phones: MutableList<String> = mutableListOf()
    )
}
