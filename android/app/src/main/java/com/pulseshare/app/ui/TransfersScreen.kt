package com.pulseshare.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pulseshare.app.data.TransferDirection
import com.pulseshare.app.data.TransferRecord
import com.pulseshare.app.data.TransferStatus
import com.pulseshare.app.theme.*

@Composable
fun TransfersScreen(
    transfers: List<TransferRecord>,
    onCancelTransfer: (String) -> Unit,
    onClearHistory: () -> Unit
) {
    val activeList = transfers.filter { it.status == TransferStatus.TRANSFERRING }
    val completedList = transfers.filter { it.status == TransferStatus.COMPLETED }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 90.dp)
    ) {
        // Analytics Summary
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                SummaryCard(title = "TRANSFERRED", value = "${completedList.size} files", iconTint = CyanPrimary, modifier = Modifier.weight(1f))
                SummaryCard(title = "ACTIVE", value = "${activeList.size}", iconTint = BlueAccent, modifier = Modifier.weight(1f))
                SummaryCard(title = "WI-FI", value = "Direct", iconTint = EmeraldSuccess, modifier = Modifier.weight(1f))
            }
        }

        // Active Transfers Section
        if (activeList.isNotEmpty()) {
            item {
                Text(
                    "ACTIVE TRANSFERS",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = CyanPrimary,
                    letterSpacing = 1.sp
                )
            }

            items(activeList) { transfer ->
                Surface(
                    shape = RoundedCornerShape(18.dp),
                    color = DarkCard,
                    border = androidx.compose.foundation.BorderStroke(1.5.dp, CyanPrimary.copy(alpha = 0.5f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    transfer.title,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary,
                                    maxLines = 1
                                )
                                Text(
                                    "To: ${transfer.targetDevice} • ${transfer.size}",
                                    fontSize = 11.sp,
                                    color = TextSecondary
                                )
                            }
                            IconButton(
                                onClick = { onCancelTransfer(transfer.id) },
                                modifier = Modifier.size(28.dp)
                            ) {
                                Icon(Icons.Default.Close, contentDescription = "Cancel", tint = TextMuted)
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        // Progress Bar
                        LinearProgressIndicator(
                            progress = { transfer.progress / 100f },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(8.dp)
                                .clip(RoundedCornerShape(4.dp)),
                            color = CyanPrimary,
                            trackColor = DarkSurfaceVariant
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("${transfer.progress}%", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = CyanGlow)
                            Text("${transfer.speed} (ETA 2s)", fontSize = 11.sp, color = TextSecondary)
                        }
                    }
                }
            }
        }

        // Transfer History Section Header
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "HISTORY (${completedList.size})",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextMuted,
                    letterSpacing = 1.sp
                )
                if (completedList.isNotEmpty()) {
                    Text(
                        "Clear",
                        fontSize = 12.sp,
                        color = TextMuted,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.clickable { onClearHistory() }
                    )
                }
            }
        }

        // History Items
        items(completedList) { item ->
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
                            .size(40.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(
                                if (item.direction == TransferDirection.SEND)
                                    BlueAccent.copy(alpha = 0.2f)
                                else
                                    EmeraldSuccess.copy(alpha = 0.2f)
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            if (item.direction == TransferDirection.SEND) Icons.Default.ArrowForward else Icons.Default.Share,
                            contentDescription = null,
                            tint = if (item.direction == TransferDirection.SEND) BlueAccent else EmeraldSuccess,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            item.title,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = TextPrimary,
                            maxLines = 1
                        )
                        Text(
                            "${item.size} • ${item.targetDevice}",
                            fontSize = 11.sp,
                            color = TextSecondary
                        )
                    }

                    Column(horizontalAlignment = Alignment.End) {
                        Text("Sent", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = EmeraldSuccess)
                        Text(item.timestamp, fontSize = 10.sp, color = TextMuted)
                    }
                }
            }
        }
    }
}

@Composable
fun SummaryCard(title: String, value: String, iconTint: Color, modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        color = DarkCard,
        border = androidx.compose.foundation.BorderStroke(1.dp, BorderLight)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(title, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = TextMuted)
            Spacer(modifier = Modifier.height(4.dp))
            Text(value, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = iconTint)
        }
    }
}
