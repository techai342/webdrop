package com.pulseshare.app.data

import android.net.Uri

enum class DeviceType {
    PHONE, PC, TV, TABLET
}

data class DeviceItem(
    val id: String,
    val name: String,
    val type: DeviceType,
    val model: String,
    val os: String,
    val signal: Int,
    val distance: String,
    val status: String,
    val hostAddress: String? = null
)

enum class MediaCategory {
    ALL, PHOTOS, VIDEOS, AUDIO, DOCUMENTS, APKS
}

data class MediaItem(
    val id: String,
    val title: String,
    val category: MediaCategory,
    val size: String,
    val sizeBytes: Long,
    val dateOrDuration: String,
    val extraBadge: String? = null,
    val realUri: Uri? = null,
    val album: String = "Recents"
)

enum class TransferDirection {
    SEND, RECEIVE
}

enum class TransferStatus {
    TRANSFERRING, COMPLETED, FAILED
}

data class TransferRecord(
    val id: String,
    val title: String,
    val targetDevice: String,
    val direction: TransferDirection,
    val size: String,
    val progress: Int,
    val speed: String,
    val status: TransferStatus,
    val timestamp: String = "Just now"
)
