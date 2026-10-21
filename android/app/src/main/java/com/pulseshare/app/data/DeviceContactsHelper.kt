package com.pulseshare.app.data

import android.content.ContentUris
import android.content.Context
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.provider.ContactsContract
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

object DeviceContactsHelper {

    fun hasContactsPermission(context: Context): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.READ_CONTACTS
        ) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Reads all device contacts with favorites / starred status, multiple phone numbers, and emails
     */
    fun getDeviceContacts(
        context: Context,
        searchQuery: String = "",
        onlyFavorites: Boolean = false,
        limit: Int = 2000
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
            return root
        }

        root.put("hasPermission", true)

        try {
            // 1. Pre-fetch Email addresses mapped by Contact ID
            val emailsMap = mutableMapOf<String, String>()
            try {
                val emailProjection = arrayOf(
                    ContactsContract.CommonDataKinds.Email.CONTACT_ID,
                    ContactsContract.CommonDataKinds.Email.ADDRESS
                )
                context.contentResolver.query(
                    ContactsContract.CommonDataKinds.Email.CONTENT_URI,
                    emailProjection,
                    null,
                    null,
                    null
                )?.use { cursor ->
                    val idCol = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Email.CONTACT_ID)
                    val emailCol = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Email.ADDRESS)
                    while (cursor.moveToNext()) {
                        if (idCol >= 0 && emailCol >= 0) {
                            val contactId = cursor.getString(idCol)
                            val email = cursor.getString(emailCol)
                            if (!contactId.isNullOrBlank() && !email.isNullOrBlank() && !emailsMap.containsKey(contactId)) {
                                emailsMap[contactId] = email
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                // Non-critical if email table fails
            }

            // 2. Query Phone Numbers & Contact Details
            val phoneProjection = arrayOf(
                ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                ContactsContract.CommonDataKinds.Phone.NUMBER,
                ContactsContract.CommonDataKinds.Phone.STARRED,
                ContactsContract.CommonDataKinds.Phone.PHOTO_URI,
                ContactsContract.CommonDataKinds.Phone.TYPE
            )

            val sortOrder = "${ContactsContract.CommonDataKinds.Phone.STARRED} DESC, ${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} COLLATE NOCASE ASC"

            var selection: String? = null
            var selectionArgs: Array<String>? = null

            if (searchQuery.isNotBlank()) {
                selection = "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} LIKE ? OR ${ContactsContract.CommonDataKinds.Phone.NUMBER} LIKE ?"
                val likeQuery = "%$searchQuery%"
                selectionArgs = arrayOf(likeQuery, likeQuery)
            }

            // LinkedHashMap to preserve STARRED DESC order while grouping numbers
            val contactsMap = LinkedHashMap<String, ContactBuilder>()
            var favoritesTotal = 0

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

                while (cursor.moveToNext() && contactsMap.size < limit) {
                    val contactId = if (idCol >= 0) cursor.getString(idCol) ?: "" else ""
                    if (contactId.isBlank()) continue

                    val name = if (nameCol >= 0) cursor.getString(nameCol) ?: "Unknown" else "Unknown"
                    val number = if (numberCol >= 0) cursor.getString(numberCol) ?: "" else ""
                    val isStarred = if (starredCol >= 0) cursor.getInt(starredCol) == 1 else false
                    val photoUri = if (photoCol >= 0) cursor.getString(photoCol) else null

                    val cleanNumber = number.trim()
                    if (cleanNumber.isBlank()) continue

                    if (isStarred) {
                        favoritesTotal++
                    }

                    if (onlyFavorites && !isStarred) {
                        continue
                    }

                    val existing = contactsMap[contactId]
                    if (existing == null) {
                        val builder = ContactBuilder(
                            id = contactId,
                            name = name,
                            primaryPhone = cleanNumber,
                            isStarred = isStarred,
                            photoUri = photoUri,
                            email = emailsMap[contactId]
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

            val contactsArray = JSONArray()
            var favCount = 0

            for ((_, builder) in contactsMap) {
                if (builder.isStarred) favCount++
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

            root.put("contacts", contactsArray)
            root.put("total", contactsArray.length())
            root.put("favoritesCount", favCount)

        } catch (e: Exception) {
            root.put("error", e.message ?: "Failed to read contacts")
            root.put("contacts", JSONArray())
            root.put("total", 0)
            root.put("favoritesCount", 0)
        }

        return root
    }

    private data class ContactBuilder(
        val id: String,
        val name: String,
        val primaryPhone: String,
        val isStarred: Boolean,
        val photoUri: String?,
        val email: String?,
        val phones: MutableList<String> = mutableListOf()
    )
}
