package com.pulseshare.app.ui.main

import android.Manifest
import android.net.Uri
import android.os.Build
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation3.runtime.NavKey
import androidx.compose.ui.zIndex
import com.pulseshare.app.data.*
import com.pulseshare.app.service.ConnectionStateHolder
import com.pulseshare.app.service.PulseShareForegroundService
import com.pulseshare.app.theme.*
import com.pulseshare.app.ui.*
import kotlinx.coroutines.launch

enum class AppTab(val label: String, val icon: ImageVector) {
    MEDIA("Gallery", Icons.Default.PhotoLibrary),
    WEBDROP("WebDrop P2P", Icons.Default.Share),
    TRANSFERS("Received", Icons.Default.Download)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    onItemClick: (NavKey) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var currentTab by remember { mutableStateOf(AppTab.MEDIA) }
    var currentRoomId by remember { mutableStateOf("PULSE1") }

    val isPairedToLaptop by ConnectionStateHolder.isConnectedToLaptop
    val connectedLaptopName by ConnectionStateHolder.laptopName

    // Files queued to send to Laptop via WebDrop
    var pendingFilesToSend by remember { mutableStateOf<List<MediaItem>>(emptyList()) }

    // Real Phone Media items
    var mediaItems by remember { mutableStateOf<List<MediaItem>>(emptyList()) }
    var selectedMediaIds by remember { mutableStateOf<Set<String>>(emptySet()) }

    // Real Transfers
    var transfers by remember { mutableStateOf<List<TransferRecord>>(emptyList()) }

    // Hardware active state
    var isTorchActive by remember { mutableStateOf(false) }

    // Refresh media helper
    fun refreshMedia() {
        coroutineScope.launch {
            val realItems = DeviceMediaHelper.getRealDeviceMedia(context)
            mediaItems = realItems
        }
    }

