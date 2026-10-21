package com.pulseshare.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pulseshare.app.data.MediaCategory
import com.pulseshare.app.data.MediaItem
import com.pulseshare.app.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MediaScreen(
    mediaItems: List<MediaItem>,
    selectedIds: Set<String>,
    onToggleSelect: (String) -> Unit,
    onSelectAll: () -> Unit,
    onClearSelection: () -> Unit,
    onSendNow: () -> Unit,
    onRequestPermission: () -> Unit = {},
    onPickAnyFile: () -> Unit = {}
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedAlbum by remember { mutableStateOf("Recents") }
    var showAlbumSheet by remember { mutableStateOf(false) }

    // Group items into WhatsApp-style albums
    val albumGroups = remember(mediaItems) {
        val map = mutableMapOf<String, MutableList<MediaItem>>()
        map["Recents"] = mediaItems.toMutableList()

        mediaItems.forEach { item ->
            val albumName = when {
                item.category == MediaCategory.VIDEOS -> "Videos"
                item.album.contains("Camera", ignoreCase = true) -> "Camera"
                item.album.contains("Screenshot", ignoreCase = true) -> "Screenshots"
                item.album.contains("Download", ignoreCase = true) -> "Downloads"
                item.album.contains("WhatsApp", ignoreCase = true) -> "WhatsApp"
                else -> item.album.ifBlank { "Other" }
            }
            map.getOrPut(albumName) { mutableListOf() }.add(item)
        }
        map
    }

    val currentAlbumItems = remember(albumGroups, selectedAlbum, searchQuery) {
        val list = albumGroups[selectedAlbum] ?: mediaItems
        if (searchQuery.isBlank()) {
            list
        } else {
            list.filter { it.title.contains(searchQuery, ignoreCase = true) }
        }
    }

    val totalSelectedBytes = remember(selectedIds, mediaItems) {
        mediaItems.filter { it.id in selectedIds }.sumOf { it.sizeBytes }
    }

    val formatBytes: (Long) -> String = { bytes ->
        val mb = bytes / (1024.0 * 1024.0)
        if (mb < 1000) String.format("%.1f MB", mb) else String.format("%.2f GB", mb / 1024.0)
    }

    Box(modifier = Modifier.fillMaxSize().background(DarkBackground)) {
        Column(modifier = Modifier.fillMaxSize()) {
            
            // WhatsApp Style Album Header Bar
            Surface(
                color = DarkSurface,
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderLight),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // WhatsApp Album Selector Dropdown Button (Recents ▾)
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .clickable { showAlbumSheet = true }
                                .padding(horizontal = 6.dp, vertical = 4.dp)
                        ) {
                            Text(
                                selectedAlbum,
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Icon(Icons.Default.ArrowDropDown, contentDescription = "Albums", tint = CyanPrimary)
                        }

                        // Right actions: HD / File Picker
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = CyanPrimary.copy(alpha = 0.15f),
                                border = androidx.compose.foundation.BorderStroke(1.dp, CyanPrimary.copy(alpha = 0.4f))
                            ) {
                                Text(
                                    "HD P2P",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = CyanPrimary,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                )
                            }

                            IconButton(
                                onClick = onPickAnyFile,
                                modifier = Modifier.size(34.dp)
                            ) {
                                Icon(Icons.Default.FolderOpen, contentDescription = "More Apps / Files", tint = TextSecondary)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    // WhatsApp Quick Attachment Categories Row
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        listOf(
                            Triple("Recents", Icons.Default.PhotoLibrary, "Recents"),
                            Triple("Camera", Icons.Default.CameraAlt, "Camera"),
                            Triple("Videos", Icons.Default.PlayCircle, "Videos"),
                            Triple("Screenshots", Icons.Default.Screenshot, "Screenshots"),
                            Triple("Downloads", Icons.Default.Download, "Downloads"),
                            Triple("WhatsApp", Icons.Default.Chat, "WhatsApp")
                        ).forEach { (title, icon, albumKey) ->
                            val isSelected = selectedAlbum == albumKey
                            Surface(
                                modifier = Modifier.clickable { selectedAlbum = albumKey },
                                shape = RoundedCornerShape(20.dp),
                                color = if (isSelected) CyanPrimary else DarkSurfaceVariant,
                                border = if (isSelected) null else androidx.compose.foundation.BorderStroke(1.dp, BorderLight)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                                ) {
                                    Icon(
                                        imageVector = icon,
                                        contentDescription = null,
                                        tint = if (isSelected) Color.Black else TextSecondary,
                                        modifier = Modifier.size(14.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = title,
                                        fontSize = 11.sp,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                        color = if (isSelected) Color.Black else TextSecondary
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // WhatsApp Style Permission Banner if 0 items found
            if (mediaItems.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Card(
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(containerColor = DarkSurface),
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderLight),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(64.dp)
                                    .clip(CircleShape)
                                    .background(CyanPrimary.copy(alpha = 0.15f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Default.PhotoLibrary,
                                    contentDescription = null,
                                    tint = CyanPrimary,
                                    modifier = Modifier.size(32.dp)
                                )
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            Text(
                                "Allow Gallery Access",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )

                            Spacer(modifier = Modifier.height(8.dp))

                            Text(
                                "To share your real photos, videos and files directly with your Laptop, allow PulseShare access to your device media (like WhatsApp).",
                                fontSize = 12.sp,
                                color = TextMuted,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                                lineHeight = 18.sp
                            )

                            Spacer(modifier = Modifier.height(20.dp))

                            Button(
                                onClick = onRequestPermission,
                                colors = ButtonDefaults.buttonColors(containerColor = CyanPrimary),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Icon(Icons.Default.Check, contentDescription = null, tint = Color.Black)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Allow Access", color = Color.Black, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            TextButton(onClick = onPickAnyFile) {
                                Text("Or choose single file manually", color = CyanPrimary, fontSize = 12.sp)
                            }
                        }
                    }
                }
            } else {
                // WhatsApp Visual Grid (3 columns) with Video Time Badges and Multi-Select
                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 4.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                    contentPadding = PaddingValues(bottom = 90.dp)
                ) {
                    items(currentAlbumItems, key = { it.id }) { item ->
                        val isSelected = item.id in selectedIds

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .aspectRatio(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isSelected) CyanPrimary.copy(alpha = 0.25f) else DarkSurface)
                                .border(
                                    if (isSelected) 2.5.dp else 0.5.dp,
                                    if (isSelected) CyanPrimary else BorderLight,
                                    RoundedCornerShape(8.dp)
                                )
                                .clickable { onToggleSelect(item.id) }
                                .padding(6.dp)
                        ) {
                            // Center Icon / Visual Representation
                            Column(
                                modifier = Modifier.align(Alignment.Center),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Icon(
                                    imageVector = if (item.category == MediaCategory.VIDEOS) Icons.Default.PlayCircle else Icons.Default.Image,
                                    contentDescription = null,
                                    tint = if (isSelected) CyanPrimary else TextSecondary,
                                    modifier = Modifier.size(28.dp)
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    item.title,
                                    color = TextPrimary,
                                    fontSize = 10.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }

                            // WhatsApp Top-Right Selection Bubble
                            Box(
                                modifier = Modifier
                                    .align(Alignment.TopEnd)
                                    .size(22.dp)
                                    .clip(CircleShape)
                                    .background(if (isSelected) CyanPrimary else Color.Black.copy(alpha = 0.4f))
                                    .border(1.5.dp, if (isSelected) CyanPrimary else Color.White, CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                if (isSelected) {
                                    Icon(
                                        Icons.Default.Check,
                                        contentDescription = null,
                                        tint = Color.Black,
                                        modifier = Modifier.size(14.dp)
                                    )
                                }
                            }

                            // WhatsApp Bottom-Left Video Duration Badge (e.g. 0:17, 3:26)
                            if (item.category == MediaCategory.VIDEOS) {
                                Surface(
                                    modifier = Modifier.align(Alignment.BottomStart),
                                    shape = RoundedCornerShape(4.dp),
                                    color = Color.Black.copy(alpha = 0.75f)
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                                    ) {
                                        Icon(Icons.Default.Videocam, contentDescription = null, tint = Color.White, modifier = Modifier.size(10.dp))
                                        Spacer(modifier = Modifier.width(2.dp))
                                        Text(
                                            item.dateOrDuration,
                                            color = Color.White,
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // WhatsApp Style Floating "Send to Laptop" Bar
        if (selectedIds.isNotEmpty()) {
            Surface(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(14.dp),
                shape = RoundedCornerShape(16.dp),
                color = DarkSurface,
                tonalElevation = 8.dp,
                border = androidx.compose.foundation.BorderStroke(1.dp, CyanPrimary)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            "${selectedIds.size} Selected",
                            color = CyanPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                        Text(
                            formatBytes(totalSelectedBytes),
                            color = TextMuted,
                            fontSize = 11.sp
                        )
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(onClick = onClearSelection) {
                            Text("Clear", color = TextMuted, fontSize = 12.sp)
                        }

                        Button(
                            onClick = onSendNow,
                            colors = ButtonDefaults.buttonColors(containerColor = CyanPrimary),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Icon(Icons.Default.Send, contentDescription = null, tint = Color.Black, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Send to Laptop", color = Color.Black, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                    }
                }
            }
        }

        // WhatsApp Style Album Bottom Sheet (as shown in user's screenshot 2 & 3!)
        if (showAlbumSheet) {
            ModalBottomSheet(
                onDismissRequest = { showAlbumSheet = false },
                containerColor = DarkSurface,
                tonalElevation = 8.dp
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "Select Album",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )

                        IconButton(onClick = { showAlbumSheet = false }) {
                            Icon(Icons.Default.Close, contentDescription = "Close", tint = TextSecondary)
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    LazyColumn(modifier = Modifier.fillMaxWidth()) {
                        items(albumGroups.keys.toList()) { albumName ->
                            val count = albumGroups[albumName]?.size ?: 0
                            val isCurrent = selectedAlbum == albumName

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .clickable {
                                        selectedAlbum = albumName
                                        showAlbumSheet = false
                                    }
                                    .padding(horizontal = 12.dp, vertical = 12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier
                                            .size(40.dp)
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(DarkSurfaceVariant),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = when (albumName) {
                                                "Videos" -> Icons.Default.PlayCircle
                                                "Camera" -> Icons.Default.CameraAlt
                                                "Screenshots" -> Icons.Default.Screenshot
                                                "Downloads" -> Icons.Default.Download
                                                "WhatsApp" -> Icons.Default.Chat
                                                else -> Icons.Default.Folder
                                            },
                                            contentDescription = null,
                                            tint = if (isCurrent) CyanPrimary else TextSecondary,
                                            modifier = Modifier.size(22.dp)
                                        )
                                    }

                                    Spacer(modifier = Modifier.width(14.dp))

                                    Column {
                                        Text(
                                            albumName,
                                            fontSize = 14.sp,
                                            fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.SemiBold,
                                            color = if (isCurrent) CyanPrimary else TextPrimary
                                        )
                                        Text(
                                            "$count items",
                                            fontSize = 12.sp,
                                            color = TextMuted
                                        )
                                    }
                                }

                                if (isCurrent) {
                                    Icon(
                                        Icons.Default.Check,
                                        contentDescription = "Selected",
                                        tint = CyanPrimary,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
