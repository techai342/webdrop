package com.pulseshare.app.data

import android.content.Context
import android.net.Uri
import android.os.Environment
import android.provider.OpenableColumns
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.util.concurrent.TimeUnit

data class ServerStatus(
    val status: String,
    val serverName: String,
    val ip: String,
    val port: Int,
    val connectUrl: String
)

data class RemoteFile(
    val id: String,
    val name: String,
    val size: Long,
    val sizeFormatted: String,
    val date: String,
    val downloadUrl: String
)

object NetworkManager {
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    var serverHost: String = "192.168.1.4"
    var serverPort: Int = 5000

    val baseUrl: String
        get() = "http://$serverHost:$serverPort"

    suspend fun checkServerConnection(host: String = serverHost): Result<ServerStatus> = withContext(Dispatchers.IO) {
        try {
            val url = "http://$host:$serverPort/api/status"
            val request = Request.Builder().url(url).build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext Result.failure(Exception("HTTP ${response.code}"))
                val body = response.body?.string() ?: ""
                val json = JSONObject(body)
                val status = ServerStatus(
                    status = json.optString("status", "online"),
                    serverName = json.optString("serverName", "Laptop"),
                    ip = json.optString("ip", host),
                    port = json.optInt("port", serverPort),
                    connectUrl = json.optString("connectUrl", url)
                )
                serverHost = host
                Result.success(status)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun fetchServerFiles(): Result<List<RemoteFile>> = withContext(Dispatchers.IO) {
        try {
            val url = "$baseUrl/api/files"
            val request = Request.Builder().url(url).build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext Result.failure(Exception("HTTP ${response.code}"))
                val body = response.body?.string() ?: ""
                val json = JSONObject(body)
                val array = json.optJSONArray("files") ?: JSONArray()
                val list = mutableListOf<RemoteFile>()
                for (i in 0 until array.length()) {
                    val item = array.getJSONObject(i)
                    list.add(
                        RemoteFile(
                            id = item.optString("id"),
                            name = item.optString("name"),
                            size = item.optLong("size"),
                            sizeFormatted = item.optString("sizeFormatted", "0 MB"),
                            date = item.optString("date", "Today"),
                            downloadUrl = item.optString("downloadUrl")
                        )
                    )
                }
                Result.success(list)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun uploadRealFiles(
        context: Context,
        uris: List<Uri>,
        senderName: String = "TECNO CAMON 20",
        onProgress: (Float) -> Unit
    ): Result<Int> = withContext(Dispatchers.IO) {
        try {
            val multipartBuilder = MultipartBody.Builder().setType(MultipartBody.FORM)
            multipartBuilder.addFormDataPart("senderName", senderName)

            var totalBytes: Long = 0
            val fileParts = mutableListOf<Pair<String, ByteArray>>()

            for (uri in uris) {
                val fileName = getFileName(context, uri) ?: "file_${System.currentTimeMillis()}"
                val bytes = readBytesFromUri(context, uri) ?: continue
                totalBytes += bytes.size
                fileParts.add(fileName to bytes)
            }

            if (fileParts.isEmpty()) {
                return@withContext Result.failure(Exception("No readable files selected"))
            }

            for ((name, bytes) in fileParts) {
                val mimeType = context.contentResolver.getType(Uri.parse(name)) ?: "application/octet-stream"
                val body = bytes.toRequestBody(mimeType.toMediaTypeOrNull())
                multipartBuilder.addFormDataPart("files", name, body)
            }

            val request = Request.Builder()
                .url("$baseUrl/api/upload")
                .post(multipartBuilder.build())
                .build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    onProgress(1f)
                    Result.success(fileParts.size)
                } else {
                    Result.failure(Exception("Upload failed with HTTP ${response.code}"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun downloadRemoteFile(context: Context, file: RemoteFile): Result<File> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder().url(file.downloadUrl).build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext Result.failure(Exception("Download failed: HTTP ${response.code}"))
                val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                if (!downloadsDir.exists()) downloadsDir.mkdirs()

                val targetFile = File(downloadsDir, file.name)
                val inputStream: InputStream = response.body?.byteStream() ?: return@withContext Result.failure(Exception("Empty body"))
                val outputStream = FileOutputStream(targetFile)

                inputStream.use { input ->
                    outputStream.use { output ->
                        input.copyTo(output)
                    }
                }

                Result.success(targetFile)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun getFileName(context: Context, uri: Uri): String? {
        var name: String? = null
        if (uri.scheme == "content") {
            val cursor = context.contentResolver.query(uri, null, null, null, null)
            cursor?.use {
                if (it.moveToFirst()) {
                    val index = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (index >= 0) name = it.getString(index)
                }
            }
        }
        if (name == null) {
            name = uri.path
            val cut = name?.lastIndexOf('/') ?: -1
            if (cut != -1) name = name?.substring(cut + 1)
        }
        return name
    }

    private fun readBytesFromUri(context: Context, uri: Uri): ByteArray? {
        return try {
            context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
        } catch (e: Exception) {
            null
        }
    }
}
