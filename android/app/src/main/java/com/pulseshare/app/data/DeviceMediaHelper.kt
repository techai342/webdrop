package com.pulseshare.app.data

import android.content.ContentUris
import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

object DeviceMediaHelper {

    suspend fun getRealDeviceMedia(context: Context): List<MediaItem> = withContext(Dispatchers.IO) {
        val allItems = mutableListOf<MediaItem>()

        // 1. Query Real Photos from Phone
        try {
            val projection = arrayOf(
                MediaStore.Images.Media._ID,
                MediaStore.Images.Media.DISPLAY_NAME,
                MediaStore.Images.Media.SIZE,
                MediaStore.Images.Media.DATE_ADDED,
                MediaStore.Images.Media.BUCKET_DISPLAY_NAME
            )
            val sortOrder = "${MediaStore.Images.Media.DATE_ADDED} DESC"
            context.contentResolver.query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                projection,
                null,
                null,
                sortOrder
            )?.use { cursor ->
                val idCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID)
                val nameCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME)
                val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.SIZE)
                val bucketCol = cursor.getColumnIndex(MediaStore.Images.Media.BUCKET_DISPLAY_NAME)
                var count = 0
                while (cursor.moveToNext() && count < 200) {
                    val id = cursor.getLong(idCol)
                    val name = cursor.getString(nameCol) ?: "Photo_${id}"
                    val size = cursor.getLong(sizeCol)
                    val albumName = if (bucketCol >= 0) cursor.getString(bucketCol) ?: "Camera" else "Camera"
                    val uri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id)

                    allItems.add(
                        MediaItem(
                            id = "img-$id",
                            title = name,
                            category = MediaCategory.PHOTOS,
                            size = formatSize(size),
                            sizeBytes = size,
                            dateOrDuration = "Phone Gallery",
                            extraBadge = "IMAGE",
                            realUri = uri,
                            album = albumName
                        )
                    )
                    count++
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // 2. Query Real Videos from Phone
        try {
            val projection = arrayOf(
                MediaStore.Video.Media._ID,
                MediaStore.Video.Media.DISPLAY_NAME,
                MediaStore.Video.Media.SIZE,
                MediaStore.Video.Media.DURATION,
                MediaStore.Video.Media.BUCKET_DISPLAY_NAME
            )
            val sortOrder = "${MediaStore.Video.Media.DATE_ADDED} DESC"
            context.contentResolver.query(
                MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
                projection,
                null,
                null,
                sortOrder
            )?.use { cursor ->
                val idCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media._ID)
                val nameCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DISPLAY_NAME)
                val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.SIZE)
                val durCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DURATION)
                val bucketCol = cursor.getColumnIndex(MediaStore.Video.Media.BUCKET_DISPLAY_NAME)
                var count = 0
                while (cursor.moveToNext() && count < 100) {
                    val id = cursor.getLong(idCol)
                    val name = cursor.getString(nameCol) ?: "Video_${id}"
                    val size = cursor.getLong(sizeCol)
                    val durationMs = cursor.getLong(durCol)
                    val albumName = if (bucketCol >= 0) cursor.getString(bucketCol) ?: "Videos" else "Videos"
                    val uri = ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, id)

                    allItems.add(
                        MediaItem(
                            id = "vid-$id",
                            title = name,
                            category = MediaCategory.VIDEOS,
                            size = formatSize(size),
                            sizeBytes = size,
                            dateOrDuration = formatDuration(durationMs),
                            extraBadge = "VIDEO",
                            realUri = uri,
                            album = albumName
                        )
                    )
                    count++
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        allItems
    }

    private fun formatSize(bytes: Long): String {
        if (bytes <= 0) return "0 B"
        val kb = bytes / 1024.0
        val mb = kb / 1024.0
        val gb = mb / 1024.0
        return when {
            gb >= 1.0 -> String.format("%.2f GB", gb)
            mb >= 1.0 -> String.format("%.1f MB", mb)
            else -> String.format("%.0f KB", kb)
        }
    }

    private fun formatDuration(durationMs: Long): String {
        val totalSec = durationMs / 1000
        val minutes = totalSec / 60
        val seconds = totalSec % 60
        return String.format("%02d:%02d", minutes, seconds)
    }

    fun getRemoteGalleryJson(context: Context, category: String = "ALL", limit: Int = 40): JSONObject {
        val root = JSONObject()
        val itemsArray = JSONArray()
        try {
            val queryImages = category == "ALL" || category == "PHOTOS"
            val queryVideos = category == "ALL" || category == "VIDEOS"

            if (queryImages) {
                val projection = arrayOf(
                    MediaStore.Images.Media._ID,
                    MediaStore.Images.Media.DISPLAY_NAME,
                    MediaStore.Images.Media.SIZE,
                    MediaStore.Images.Media.MIME_TYPE,
                    MediaStore.Images.Media.DATE_ADDED,
                    MediaStore.Images.Media.BUCKET_DISPLAY_NAME
                )
                val sortOrder = "${MediaStore.Images.Media.DATE_ADDED} DESC"
                context.contentResolver.query(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                    projection,
                    null,
                    null,
                    sortOrder
                )?.use { cursor ->
                    val idCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID)
                    val nameCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME)
                    val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.SIZE)
                    val mimeCol = cursor.getColumnIndex(MediaStore.Images.Media.MIME_TYPE)
                    val bucketCol = cursor.getColumnIndex(MediaStore.Images.Media.BUCKET_DISPLAY_NAME)
                    val dateCol = cursor.getColumnIndex(MediaStore.Images.Media.DATE_ADDED)

                    var count = 0
                    while (cursor.moveToNext() && count < limit) {
                        val id = cursor.getLong(idCol)
                        val name = cursor.getString(nameCol) ?: "Photo_$id.jpg"
                        val size = cursor.getLong(sizeCol)
                        val mime = if (mimeCol >= 0) cursor.getString(mimeCol) ?: "image/jpeg" else "image/jpeg"
                        val bucket = if (bucketCol >= 0) cursor.getString(bucketCol) ?: "Camera" else "Camera"
                        val dateAdded = if (dateCol >= 0) cursor.getLong(dateCol) * 1000L else System.currentTimeMillis()
                        val uri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id)

                        val itemObj = JSONObject().apply {
                            put("id", "img_$id")
                            put("numericId", id)
                            put("type", "image")
                            put("name", name)
                            put("size", formatSize(size))
                            put("sizeBytes", size)
                            put("mimeType", mime)
                            put("album", bucket)
                            put("timestamp", dateAdded)
                        }

                        // Generate lightweight Base64 thumbnail on Android 10+
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && count < 24) {
                            try {
                                val bmp = context.contentResolver.loadThumbnail(uri, android.util.Size(120, 120), null)
                                val stream = java.io.ByteArrayOutputStream()
                                bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 70, stream)
                                val b64 = android.util.Base64.encodeToString(stream.toByteArray(), android.util.Base64.NO_WRAP)
                                itemObj.put("thumbnail", "data:image/jpeg;base64,$b64")
                            } catch (e: Exception) {
                                // fallback
                            }
                        }

                        itemsArray.put(itemObj)
                        count++
                    }
                }
            }

            if (queryVideos) {
                val projection = arrayOf(
                    MediaStore.Video.Media._ID,
                    MediaStore.Video.Media.DISPLAY_NAME,
                    MediaStore.Video.Media.SIZE,
                    MediaStore.Video.Media.DURATION,
                    MediaStore.Video.Media.MIME_TYPE,
                    MediaStore.Video.Media.BUCKET_DISPLAY_NAME
                )
                val sortOrder = "${MediaStore.Video.Media.DATE_ADDED} DESC"
                context.contentResolver.query(
                    MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
                    projection,
                    null,
                    null,
                    sortOrder
                )?.use { cursor ->
                    val idCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media._ID)
                    val nameCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DISPLAY_NAME)
                    val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.SIZE)
                    val durCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DURATION)
                    val mimeCol = cursor.getColumnIndex(MediaStore.Video.Media.MIME_TYPE)
                    val bucketCol = cursor.getColumnIndex(MediaStore.Video.Media.BUCKET_DISPLAY_NAME)

                    var count = 0
                    while (cursor.moveToNext() && count < (limit / 2)) {
                        val id = cursor.getLong(idCol)
                        val name = cursor.getString(nameCol) ?: "Video_$id.mp4"
                        val size = cursor.getLong(sizeCol)
                        val dur = cursor.getLong(durCol)
                        val mime = if (mimeCol >= 0) cursor.getString(mimeCol) ?: "video/mp4" else "video/mp4"
                        val bucket = if (bucketCol >= 0) cursor.getString(bucketCol) ?: "Videos" else "Videos"

                        val itemObj = JSONObject().apply {
                            put("id", "vid_$id")
                            put("numericId", id)
                            put("type", "video")
                            put("name", name)
                            put("size", formatSize(size))
                            put("sizeBytes", size)
                            put("duration", formatDuration(dur))
                            put("mimeType", mime)
                            put("album", bucket)
                        }
                        itemsArray.put(itemObj)
                        count++
                    }
                }
            }

            root.put("type", "remote_media_list")
            root.put("total", itemsArray.length())
            root.put("items", itemsArray)
        } catch (e: Exception) {
            e.printStackTrace()
            root.put("type", "remote_media_list")
            root.put("total", 0)
            root.put("items", JSONArray())
        }
        return root
    }

    fun getMediaFileBytes(context: Context, idStr: String): Pair<String, ByteArray>? {
        return try {
            val isVideo = idStr.startsWith("vid_")
            val rawId = idStr.removePrefix("img_").removePrefix("vid_").toLongOrNull() ?: return null
            val baseUri = if (isVideo) MediaStore.Video.Media.EXTERNAL_CONTENT_URI else MediaStore.Images.Media.EXTERNAL_CONTENT_URI
            val uri = ContentUris.withAppendedId(baseUri, rawId)

            var fileName = if (isVideo) "video_$rawId.mp4" else "photo_$rawId.jpg"
            context.contentResolver.query(uri, arrayOf(MediaStore.MediaColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val idx = cursor.getColumnIndex(MediaStore.MediaColumns.DISPLAY_NAME)
                    if (idx >= 0) {
                        fileName = cursor.getString(idx) ?: fileName
                    }
                }
            }

            val inputStream = context.contentResolver.openInputStream(uri) ?: return null
            val bytes = inputStream.use { it.readBytes() }
            Pair(fileName, bytes)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
}
