package com.pulseshare.app.ui

import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pulseshare.app.data.*
import com.pulseshare.app.theme.*
import kotlinx.coroutines.launch

@Composable
fun RadarScreen(
    devices: List<DeviceItem>,
    selectedCount: Int,
    myDeviceName: String,
    onDeviceClick: (DeviceItem) -> Unit,
    onSendClick: () -> Unit,
    onReceiveToggle: () -> Unit,
    isReceiving: Boolean
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var isConnectedToLaptop by remember { mutableStateOf(false) }
    var laptopServerName by remember { mutableStateOf("Laptop (192.168.1.4)") }
    var isCheckingConnection by remember { mutableStateOf(false) }

    var isUploading by remember { mutableStateOf(false) }
    var uploadProgress by remember { mutableFloatStateOf(0f) }
    var lastUploadSuccessCount by remember { mutableIntStateOf(0) }

    var serverFiles by remember { mutableStateOf<List<RemoteFile>>(emptyList()) }

    // Auto-check connection to laptop on launch
    LaunchedEffect(Unit) {
        isCheckingConnection = true
        val result = NetworkManager.checkServerConnection()
        isCheckingConnection = false
        if (result.isSuccess) {
            val status = result.getOrNull()
            isConnectedToLaptop = true
            laptopServerName = status?.serverName ?: "Laptop (Connected)"
            // Also fetch server files
            val filesResult = NetworkManager.fetchServerFiles()
            if (filesResult.isSuccess) {
                serverFiles = filesResult.getOrDefault(emptyList())
            }
        }
    }

    // Real Native Android File Picker Launcher
    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetMultipleContents()
    ) { uris: List<Uri> ->
        if (uris.isNotEmpty()) {
            isUploading = true
            uploadProgress = 0.2f
            coroutineScope.launch {
                val uploadResult = NetworkManager.uploadRealFiles(
                    context = context,
                    uris = uris,
                    senderName = myDeviceName
                ) { progress ->
                    uploadProgress = progress
                }
                isUploading = false
                if (uploadResult.isSuccess) {
                    val count = uploadResult.getOrDefault(uris.size)
                    lastUploadSuccessCount = count
                    Toast.makeText(context, "$count real file(s) sent to Laptop!", Toast.LENGTH_LONG).show()
                    // Refresh server files list
                    val filesResult = NetworkManager.fetchServerFiles()
                    if (filesResult.isSuccess) {
                        serverFiles = filesResult.getOrDefault(emptyList())
                    }
                } else {
                    Toast.makeText(
                        context,
                        "Upload error: ${uploadResult.exceptionOrNull()?.message}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
    }

    val infiniteTransition = rememberInfiniteTransition(label = "radar")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 0.8f,
        targetValue = 1.35f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "pulse"
    )
    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.6f,
        targetValue = 0.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "alpha"
    )

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 90.dp)
    ) {
        // Laptop Real Connection Status Card
        item {
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = if (isConnectedToLaptop) Color(0xFF0F291E) else DarkCard,
                border = androidx.compose.foundation.BorderStroke(
                    1.5.dp,
                    if (isConnectedToLaptop) EmeraldSuccess else CyanPrimary.copy(alpha = 0.5f)
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(
                                    if (isConnectedToLaptop) EmeraldSuccess.copy(alpha = 0.2f)
                                    else CyanPrimary.copy(alpha = 0.2f)
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                Icons.Default.Home,
                                contentDescription = null,
                                tint = if (isConnectedToLaptop) EmeraldSuccess else CyanPrimary,
                                modifier = Modifier.size(24.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(8.dp)
                                        .clip(CircleShape)
                                        .background(if (isConnectedToLaptop) EmeraldSuccess else Color(0xFFF59E0B))
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    if (isConnectedToLaptop) "Laptop Connected" else "Searching Laptop...",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary
                                )
                            }
                            Text(
                                "http://${NetworkManager.serverHost}:5000",
                                fontSize = 11.sp,
                                color = TextSecondary
                            )
                        }
                    }

                    Button(
                        onClick = {
                            coroutineScope.launch {
                                isCheckingConnection = true
                                val res = NetworkManager.checkServerConnection()
                                isCheckingConnection = false
                                if (res.isSuccess) {
                                    isConnectedToLaptop = true
                                    Toast.makeText(context, "Connected to Laptop!", Toast.LENGTH_SHORT).show()
                                    val files = NetworkManager.fetchServerFiles().getOrDefault(emptyList())
                                    serverFiles = files
                                } else {
                                    Toast.makeText(context, "Cannot reach Laptop on Wi-Fi", Toast.LENGTH_SHORT).show()
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isConnectedToLaptop) EmeraldSuccess else CyanPrimary
                        ),
                        shape = RoundedCornerShape(12.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text(
                            if (isCheckingConnection) "..." else if (isConnectedToLaptop) "Online" else "Connect",
                            color = Color.Black,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }

        // Real File Upload Actions: Pick Real Photos & Files from Phone
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Send Real Photos & Videos Button
                Card(
                    modifier = Modifier
                        .weight(1f)
                        .clickable {
                            filePickerLauncher.launch("image/*")
                        },
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.Transparent)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                Brush.linearGradient(
                                    listOf(Color(0xFF2563EB), Color(0xFF4F46E5), Color(0xFF7C3AED))
                                )
                            )
                            .padding(16.dp)
                    ) {
                        Column {
                            Box(
                                modifier = Modifier
                                    .size(42.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color.White.copy(alpha = 0.2f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Default.Share,
                                    contentDescription = "Send Real Photos",
                                    tint = Color.White,
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                "SEND REAL PHOTOS",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White.copy(alpha = 0.8f)
                            )
                            Text(
                                "Pick from Gallery",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    }
                }

                // Send Any Real File (Videos / Docs / APKs)
                Card(
                    modifier = Modifier
                        .weight(1f)
                        .clickable {
                            filePickerLauncher.launch("*/*")
                        },
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.Transparent)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                Brush.linearGradient(
                                    listOf(Color(0xFF059669), Color(0xFF0D9488), Color(0xFF10B981))
                                )
                            )
                            .padding(16.dp)
                    ) {
                        Column {
                            Box(
                                modifier = Modifier
                                    .size(42.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color.White.copy(alpha = 0.2f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Default.Send,
                                    contentDescription = "Send Any File",
                                    tint = Color.White,
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                "SEND ANY FILE",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White.copy(alpha = 0.8f)
                            )
                            Text(
                                "Videos / Docs / APK",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    }
                }
            }
        }

        // Live Upload Progress Modal / Indicator
        if (isUploading) {
            item {
                Surface(
                    shape = RoundedCornerShape(18.dp),
                    color = DarkCard,
                    border = androidx.compose.foundation.BorderStroke(1.5.dp, CyanPrimary),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Uploading real files to Laptop...", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = CyanGlow)
                            Text("${(uploadProgress * 100).toInt()}%", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = CyanPrimary)
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        LinearProgressIndicator(
                            progress = { uploadProgress },
                            modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                            color = CyanPrimary,
                            trackColor = DarkSurfaceVariant
                        )
                    }
                }
            }
        }

        // Real Files Currently Sitting on Laptop
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "FILES ON LAPTOP (${serverFiles.size})",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextMuted,
                    letterSpacing = 1.sp
                )
                Text(
                    "Refresh",
                    fontSize = 12.sp,
                    color = CyanPrimary,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.clickable {
                        coroutineScope.launch {
                            val res = NetworkManager.fetchServerFiles()
                            if (res.isSuccess) {
                                serverFiles = res.getOrDefault(emptyList())
                                Toast.makeText(context, "Updated list from Laptop!", Toast.LENGTH_SHORT).show()
                            }
                        }
                    }
                )
            }
        }

        if (serverFiles.isEmpty()) {
            item {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = DarkCard,
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderLight),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(Icons.Default.Info, contentDescription = null, tint = TextMuted, modifier = Modifier.size(32.dp))
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("No files on Laptop yet", fontSize = 13.sp, color = TextSecondary, fontWeight = FontWeight.Medium)
                        Text("Tap 'Send Real Photos' above to upload from phone!", fontSize = 11.sp, color = TextMuted)
                    }
                }
            }
        } else {
            items(serverFiles) { remoteFile ->
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = DarkCard,
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderLight),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(42.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(CyanPrimary.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Star, contentDescription = null, tint = CyanPrimary, modifier = Modifier.size(20.dp))
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(remoteFile.name, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary, maxLines = 1)
                            Text("${remoteFile.sizeFormatted} • ${remoteFile.date}", fontSize = 11.sp, color = TextSecondary)
                        }

                        Button(
                            onClick = {
                                coroutineScope.launch {
                                    Toast.makeText(context, "Downloading ${remoteFile.name}...", Toast.LENGTH_SHORT).show()
                                    val dlRes = NetworkManager.downloadRemoteFile(context, remoteFile)
                                    if (dlRes.isSuccess) {
                                        Toast.makeText(context, "Downloaded to Phone /Downloads folder!", Toast.LENGTH_LONG).show()
                                    } else {
                                        Toast.makeText(context, "Download failed", Toast.LENGTH_SHORT).show()
                                    }
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = CyanPrimary),
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text("Save", fontSize = 11.sp, color = Color.Black, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        // Radar Visual Graphic
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(180.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .background(DarkSurface)
                    .border(1.dp, BorderLight, RoundedCornerShape(24.dp)),
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(160.dp)
                        .scale(pulseScale)
                        .clip(CircleShape)
                        .border(1.5.dp, CyanPrimary.copy(alpha = pulseAlpha), CircleShape)
                )
                Box(
                    modifier = Modifier
                        .size(110.dp)
                        .clip(CircleShape)
                        .border(1.dp, BorderLight, CircleShape)
                )

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        modifier = Modifier
                            .size(54.dp)
                            .clip(CircleShape)
                            .background(Brush.linearGradient(listOf(CyanPrimary, BlueAccent))),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Phone, contentDescription = null, tint = Color.Black, modifier = Modifier.size(26.dp))
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("You ($myDeviceName)", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    Text(if (isConnectedToLaptop) "Paired with Laptop" else "Ready to share", fontSize = 10.sp, color = CyanGlow)
                }
            }
        }
    }
}
