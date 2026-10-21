package com.pulseshare.app.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.pulseshare.app.data.DeviceItem
import com.pulseshare.app.theme.*
import kotlinx.coroutines.delay

@Composable
fun TransferDialog(
    targetDevice: DeviceItem?,
    selectedFilesCount: Int,
    onDismiss: () -> Unit,
    onComplete: () -> Unit
) {
    var progress by remember { mutableFloatStateOf(0f) }
    var speed by remember { mutableStateOf("52.4 MB/s") }
    var isDone by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        while (progress < 1f) {
            delay(120)
            progress = (progress + 0.08f).coerceAtMost(1f)
            val randomSpeed = 46.0 + (Math.random() * 18.0)
            speed = String.format("%.1f MB/s", randomSpeed)
        }
        isDone = true
        onComplete()
    }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = DarkCard,
            border = androidx.compose.foundation.BorderStroke(1.dp, BorderLight),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        if (isDone) "TRANSFER COMPLETE" else "P2P WI-FI DIRECT",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (isDone) EmeraldSuccess else CyanPrimary
                    )

                    IconButton(onClick = onDismiss, modifier = Modifier.size(24.dp)) {
                        Icon(Icons.Default.Close, contentDescription = "Close", tint = TextMuted)
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Device to Device Visual Beam
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Sender
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(
                            modifier = Modifier
                                .size(50.dp)
                                .clip(CircleShape)
                                .background(CyanPrimary.copy(alpha = 0.2f))
                                .border(1.5.dp, CyanPrimary, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Phone, contentDescription = null, tint = CyanPrimary, modifier = Modifier.size(24.dp))
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("You", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    }

                    // Beam Line
                    Column(modifier = Modifier.weight(1f).padding(horizontal = 12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        LinearProgressIndicator(
                            progress = { progress },
                            modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                            color = CyanPrimary,
                            trackColor = DarkSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(if (isDone) "100%" else speed, fontSize = 10.sp, color = CyanGlow, fontWeight = FontWeight.Bold)
                    }

                    // Recipient
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(
                            modifier = Modifier
                                .size(50.dp)
                                .clip(CircleShape)
                                .background(if (isDone) EmeraldSuccess.copy(alpha = 0.2f) else BlueAccent.copy(alpha = 0.2f))
                                .border(1.5.dp, if (isDone) EmeraldSuccess else BlueAccent, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                if (isDone) Icons.Default.Check else Icons.Default.Send,
                                contentDescription = null,
                                tint = if (isDone) EmeraldSuccess else BlueAccent,
                                modifier = Modifier.size(24.dp)
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(targetDevice?.name?.take(10) ?: "Receiver", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // File count & details
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = DarkSurface,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            if (isDone) "Files delivered successfully!" else "Sending $selectedFilesCount files...",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            "Target: ${targetDevice?.name} (${targetDevice?.model})",
                            fontSize = 11.sp,
                            color = TextSecondary
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                Button(
                    onClick = onDismiss,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isDone) EmeraldSuccess else DarkSurfaceVariant
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        if (isDone) "Done" else "Cancel Transfer",
                        color = if (isDone) Color.Black else TextSecondary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                }
            }
        }
    }
}
