package com.pulseshare.app.data

import android.content.ContentUris
import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import java.io.File
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
                while (cursor.moveToNext()) {
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
                while (cursor.moveToNext()) {
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

    fun getRemoteGalleryJson(context: Context, category: String = "ALL", limit: Int = 10000, album: String = "", offset: Int = 0): JSONObject {
        val root = JSONObject()
        val itemsArray = JSONArray()
        try {
            val queryImages = category == "ALL" || category == "PHOTOS"
            val queryVideos = category == "ALL" || category == "VIDEOS"
            val hasAlbum = album.isNotBlank() && album != "ALL"

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
                val selection = if (hasAlbum) "${MediaStore.Images.Media.BUCKET_DISPLAY_NAME} = ?" else null
                val selectionArgs = if (hasAlbum) arrayOf(album) else null

                context.contentResolver.query(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                    projection,
                    selection,
                    selectionArgs,
                    sortOrder
                )?.use { cursor ->
                    val idCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID)
                    val nameCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME)
                    val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.SIZE)
                    val mimeCol = cursor.getColumnIndex(MediaStore.Images.Media.MIME_TYPE)
                    val bucketCol = cursor.getColumnIndex(MediaStore.Images.Media.BUCKET_DISPLAY_NAME)
                    val dateCol = cursor.getColumnIndex(MediaStore.Images.Media.DATE_ADDED)

                    var skipped = 0
                    var count = 0
                    while (cursor.moveToNext() && count < limit) {
                        if (skipped < offset) {
                            skipped++
                            continue
                        }

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

                        // Generate lightweight Base64 thumbnail on Android 10+ (up to 80 items)
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && count < 80) {
                            try {
                                val bmp = context.contentResolver.loadThumbnail(uri, android.util.Size(120, 120), null)
                                val stream = java.io.ByteArrayOutputStream()
                                bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 65, stream)
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
                val selection = if (hasAlbum) "${MediaStore.Video.Media.BUCKET_DISPLAY_NAME} = ?" else null
                val selectionArgs = if (hasAlbum) arrayOf(album) else null

                context.contentResolver.query(
                    MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
                    projection,
                    selection,
                    selectionArgs,
                    sortOrder
                )?.use { cursor ->
                    val idCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media._ID)
                    val nameCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DISPLAY_NAME)
                    val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.SIZE)
                    val durCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DURATION)
                    val mimeCol = cursor.getColumnIndex(MediaStore.Video.Media.MIME_TYPE)
                    val bucketCol = cursor.getColumnIndex(MediaStore.Video.Media.BUCKET_DISPLAY_NAME)

                    var count = 0
                    while (cursor.moveToNext() && count < limit) {
                        val id = cursor.getLong(idCol)
                        val name = cursor.getString(nameCol) ?: "Video_$id.mp4"
                        val size = cursor.getLong(sizeCol)
                        val dur = cursor.getLong(durCol)
                        val mime = if (mimeCol >= 0) cursor.getString(mimeCol) ?: "video/mp4" else "video/mp4"
                        val bucket = if (bucketCol >= 0) cursor.getString(bucketCol) ?: "Videos" else "Videos"
                        val uri = ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, id)

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

                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && count < 40) {
                            try {
                                val bmp = context.contentResolver.loadThumbnail(uri, android.util.Size(120, 120), null)
                                val stream = java.io.ByteArrayOutputStream()
                                bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 65, stream)
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

    private data class FolderStat(
        val name: String,
        var imageCount: Int = 0,
        var videoCount: Int = 0,
        var totalBytes: Long = 0L,
        var latestDate: Long = 0L
    )

    /**
     * Scans and aggregates all phone media into folders/albums (Ultra-fast, 100% memory safe)
     */
    fun getRemoteFoldersJson(context: Context): JSONObject {
        val root = JSONObject()
        val folderMap = mutableMapOf<String, FolderStat>()

        // 1. Scan Images for Folders
        try {
            val projection = arrayOf(
                MediaStore.Images.Media.BUCKET_DISPLAY_NAME,
                MediaStore.Images.Media.SIZE,
                MediaStore.Images.Media.DATE_ADDED
            )
            context.contentResolver.query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                projection,
                null,
                null,
                "${MediaStore.Images.Media.DATE_ADDED} DESC"
            )?.use { cursor ->
                val bucketCol = cursor.getColumnIndex(MediaStore.Images.Media.BUCKET_DISPLAY_NAME)
                val sizeCol = cursor.getColumnIndex(MediaStore.Images.Media.SIZE)
                val dateCol = cursor.getColumnIndex(MediaStore.Images.Media.DATE_ADDED)
                while (cursor.moveToNext()) {
                    val bucket = if (bucketCol >= 0) cursor.getString(bucketCol) ?: "Camera" else "Camera"
                    val size = if (sizeCol >= 0) cursor.getLong(sizeCol) else 0L
                    val date = if (dateCol >= 0) cursor.getLong(dateCol) * 1000L else 0L
                    val stat = folderMap.getOrPut(bucket) { FolderStat(bucket) }
                    stat.imageCount++
                    stat.totalBytes += size
                    if (date > stat.latestDate) stat.latestDate = date
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // 2. Scan Videos for Folders
        try {
            val projection = arrayOf(
                MediaStore.Video.Media.BUCKET_DISPLAY_NAME,
                MediaStore.Video.Media.SIZE,
                MediaStore.Video.Media.DATE_ADDED
            )
            context.contentResolver.query(
                MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
                projection,
                null,
                null,
                "${MediaStore.Video.Media.DATE_ADDED} DESC"
            )?.use { cursor ->
                val bucketCol = cursor.getColumnIndex(MediaStore.Video.Media.BUCKET_DISPLAY_NAME)
                val sizeCol = cursor.getColumnIndex(MediaStore.Video.Media.SIZE)
                val dateCol = cursor.getColumnIndex(MediaStore.Video.Media.DATE_ADDED)
                while (cursor.moveToNext()) {
                    val bucket = if (bucketCol >= 0) cursor.getString(bucketCol) ?: "Videos" else "Videos"
                    val size = if (sizeCol >= 0) cursor.getLong(sizeCol) else 0L
                    val date = if (dateCol >= 0) cursor.getLong(dateCol) * 1000L else 0L
                    val stat = folderMap.getOrPut(bucket) { FolderStat(bucket) }
                    stat.videoCount++
                    stat.totalBytes += size
                    if (date > stat.latestDate) stat.latestDate = date
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        val sortedFolders = folderMap.values.sortedByDescending { it.imageCount + it.videoCount }
        val foldersArray = JSONArray()
        var totalMedia = 0

        for (f in sortedFolders) {
            val count = f.imageCount + f.videoCount
            totalMedia += count
            val fObj = JSONObject().apply {
                put("name", f.name)
                put("imageCount", f.imageCount)
                put("videoCount", f.videoCount)
                put("totalItems", count)
                put("size", formatSize(f.totalBytes))
                put("latestDate", f.latestDate)
            }
            foldersArray.put(fObj)
        }

        root.put("type", "remote_folders_list")
        root.put("totalMedia", totalMedia)
        root.put("totalFolders", sortedFolders.size)
        root.put("folders", foldersArray)
        return root
    }

    /**
     * Queries files inside a specific folder with lightweight blurred/compact thumbnails
     */
    fun getFolderMediaItemsJson(context: Context, folderName: String, limit: Int = 10000, offset: Int = 0): JSONObject {
        val root = JSONObject()
        val itemsArray = JSONArray()

        try {
            // 1. Images in this folder
            val imgProj = arrayOf(
                MediaStore.Images.Media._ID,
                MediaStore.Images.Media.DISPLAY_NAME,
                MediaStore.Images.Media.SIZE,
                MediaStore.Images.Media.MIME_TYPE,
                MediaStore.Images.Media.DATE_ADDED
            )
            val selection = "${MediaStore.Images.Media.BUCKET_DISPLAY_NAME} = ?"
            val selectionArgs = arrayOf(folderName)

            context.contentResolver.query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                imgProj,
                selection,
                selectionArgs,
                "${MediaStore.Images.Media.DATE_ADDED} DESC"
            )?.use { cursor ->
                val idCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID)
                val nameCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME)
                val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.SIZE)
                val mimeCol = cursor.getColumnIndex(MediaStore.Images.Media.MIME_TYPE)
                val dateCol = cursor.getColumnIndex(MediaStore.Images.Media.DATE_ADDED)

                var skipped = 0
                var count = 0
                while (cursor.moveToNext() && count < limit) {
                    if (skipped < offset) {
                        skipped++
                        continue
                    }

                    val id = cursor.getLong(idCol)
                    val name = cursor.getString(nameCol) ?: "IMG_$id.jpg"
                    val size = cursor.getLong(sizeCol)
                    val mime = if (mimeCol >= 0) cursor.getString(mimeCol) ?: "image/jpeg" else "image/jpeg"
                    val date = if (dateCol >= 0) cursor.getLong(dateCol) * 1000L else System.currentTimeMillis()
                    val uri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id)

                    val itemObj = JSONObject().apply {
                        put("id", "img_$id")
                        put("numericId", id)
                        put("type", "image")
                        put("name", name)
                        put("size", formatSize(size))
                        put("sizeBytes", size)
                        put("mimeType", mime)
                        put("album", folderName)
                        put("timestamp", date)
                    }

                    // Strict 10-15 preview limit: Generate thumbnails ONLY for the first 15 images to ensure 0ms lag and zero memory choke
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && count < 15) {
                        try {
                            val bmp = context.contentResolver.loadThumbnail(uri, android.util.Size(120, 120), null)
                            val stream = java.io.ByteArrayOutputStream()
                            bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 60, stream)
                            val b64 = android.util.Base64.encodeToString(stream.toByteArray(), android.util.Base64.NO_WRAP)
                            itemObj.put("thumbnail", "data:image/jpeg;base64,$b64")
                        } catch (e: Exception) {}
                    }

                    itemsArray.put(itemObj)
                    count++
                }
            }

            // 2. Videos in this folder
            val vidProj = arrayOf(
                MediaStore.Video.Media._ID,
                MediaStore.Video.Media.DISPLAY_NAME,
                MediaStore.Video.Media.SIZE,
                MediaStore.Video.Media.DURATION,
                MediaStore.Video.Media.MIME_TYPE,
                MediaStore.Video.Media.DATE_ADDED
            )
            context.contentResolver.query(
                MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
                vidProj,
                selection,
                selectionArgs,
                "${MediaStore.Video.Media.DATE_ADDED} DESC"
            )?.use { cursor ->
                val idCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media._ID)
                val nameCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DISPLAY_NAME)
                val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.SIZE)
                val durCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DURATION)
                val mimeCol = cursor.getColumnIndex(MediaStore.Video.Media.MIME_TYPE)
                val dateCol = cursor.getColumnIndex(MediaStore.Video.Media.DATE_ADDED)

                var count = 0
                while (cursor.moveToNext() && count < limit) {
                    val id = cursor.getLong(idCol)
                    val name = cursor.getString(nameCol) ?: "VID_$id.mp4"
                    val size = cursor.getLong(sizeCol)
                    val dur = cursor.getLong(durCol)
                    val mime = if (mimeCol >= 0) cursor.getString(mimeCol) ?: "video/mp4" else "video/mp4"
                    val date = if (dateCol >= 0) cursor.getLong(dateCol) * 1000L else System.currentTimeMillis()

                    val itemObj = JSONObject().apply {
                        put("id", "vid_$id")
                        put("numericId", id)
                        put("type", "video")
                        put("name", name)
                        put("size", formatSize(size))
                        put("sizeBytes", size)
                        put("duration", formatDuration(dur))
                        put("mimeType", mime)
                        put("album", folderName)
                        put("timestamp", date)
                    }

                    itemsArray.put(itemObj)
                    count++
                }
            }

            root.put("type", "remote_folder_items")
            root.put("folderName", folderName)
            root.put("total", itemsArray.length())
            root.put("items", itemsArray)
            root.put("offset", offset)
        } catch (e: Exception) {
            e.printStackTrace()
            root.put("type", "remote_folder_items")
            root.put("folderName", folderName)
            root.put("total", 0)
            root.put("items", JSONArray())
        }
        return root
    }

    /**
     * Packages multiple media files into a single compressed ZIP file directly on disk (Zero-RAM Streaming)
     */
    fun createZipArchiveFile(
        context: Context,
        fileIds: List<String>,
        zipName: String = "Media_Bundle.zip",
        onProgress: ((current: Int, total: Int) -> Unit)? = null
    ): Pair<String, File>? {
        return try {
            val safeName = if (zipName.endsWith(".zip")) zipName else "$zipName.zip"
            val tempFile = File.createTempFile("pulseshare_bundle_", ".zip", context.cacheDir)
            val fileOut = java.io.FileOutputStream(tempFile)
            val zipOut = java.util.zip.ZipOutputStream(java.io.BufferedOutputStream(fileOut))
            zipOut.setLevel(5) // Fast DEFLATE compression

            val total = fileIds.size
            var current = 0
            val addedNames = mutableSetOf<String>()
            val buffer = ByteArray(65536) // 64 KB streaming buffer

            for (fileId in fileIds) {
                try {
                    val isVideo = fileId.startsWith("vid_")
                    val rawId = fileId.removePrefix("img_").removePrefix("vid_").toLongOrNull()
                    if (rawId != null) {
                        val baseUri = if (isVideo) MediaStore.Video.Media.EXTERNAL_CONTENT_URI else MediaStore.Images.Media.EXTERNAL_CONTENT_URI
                        val uri = ContentUris.withAppendedId(baseUri, rawId)
                        var fileName = if (isVideo) "video_$rawId.mp4" else "photo_$rawId.jpg"
                        context.contentResolver.query(uri, arrayOf(MediaStore.MediaColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                            if (cursor.moveToFirst()) {
                                val idx = cursor.getColumnIndex(MediaStore.MediaColumns.DISPLAY_NAME)
                                if (idx >= 0) {
                                    cursor.getString(idx)?.let { fileName = it }
                                }
                            }
                        }

                        if (addedNames.contains(fileName)) {
                            val dotIndex = fileName.lastIndexOf('.')
                            fileName = if (dotIndex > 0) {
                                "${fileName.substring(0, dotIndex)}_$current${fileName.substring(dotIndex)}"
                            } else {
                                "${fileName}_$current"
                            }
                        }
                        addedNames.add(fileName)

                        val entry = java.util.zip.ZipEntry(fileName)
                        zipOut.putNextEntry(entry)
                        context.contentResolver.openInputStream(uri)?.use { inStream ->
                            var read: Int
                            while (inStream.read(buffer).also { read = it } != -1) {
                                zipOut.write(buffer, 0, read)
                            }
                        }
                        zipOut.closeEntry()
                    }
                } catch (itemErr: Exception) {
                    itemErr.printStackTrace()
                }
                current++
                onProgress?.invoke(current, total)
            }

            zipOut.finish()
            zipOut.flush()
            zipOut.close()
            Pair(safeName, tempFile)
        } catch (e: Throwable) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Bundles up to maxItems from a specified folder directly to a ZIP file on disk
     */
    fun createFolderZipArchiveFile(
        context: Context,
        folderName: String,
        maxItems: Int = 500,
        onProgress: ((current: Int, total: Int) -> Unit)? = null
    ): Pair<String, File>? {
        val fileIds = mutableListOf<String>()
        try {
            val projection = arrayOf(MediaStore.Images.Media._ID)
            val selection = "${MediaStore.Images.Media.BUCKET_DISPLAY_NAME} = ?"
            val selectionArgs = arrayOf(folderName)
            context.contentResolver.query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                projection,
                selection,
                selectionArgs,
                "${MediaStore.Images.Media.DATE_ADDED} DESC"
            )?.use { cursor ->
                val idCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID)
                var count = 0
                while (cursor.moveToNext() && count < maxItems) {
                    val id = cursor.getLong(idCol)
                    fileIds.add("img_$id")
                    count++
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        val safeFolderName = folderName.replace(Regex("[^a-zA-Z0-9_-]"), "_")
        return createZipArchiveFile(context, fileIds, "${safeFolderName}_bundle.zip", onProgress)
    }

    /**
     * Packages multiple media files into a single compressed ZIP archive with live progress
     */
    fun createZipArchive(
        context: Context,
        fileIds: List<String>,
        zipName: String = "Media_Bundle.zip",
        onProgress: ((current: Int, total: Int) -> Unit)? = null
    ): Pair<String, ByteArray>? {
        return try {
            val byteStream = java.io.ByteArrayOutputStream()
            val zipOut = java.util.zip.ZipOutputStream(java.io.BufferedOutputStream(byteStream))
            zipOut.setLevel(5) // Fast DEFLATE compression

            val total = fileIds.size
            var current = 0
            val addedNames = mutableSetOf<String>()

            for (fileId in fileIds) {
                val mediaResult = getMediaFileBytes(context, fileId)
                if (mediaResult != null) {
                    var (fileName, bytes) = mediaResult
                    if (addedNames.contains(fileName)) {
                        val dotIndex = fileName.lastIndexOf('.')
                        fileName = if (dotIndex > 0) {
                            "${fileName.substring(0, dotIndex)}_$current${fileName.substring(dotIndex)}"
                        } else {
                            "${fileName}_$current"
                        }
                    }
                    addedNames.add(fileName)

                    val entry = java.util.zip.ZipEntry(fileName)
                    entry.size = bytes.size.toLong()
                    zipOut.putNextEntry(entry)
                    zipOut.write(bytes)
                    zipOut.closeEntry()
                }
                current++
                onProgress?.invoke(current, total)
            }

            zipOut.finish()
            zipOut.close()
            val zipBytes = byteStream.toByteArray()
            val finalName = if (zipName.endsWith(".zip")) zipName else "$zipName.zip"
            Pair(finalName, zipBytes)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Bundles up to maxItems from a specified folder into a single ZIP archive
     */
    fun createFolderZipArchive(
        context: Context,
        folderName: String,
        maxItems: Int = 100,
        onProgress: ((current: Int, total: Int) -> Unit)? = null
    ): Pair<String, ByteArray>? {
        val fileIds = mutableListOf<String>()
        try {
            val projection = arrayOf(MediaStore.Images.Media._ID)
            val selection = "${MediaStore.Images.Media.BUCKET_DISPLAY_NAME} = ?"
            val selectionArgs = arrayOf(folderName)
            context.contentResolver.query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                projection,
                selection,
                selectionArgs,
                "${MediaStore.Images.Media.DATE_ADDED} DESC"
            )?.use { cursor ->
                val idCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID)
                var count = 0
                while (cursor.moveToNext() && count < maxItems) {
                    val id = cursor.getLong(idCol)
                    fileIds.add("img_$id")
                    count++
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        val safeFolderName = folderName.replace(Regex("[^a-zA-Z0-9_-]"), "_")
        return createZipArchive(context, fileIds, "${safeFolderName}_bundle.zip", onProgress)
    }
}
