package com.pulseshare.app.ui

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.webkit.*
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.pulseshare.app.data.DeviceHardwareHelper
import com.pulseshare.app.data.MediaItem
import com.pulseshare.app.service.PulseShareForegroundService
import com.pulseshare.app.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

enum class ConnectionSource(val title: String, val baseUrl: String, val icon: String) {
    CLOUD("WebDrop Cloud", "https://webdrop-five.vercel.app", "🌐"),
    LOCAL("Local PC", "http://192.168.1.7:3000", "🏠")
}

// Native Bridge for 100% Reliable File Saving to Phone Storage & Hardware Controls
class PulseShareBridge(
    private val context: Context,
    private val roomProvider: () -> String = { "PULSE1" }
) {
    @JavascriptInterface
    fun getAutoRoomId(): String = roomProvider()

    @JavascriptInterface
    fun getDeviceTelemetryJson(): String {
        return try {
            com.pulseshare.app.data.DeviceTelemetryHelper.getTelemetryJson(context).toString()
        } catch (e: Exception) {
            "{}"
        }
    }

    @JavascriptInterface
    fun getAndroidVersion(): String {
        return android.os.Build.VERSION.RELEASE ?: "14"
    }

    @JavascriptInterface
    fun getDeviceModel(): String {
        return "${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL}".trim()
    }

    @JavascriptInterface
    fun openAutoStartSettings(): Boolean {
        return com.pulseshare.app.data.AutoStartHelper.openAutoStartSettings(context)
    }

    @JavascriptInterface
    fun triggerVibrate(durationMs: Long) {
        Handler(Looper.getMainLooper()).post {
            DeviceHardwareHelper.vibrate(context, if (durationMs > 0) durationMs else 1000L)
            Toast.makeText(context, "📳 Laptop triggered Phone Vibration!", Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun setFlashlight(enable: Boolean) {
        Handler(Looper.getMainLooper()).post {
            DeviceHardwareHelper.setFlashlight(context, enable)
            Toast.makeText(context, if (enable) "🔦 Flashlight Turned ON by Laptop" else "🔦 Flashlight Turned OFF by Laptop", Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun toggleFlashlight(): Boolean {
        var state = false
        Handler(Looper.getMainLooper()).post {
            state = DeviceHardwareHelper.toggleFlashlight(context)
            Toast.makeText(context, "🔦 Flashlight Toggled by Laptop", Toast.LENGTH_SHORT).show()
        }
        return state
    }

    @JavascriptInterface
    fun startFindMyPhone() {
        Handler(Looper.getMainLooper()).post {
            DeviceHardwareHelper.startFindMyPhoneAlert(context)
            Toast.makeText(context, "🚨 Find My Phone Alert Triggered from Laptop!", Toast.LENGTH_LONG).show()
        }
    }

    @JavascriptInterface
    fun stopFindMyPhone() {
        Handler(Looper.getMainLooper()).post {
            DeviceHardwareHelper.stopFindMyPhoneAlert(context)
            Toast.makeText(context, "Find My Phone Stopped", Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun setWallpaper(base64Data: String, screen: String): Boolean {
        val result = DeviceHardwareHelper.setPhoneWallpaperFromBase64(context, base64Data, screen)
        Handler(Looper.getMainLooper()).post {
            if (result) {
                Toast.makeText(context, "🎨 Wallpaper Updated from WebDrop!", Toast.LENGTH_SHORT).show()
            }
        }
        return result
    }

    @JavascriptInterface
    fun saveFile(fileName: String, mimeType: String, base64Data: String) {
        try {
            val cleanBase64 = if (base64Data.contains(",")) {
                base64Data.substringAfter(",")
            } else {
                base64Data
            }
            val fileBytes = Base64.decode(cleanBase64, Base64.DEFAULT)

            val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            val targetDir = File(downloadsDir, "PulseShare")
            if (!targetDir.exists()) {
                targetDir.mkdirs()
            }
            val targetFile = File(targetDir, fileName)
            FileOutputStream(targetFile).use { it.write(fileBytes) }

            // Immediate MediaStore index refresh so pictures & videos show in Gallery
            MediaScannerConnection.scanFile(
                context,
                arrayOf(targetFile.absolutePath),
                arrayOf(mimeType),
                null
            )

            Handler(Looper.getMainLooper()).post {
                Toast.makeText(
                    context,
                    "Saved to Downloads/PulseShare: $fileName",
                    Toast.LENGTH_LONG
                ).show()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            Handler(Looper.getMainLooper()).post {
                Toast.makeText(context, "Error saving $fileName: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebDropScreen(
    initialRoomId: String = "PULSE1",
    onBack: () -> Unit = {},
    pendingFilesToSend: List<MediaItem> = emptyList(),
    onFilesHandled: () -> Unit = {}
) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("pulseshare_prefs", Context.MODE_PRIVATE) }
    val savedSourceStr = prefs.getString("connection_source", ConnectionSource.CLOUD.name) ?: ConnectionSource.CLOUD.name
    val initialSource = try { ConnectionSource.valueOf(savedSourceStr) } catch (e: Exception) { ConnectionSource.CLOUD }

    var selectedSource by remember { mutableStateOf(initialSource) }
    var roomId by remember { mutableStateOf(prefs.getString("room_id", initialRoomId) ?: initialRoomId) }
    var inputRoomId by remember { mutableStateOf(roomId) }
    var webViewInstance by remember { mutableStateOf<WebView?>(null) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(roomId, selectedSource) {
        prefs.edit()
            .putString("room_id", roomId)
            .putString("connection_source", selectedSource.name)
            .apply()
        PulseShareForegroundService.start(context, roomId, forceReconnect = true)
    }

    // Continuous Background Auto-Sync Loop: Keeps room synchronized without reloading page
    LaunchedEffect(roomId, selectedSource) {
        while (true) {
            kotlinx.coroutines.delay(4000)
            val current = webViewInstance
            if (current != null) {
                val targetUrl = "${selectedSource.baseUrl}/?room=$roomId"
                val webUrl = current.url

                // Only load if webView is uninitialized or on a wrong site
                if (webUrl.isNullOrBlank() || webUrl == "about:blank" || !webUrl.startsWith(selectedSource.baseUrl)) {
                    isLoading = true
                    current.loadUrl(targetUrl)
                } else {
                    // Smoothly ensure currentRoomId matches without page reload
                    val syncScript = """
                        (function() {
                            if (typeof window.switchRoom === 'function' && window.currentRoomId !== '$roomId') {
                                window.switchRoom('$roomId');
                            }
                        })();
                    """.trimIndent()
                    current.evaluateJavascript(syncScript, null)
                }
            }
        }
    }

    val lifecycleOwner = androidx.compose.ui.platform.LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = androidx.lifecycle.LifecycleEventObserver { _, event ->
            if (event == androidx.lifecycle.Lifecycle.Event.ON_RESUME) {
                PulseShareForegroundService.start(context, roomId, forceReconnect = true)
                val current = webViewInstance
                if (current != null) {
                    val targetUrl = "${selectedSource.baseUrl}/?room=$roomId"
                    val webUrl = current.url
                    if (webUrl.isNullOrBlank() || webUrl == "about:blank" || !webUrl.startsWith(selectedSource.baseUrl)) {
                        isLoading = true
                        current.loadUrl(targetUrl)
                    } else {
                        current.evaluateJavascript("""
                            (function() {
                                if (typeof window.switchRoom === 'function' && window.currentRoomId !== '$roomId') {
                                    window.switchRoom('$roomId');
                                }
                            })();
                        """.trimIndent(), null)
                    }
                }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // Auto-sync debounce: Automatically pairs without clicking Sync button
    LaunchedEffect(inputRoomId) {
        if (inputRoomId.isNotBlank() && inputRoomId.trim() != roomId && inputRoomId.trim().length >= 4) {
            kotlinx.coroutines.delay(800)
            roomId = inputRoomId.trim()
            isLoading = true
            webViewInstance?.loadUrl("${selectedSource.baseUrl}/?room=$roomId")
        }
    }

    LaunchedEffect(pendingFilesToSend, webViewInstance) {
        if (pendingFilesToSend.isNotEmpty() && webViewInstance != null) {
            val jsonArray = JSONArray()
            withContext(Dispatchers.IO) {
                for (item in pendingFilesToSend) {
                    try {
                        val uri = item.realUri
                        if (uri != null) {
                            val inputStream = context.contentResolver.openInputStream(uri)
                            if (inputStream != null) {
                                val bytes = inputStream.readBytes()
                                inputStream.close()
                                val mimeType = context.contentResolver.getType(uri) ?: "application/octet-stream"
                                val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                                val dataUrl = "data:$mimeType;base64,$base64"
                                val obj = JSONObject().apply {
                                    put("name", item.title)
                                    put("type", mimeType)
                                    put("dataUrl", dataUrl)
                                }
                                jsonArray.put(obj)
                            }
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }
            if (jsonArray.length() > 0) {
                val script = "if (window.sendNativeFiles) { window.sendNativeFiles($jsonArray); }"
                webViewInstance?.evaluateJavascript(script, null)
                Toast.makeText(context, "Streaming ${jsonArray.length()} item(s) to Laptop...", Toast.LENGTH_SHORT).show()
                onFilesHandled()
            }
        }
    }

    var filePathCallback by remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }

    // Native File Picker Launcher for WebDrop
    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val intent = result.data
            val uris = mutableListOf<Uri>()
            if (intent?.data != null) {
                uris.add(intent.data!!)
            } else if (intent?.clipData != null) {
                val clipData = intent.clipData!!
                for (i in 0 until clipData.itemCount) {
                    uris.add(clipData.getItemAt(i).uri)
                }
            }
            filePathCallback?.onReceiveValue(uris.toTypedArray())
        } else {
            filePathCallback?.onReceiveValue(null)
        }
        filePathCallback = null
    }

    val currentUrl = remember(roomId, selectedSource) {
        "${selectedSource.baseUrl}/?room=$roomId"
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
    ) {
        // Top Room Pairing & Hybrid Mode Bar
        Surface(
            color = DarkSurface,
            tonalElevation = 6.dp,
            border = androidx.compose.foundation.BorderStroke(1.dp, BorderLight),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)) {
                // Row 1: Source Switcher (Cloud vs Local PC) + Room Pill
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Segmented Mode Switcher
                    Row(
                        modifier = Modifier
                            .background(DarkSurfaceVariant, RoundedCornerShape(10.dp))
                            .border(1.dp, BorderLight, RoundedCornerShape(10.dp))
                            .padding(2.dp)
                    ) {
                        ConnectionSource.values().forEach { source ->
                            val isSelected = selectedSource == source
                            Box(
                                modifier = Modifier
                                    .background(
                                        if (isSelected) CyanPrimary.copy(alpha = 0.25f) else Color.Transparent,
                                        RoundedCornerShape(8.dp)
                                    )
                                    .border(
                                        1.dp,
                                        if (isSelected) CyanPrimary else Color.Transparent,
                                        RoundedCornerShape(8.dp)
                                    )
                                    .clickable {
                                        if (selectedSource != source) {
                                            selectedSource = source
                                            isLoading = true
                                            webViewInstance?.loadUrl("${source.baseUrl}/?room=$roomId")
                                        }
                                    }
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    "${source.icon} ${source.title}",
                                    fontSize = 11.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                    color = if (isSelected) CyanPrimary else TextMuted
                                )
                            }
                        }
                    }

                    // Room Pill with Auto-Paired Live Indicator
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = CyanPrimary.copy(alpha = 0.15f),
                        border = androidx.compose.foundation.BorderStroke(1.dp, CyanPrimary.copy(alpha = 0.4f))
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .background(Color(0xFF10B981), androidx.compose.foundation.shape.CircleShape)
                            )
                            Spacer(modifier = Modifier.width(5.dp))
                            Text(
                                "Auto-Paired: $roomId",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = CyanPrimary
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(6.dp))

                // Row 2: Room Code Input + Sync & Refresh
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = inputRoomId,
                        onValueChange = { inputRoomId = it.uppercase() },
                        placeholder = { Text("Code (e.g. PULSE1)", fontSize = 11.sp, color = TextMuted) },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        shape = RoundedCornerShape(10.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = DarkSurfaceVariant,
                            unfocusedContainerColor = DarkSurfaceVariant,
                            focusedBorderColor = CyanPrimary,
                            unfocusedBorderColor = BorderLight,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )

                    Button(
                        onClick = {
                            if (inputRoomId.isNotBlank()) {
                                roomId = inputRoomId.trim()
                                isLoading = true
                                webViewInstance?.loadUrl("${selectedSource.baseUrl}/?room=$roomId")
                                PulseShareForegroundService.start(context, roomId, forceReconnect = true)
                                Toast.makeText(context, "Force Synced: $roomId", Toast.LENGTH_SHORT).show()
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = CyanPrimary),
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text("🟢 Auto-Synced", color = Color.Black, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                    }

                    IconButton(
                        onClick = {
                            isLoading = true
                            webViewInstance?.reload()
                        },
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = "Reload", tint = TextSecondary)
                    }
                }
            }
        }

        // WebDrop Live WebRTC WebView
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        ) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { ctx ->
                    WebView(ctx).apply {
                        webViewInstance = this
                        settings.apply {
                            javaScriptEnabled = true
                            domStorageEnabled = true
                            allowFileAccess = true
                            allowContentAccess = true
                            databaseEnabled = true
                            mediaPlaybackRequiresUserGesture = false
                            useWideViewPort = true
                            loadWithOverviewMode = true
                            cacheMode = WebSettings.LOAD_DEFAULT
                            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                                offscreenPreRaster = true
                            }
                        }

                        // Register Native PulseShare Bridge for saving received files & auto-pairing
                        addJavascriptInterface(PulseShareBridge(ctx) { roomId }, "PulseShareBridge")

                        webViewClient = object : WebViewClient() {
                            override fun onPageFinished(view: WebView?, url: String?) {
                                super.onPageFinished(view, url)
                                isLoading = false
                                val autoJoinScript = """
                                    (function() {
                                        var r = '$roomId';
                                        function tryJoin(retries) {
                                            if (typeof window.switchRoom === 'function') {
                                                window.switchRoom(r);
                                            } else if (retries < 50) {
                                                setTimeout(function() { tryJoin(retries + 1); }, 200);
                                            }
                                        }
                                        tryJoin(0);
                                    })();
                                """.trimIndent()
                                view?.evaluateJavascript(autoJoinScript, null)
                            }

                            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                                super.onReceivedError(view, request, error)
                                if (request?.isForMainFrame == true) {
                                    android.util.Log.w("WebDropScreen", "WebView connection lost. Auto-reconnecting in 2.5s...")
                                    view?.postDelayed({
                                        if (view.url != null) {
                                            view.reload()
                                        } else {
                                            view.loadUrl("${selectedSource.baseUrl}/?room=$roomId")
                                        }
                                    }, 2500)
                                }
                            }
                        }

                        // Native File Picker & Camera Permissions Bridge for WebDrop!
                        webChromeClient = object : WebChromeClient() {
                            override fun onPermissionRequest(request: PermissionRequest?) {
                                // Automatically grant camera permission for QR scanner
                                request?.grant(request.resources)
                            }

                            override fun onShowFileChooser(
                                webView: WebView?,
                                callback: ValueCallback<Array<Uri>>?,
                                fileChooserParams: FileChooserParams?
                            ): Boolean {
                                filePathCallback?.onReceiveValue(null)
                                filePathCallback = callback

                                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                                    type = "*/*"
                                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                                }
                                filePickerLauncher.launch(intent)
                                return true
                            }
                        }

                        // Fallback Download Listener
                        setDownloadListener { url, userAgent, contentDisposition, mimetype, contentLength ->
                            try {
                                val intent = Intent(Intent.ACTION_VIEW)
                                intent.data = Uri.parse(url)
                                ctx.startActivity(intent)
                                Toast.makeText(ctx, "Downloading file...", Toast.LENGTH_SHORT).show()
                            } catch (e: Exception) {
                                Toast.makeText(ctx, "Download error: ${e.message}", Toast.LENGTH_SHORT).show()
                            }
                        }

                        loadUrl(currentUrl)
                    }
                },
                update = { webView ->
                    webViewInstance = webView
                }
            )

            if (isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(DarkBackground.copy(alpha = 0.85f)),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = CyanPrimary)
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            "Connecting to ${selectedSource.title}...",
                            color = TextPrimary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            currentUrl,
                            color = TextMuted,
                            fontSize = 11.sp
                        )
                    }
                }
            }
        }
    }
}
