package com.pulseshare.app.data

import android.content.Context
import android.os.Environment
import android.util.Base64
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

/**
 * Full Storage & File Explorer Helper.
 * Enables browsing phone directories, downloading documents/APKs, remote deletion, and direct file uploads.
 */
object DeviceStorageHelper {
    private const val TAG = "DeviceStorageHelper"

    val ROOT_STORAGE_PATH: String = Environment.getExternalStorageDirectory().absolutePath

    fun getQuickShortcuts(): JSONArray {
        val arr = JSONArray()
        val roots = listOf(
            Triple("Downloads", File(ROOT_STORAGE_PATH, "Download"), "📥"),
            Triple("Documents", File(ROOT_STORAGE_PATH, "Documents"), "📄"),
            Triple("WhatsApp Docs", File(ROOT_STORAGE_PATH, "Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Documents"), "💬"),
            Triple("DCIM / Camera", File(ROOT_STORAGE_PATH, "DCIM"), "📷"),
            Triple("Pictures", File(ROOT_STORAGE_PATH, "Pictures"), "🖼️"),
            Triple("Music", File(ROOT_STORAGE_PATH, "Music"), "🎵"),
            Triple("Internal Storage", File(ROOT_STORAGE_PATH), "💾")
        )

        for ((name, file, icon) in roots) {
            val exists = file.exists()
            arr.put(JSONObject().apply {
                put("name", name)
                put("path", file.absolutePath)
                put("icon", icon)
                put("exists", exists)
            })
        }
        return arr
    }

    fun browseDirectory(targetPath: String? = null): JSONObject {
        val root = JSONObject()
        val itemsArr = JSONArray()

        val activePath = if (!targetPath.isNullOrBlank()) targetPath else ROOT_STORAGE_PATH
        val targetDir = File(activePath)

        if (!targetDir.exists() || !targetDir.isDirectory) {
            root.put("type", "remote_storage_browse")
            root.put("error", "Directory does not exist or cannot be read: $activePath")
            root.put("currentPath", ROOT_STORAGE_PATH)
            root.put("items", itemsArr)
            return root
        }

        try {
            val fileList = targetDir.listFiles() ?: emptyArray()

            // Sort: Folders first (alphabetical), then Files (alphabetical)
            val sortedFiles = fileList.sortedWith(
                compareBy<File> { !it.isDirectory }
                    .thenBy { it.name.lowercase() }
            )

            for (f in sortedFiles) {
                // Skip hidden/temp files starting with "."
                if (f.name.startsWith(".")) continue

                val isDir = f.isDirectory
                val sizeBytes = if (isDir) 0L else f.length()
                val ext = if (isDir) "" else f.extension.lowercase()
                val childCount = if (isDir) (f.list()?.size ?: 0) else 0

                val item = JSONObject().apply {
                    put("name", f.name)
                    put("path", f.absolutePath)
                    put("isDirectory", isDir)
                    put("size", sizeBytes)
                    put("sizeFormatted", formatFileSize(sizeBytes))
                    put("lastModified", f.lastModified())
                    put("extension", ext)
                    put("childCount", childCount)
                }
                itemsArr.put(item)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error listing files in $activePath: ${e.message}")
            root.put("error", e.message ?: "Failed to list folder")
        }

        root.apply {
            put("type", "remote_storage_browse")
            put("currentPath", targetDir.absolutePath)
            put("parentPath", targetDir.parent ?: ROOT_STORAGE_PATH)
            put("isRoot", targetDir.absolutePath == ROOT_STORAGE_PATH)
            put("items", itemsArr)
            put("count", itemsArr.length())
            put("shortcuts", getQuickShortcuts())
            put("timestamp", System.currentTimeMillis())
        }

        return root
    }

    fun deleteFile(filePath: String): Boolean {
        return try {
            val file = File(filePath)
            if (!file.exists()) return false
            if (file.isDirectory) {
                file.deleteRecursively()
            } else {
                file.delete()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error deleting file: ${e.message}")
            false
        }
    }

    fun renameFile(filePath: String, newName: String): Boolean {
        return try {
            val file = File(filePath)
            if (!file.exists()) return false
            val cleanName = newName.trim()
            if (cleanName.isBlank()) return false
            val parent = file.parentFile ?: return false
            val newFile = File(parent, cleanName)
            file.renameTo(newFile)
        } catch (e: Exception) {
            Log.e(TAG, "Error renaming file: ${e.message}")
            false
        }
    }

    fun getStorageFileBytes(filePath: String): Pair<String, ByteArray>? {
        return try {
            val file = File(filePath)
            if (!file.exists() || !file.isFile) return null
            val bytes = file.readBytes()
            Pair(file.name, bytes)
        } catch (e: Exception) {
            Log.e(TAG, "Error reading storage file: ${e.message}")
            null
        }
    }

    fun saveUploadedFile(
        directoryPath: String,
        fileName: String,
        base64Data: String
    ): JSONObject {
        val result = JSONObject()
        try {
            val targetDir = File(if (directoryPath.isNotBlank()) directoryPath else ROOT_STORAGE_PATH)
            if (!targetDir.exists()) targetDir.mkdirs()

            val cleanFileName = fileName.trim().replace("/", "_").replace("\\", "_")
            val targetFile = File(targetDir, cleanFileName)

            val bytes = Base64.decode(base64Data, Base64.DEFAULT)
            FileOutputStream(targetFile).use { it.write(bytes) }

            result.put("success", true)
            result.put("path", targetFile.absolutePath)
            result.put("name", targetFile.name)
            result.put("size", targetFile.length())
            Log.d(TAG, "Saved uploaded file to ${targetFile.absolutePath} (${bytes.size} bytes)")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving uploaded file: ${e.message}")
            result.put("success", false)
            result.put("error", e.message ?: "Failed to write file")
        }
        return result
    }

    private fun formatFileSize(bytes: Long): String {
        if (bytes <= 0L) return "0 B"
        val kb = bytes / 1024.0
        val mb = kb / 1024.0
        val gb = mb / 1024.0
        return when {
            gb >= 1.0 -> String.format("%.2f GB", gb)
            mb >= 1.0 -> String.format("%.2f MB", mb)
            kb >= 1.0 -> String.format("%.1f KB", kb)
            else -> "$bytes B"
        }
    }
}