    // WhatsApp-Style Runtime Permission Launcher
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val granted = results.values.any { it }
        if (granted) {
            Toast.makeText(context, "Gallery access granted!", Toast.LENGTH_SHORT).show()
            refreshMedia()
        } else {
            Toast.makeText(context, "Media permission needed to show files", Toast.LENGTH_LONG).show()
        }
    }

    fun requestPermissions() {
        val permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf(
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.READ_MEDIA_VIDEO,
                Manifest.permission.READ_MEDIA_AUDIO,
                Manifest.permission.CAMERA
            )
        } else {
            arrayOf(
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.CAMERA
            )
        }
        permissionLauncher.launch(permissions)
    }

    // Initial load
    LaunchedEffect(Unit) {
        PulseShareForegroundService.start(context, currentRoomId)
        refreshMedia()
    }

    // Real Native File Picker for picking ANY file/folder from phone storage
    val customFilePicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetMultipleContents()
    ) { uris: List<Uri> ->
        if (uris.isNotEmpty()) {
            val newlySelected = mutableListOf<MediaItem>()
            uris.forEachIndexed { index, uri ->
                val fileName = uri.lastPathSegment?.substringAfterLast('/') ?: "File_${index + 1}"
                val item = MediaItem(
                    id = "custom-${System.currentTimeMillis()}-$index",
                    title = fileName,
                    category = MediaCategory.ALL,
                    size = "Selected File",
                    sizeBytes = 1024 * 1024,
                    dateOrDuration = "Just now",
                    realUri = uri
                )
                newlySelected.add(item)
            }
            mediaItems = newlySelected + mediaItems
            selectedMediaIds = selectedMediaIds + newlySelected.map { it.id }.toSet()
            Toast.makeText(context, "Added ${uris.size} file(s)", Toast.LENGTH_SHORT).show()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(10.dp)
                                .background(CyanPrimary, RoundedCornerShape(5.dp))
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            "PulseShare",
                            fontWeight = FontWeight.Bold,
                            fontSize = 17.sp,
                            color = TextPrimary
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = if (isPairedToLaptop) Color(0xFF10B981).copy(alpha = 0.2f) else CyanPrimary.copy(alpha = 0.15f),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (isPairedToLaptop) Color(0xFF10B981) else CyanPrimary.copy(alpha = 0.4f)
                            )
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(6.dp)
                                        .background(
                                            if (isPairedToLaptop) Color(0xFF10B981) else Color(0xFFF59E0B),
                                            androidx.compose.foundation.shape.CircleShape
                                        )
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    if (isPairedToLaptop) "🟢 Paired: $connectedLaptopName" else "Room: $currentRoomId",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isPairedToLaptop) Color(0xFF10B981) else CyanPrimary
                                )
                            }
                        }
                    }
                },
                actions = {
                    // Flashlight Toggle Action
                    IconButton(
                        onClick = {
                            isTorchActive = DeviceHardwareHelper.toggleFlashlight(context)
                        }
                    ) {
                        Icon(
                            imageVector = if (isTorchActive) Icons.Default.FlashOn else Icons.Default.FlashOff,
                            contentDescription = "Flashlight",
                            tint = if (isTorchActive) Color(0xFFFBBF24) else TextSecondary
                        )
                    }

                    // Vibrate Test Action
                    IconButton(
                        onClick = {
                            DeviceHardwareHelper.vibrate(context, 500)
                            Toast.makeText(context, "📳 Phone Vibrate Triggered", Toast.LENGTH_SHORT).show()
                        }
                    ) {
                        Icon(Icons.Default.Vibration, contentDescription = "Vibrate", tint = CyanPrimary)
                    }

                    // Stop Alarm if ringing
                    if (DeviceHardwareHelper.isFindingPhoneActive()) {
                        Button(
                            onClick = {
                                DeviceHardwareHelper.stopFindMyPhoneAlert(context)
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color.Red),
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                            modifier = Modifier.padding(end = 6.dp)
                        ) {
                            Text("SILENCE ALARM", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = DarkSurface
                )
            )
        },
        bottomBar = {
            NavigationBar(
                containerColor = DarkSurface,
                tonalElevation = 8.dp
            ) {
                AppTab.values().forEach { tab ->
                    val isSelected = currentTab == tab
                    NavigationBarItem(
                        selected = isSelected,
                        onClick = { currentTab = tab },
                        icon = {
                            Icon(
                                imageVector = tab.icon,
                                contentDescription = tab.label
                            )
                        },
                        label = {
                            Text(
                                tab.label,
                                fontSize = 11.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                            )
                        },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = CyanPrimary,
                            selectedTextColor = CyanPrimary,
                            unselectedIconColor = TextMuted,
                            unselectedTextColor = TextMuted,
                            indicatorColor = CyanPrimary.copy(alpha = 0.15f)
                        )
                    )
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // Tab 1: MEDIA / Gallery (WhatsApp style folders & photo grid)
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .zIndex(if (currentTab == AppTab.MEDIA) 2f else 0f)
                    .graphicsLayer {
                        alpha = if (currentTab == AppTab.MEDIA) 1f else 0f
                        translationX = if (currentTab == AppTab.MEDIA) 0f else -10000f
                    }
            ) {
                Column(modifier = Modifier.fillMaxSize()) {
                    // Live Laptop Pairing Banner
                    Surface(
                        color = if (isPairedToLaptop) Color(0xFF064E3B) else DarkSurfaceVariant,
                        border = androidx.compose.foundation.BorderStroke(
                            1.dp,
                            if (isPairedToLaptop) Color(0xFF10B981) else BorderLight
                        ),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .background(
                                        if (isPairedToLaptop) Color(0xFF10B981) else Color(0xFFF59E0B),
                                        androidx.compose.foundation.shape.CircleShape
                                    )
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                if (isPairedToLaptop) "🟢 Paired with $connectedLaptopName • 24/7 Background Sync Active" else "⚡ Waiting for Laptop • Open http://192.168.1.5:3000 (Room: $currentRoomId)",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = if (isPairedToLaptop) Color.White else TextSecondary
                            )
                        }
                    }

                    Box(modifier = Modifier.weight(1f)) {
                        MediaScreen(
                            mediaItems = mediaItems,
                            selectedIds = selectedMediaIds,
                            onToggleSelect = { id ->
                                selectedMediaIds = if (id in selectedMediaIds) {
                                    selectedMediaIds - id
                                } else {
                                    selectedMediaIds + id
                                }
                            },
                            onSelectAll = { selectedMediaIds = mediaItems.map { it.id }.toSet() },
                            onClearSelection = { selectedMediaIds = emptySet() },
                            onSendNow = { selectedItems ->
                                pendingFilesToSend = selectedItems
                                currentTab = AppTab.WEBDROP
                                Toast.makeText(context, "Streaming ${selectedItems.size} file(s) to Laptop...", Toast.LENGTH_SHORT).show()
                            },
                            onRequestPermission = { requestPermissions() },
                            onPickAnyFile = { customFilePicker.launch("*/*") }
                        )
                    }
                }
            }

            // Tab 2: WEBDROP P2P (Permanently kept alive in viewport: NEVER throttled or paused by Chromium!)
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .zIndex(if (currentTab == AppTab.WEBDROP) 2f else 0f)
                    .graphicsLayer {
                        alpha = if (currentTab == AppTab.WEBDROP) 1f else 0.001f
                        translationX = if (currentTab == AppTab.WEBDROP) 0f else -10000f
                    }
            ) {
                WebDropScreen(
                    initialRoomId = currentRoomId,
                    pendingFilesToSend = pendingFilesToSend,
                    onFilesHandled = {
                        pendingFilesToSend = emptyList()
                        selectedMediaIds = emptySet()
                    }
                )
            }

            // Tab 3: TRANSFERS / Received
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .zIndex(if (currentTab == AppTab.TRANSFERS) 2f else 0f)
                    .graphicsLayer {
                        alpha = if (currentTab == AppTab.TRANSFERS) 1f else 0f
                        translationX = if (currentTab == AppTab.TRANSFERS) 0f else -10000f
                    }
            ) {
                TransfersScreen(
                    transfers = transfers,
                    onCancelTransfer = { id ->
                        transfers = transfers.filter { it.id != id }
                    },
                    onClearHistory = {
                        transfers = emptyList()
                    }
                )
            }
        }
    }
}
