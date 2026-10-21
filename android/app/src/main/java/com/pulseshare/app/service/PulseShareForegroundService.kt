package com.pulseshare.app.service

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiManager
import android.os.*
import android.util.Base64
import android.util.Log
import android.widget.Toast
import androidx.core.app.NotificationCompat
import com.pulseshare.app.MainActivity
import com.pulseshare.app.data.DeviceHardwareHelper
import com.pulseshare.app.data.DeviceMediaHelper
import com.pulseshare.app.data.DeviceTelemetryHelper
import com.pulseshare.app.data.DeviceContactsHelper
import com.pulseshare.app.data.DeviceClipboardHelper
import android.content.ClipboardManager
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.asRequestBody
import org.eclipse.paho.client.mqttv3.*
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.URLEncoder
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

object ConnectionStateHolder {
    val isConnectedToLaptop = androidx.compose.runtime.mutableStateOf(false)
    val laptopName = androidx.compose.runtime.mutableStateOf("Laptop PC")
    val connectedRoom = androidx.compose.runtime.mutableStateOf("PULSE1")
}

class PulseShareForegroundService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private var multicastLock: WifiManager.MulticastLock? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var isLocalWsConnected = false
    private var mqttClient: MqttAsyncClient? = null
    private var localWebSocket: WebSocket? = null
    private var serverHost = "192.168.1.5"
    private val inFlightFiles = ConcurrentHashMap<String, Long>()
    private val okHttpClient = OkHttpClient.Builder()
        .pingInterval(15, TimeUnit.SECONDS)
        .connectTimeout(10, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    private val serviceHandler = Handler(Looper.getMainLooper())
    private var isDestroyed = false
    private var currentRoomId = "PULSE1"
    private var heartbeatExecutor: ScheduledExecutorService? = null
    private val mediaExecutor = Executors.newSingleThreadExecutor()
    private var lastStatusText = "Background Active • Vibrate, Flashlight & Transfers Ready"
    private var clipboardManager: ClipboardManager? = null
    private var clipListener: ClipboardManager.OnPrimaryClipChangedListener? = null
    private var lastClipText: String = ""

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startClipboardMonitor()

        // 1. Acquire WakeLock for deep-sleep CPU survival
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "PulseShare::BackgroundSyncWakeLock"
        ).apply {
            setReferenceCounted(false)
            acquire(24 * 60 * 60 * 1000L)
        }

        // 2. Acquire High-Performance WifiLock and MulticastLock to keep Wi-Fi chip awake during screen-off
        try {
            val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            wifiLock = wifiManager.createWifiLock(
                WifiManager.WIFI_MODE_FULL_HIGH_PERF,
                "PulseShare::BackgroundWifiLock"
            ).apply {
                setReferenceCounted(false)
                acquire()
            }
            multicastLock = wifiManager.createMulticastLock("PulseShare::MulticastLock").apply {
                setReferenceCounted(true)
                acquire()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to acquire WifiLock/MulticastLock: ${e.message}")
        }

        // 3. Register Instant Network Reconnect Callback
        registerNetworkCallback()

        // 4. Start Native Background Listeners
        startBackgroundMqtt()
        startLocalWebSocket()

        // 5. Start 20-Second Anti-Timeout Live Telemetry Heartbeat & Auto-Sync
        startHeartbeat()

        // 6. Schedule AlarmManager Watchdog for 24/7 Deep Sleep Immunity
        scheduleWatchdogAlarm()
    }

    private fun registerNetworkCallback() {
        try {
            val connManager = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
            networkCallback = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    Log.d(TAG, "⚡ Network Interface Available! Staggering auto-reconnect sequence...")
                    scheduleStaggeredReconnect("Network Available")
                }

                override fun onCapabilitiesChanged(network: Network, networkCapabilities: NetworkCapabilities) {
                    val hasInternet = networkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    val isValidated = networkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
                    Log.d(TAG, "⚡ Network Capabilities: Internet=$hasInternet, Validated=$isValidated")
                    if (hasInternet && (!isLocalWsConnected || localWebSocket == null)) {
                        scheduleStaggeredReconnect("Capabilities Validated")
                    }
                }

                override fun onLost(network: Network) {
                    Log.w(TAG, "Network Lost. Sockets marked offline until network returns.")
                    isLocalWsConnected = false
                    localWebSocket = null
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                connManager.registerDefaultNetworkCallback(networkCallback!!)
            } else {
                val request = NetworkRequest.Builder()
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    .build()
                connManager.registerNetworkCallback(request, networkCallback!!)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to register NetworkCallback: ${e.message}")
        }
    }

    /**
     * Staggered Reconnection Sequence (500ms, 2000ms, 4500ms, 8000ms)
     * Solves the Wi-Fi toggled issue: when Wi-Fi is toggled on, DHCP takes 1-2 seconds to obtain IP.
     * Retrying in staggered bursts guarantees instantaneous automatic reconnection without opening the app.
     */
    fun scheduleStaggeredReconnect(reason: String) {
        Log.d(TAG, "🔄 Staggered Reconnect Sequence initiated ($reason)")
        val delays = longArrayOf(500L, 2000L, 4500L, 8000L)
        for (delay in delays) {
            serviceHandler.postDelayed({
                if (isDestroyed) return@postDelayed
                if (!isLocalWsConnected || localWebSocket == null) {
                    Log.d(TAG, "🔄 Staggered reconnect ($delay ms) executing Local WebSocket connect...")
                    startLocalWebSocket()
                }
                if (mqttClient == null || !mqttClient!!.isConnected) {
                    Log.d(TAG, "🔄 Staggered reconnect ($delay ms) executing MQTT connect...")
                    startBackgroundMqtt()
                }
            }, delay)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        if (action == ACTION_NETWORK_RESTORED) {
            Log.d(TAG, "⚡ Received ACTION_NETWORK_RESTORED from NetworkChangeReceiver!")
            scheduleStaggeredReconnect("NetworkChangeReceiver Broadcast")
            scheduleWatchdogAlarm()
            return START_STICKY
        }
        if (action == ACTION_WATCHDOG_PING) {
            Log.d(TAG, "⏰ Received ACTION_WATCHDOG_PING from WatchdogAlarmReceiver!")
            if (!isLocalWsConnected || localWebSocket == null) {
                startLocalWebSocket()
            }
            if (mqttClient == null || !mqttClient!!.isConnected) {
                startBackgroundMqtt()
            }
            scheduleWatchdogAlarm()
            return START_STICKY
        }

        val newRoom = intent?.getStringExtra("ROOM_ID")
        val prefs = getSharedPreferences("pulseshare_prefs", Context.MODE_PRIVATE)

        val targetRoom = if (!newRoom.isNullOrBlank()) {
            newRoom.trim().uppercase()
        } else {
            prefs.getString("last_room_id", "PULSE1") ?: "PULSE1"
        }

        if (targetRoom != currentRoomId) {
            currentRoomId = targetRoom
            restartConnections()
        } else {
            // Room is unchanged: only reconnect individual offline transports
            scheduleStaggeredReconnect("onStartCommand")
        }

        // Persist room ID for boot survival
        prefs.edit().putString("last_room_id", currentRoomId).apply()
        ConnectionStateHolder.connectedRoom.value = currentRoomId

        // Always re-schedule watchdog alarm on any start intent
        scheduleWatchdogAlarm()

        val notification = buildForegroundNotification(lastStatusText)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC or ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        return START_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        Log.d(TAG, "onTaskRemoved: App swiped away. Resurrecting background service immediately...")
        try {
            val restartServiceIntent = Intent(applicationContext, PulseShareForegroundService::class.java).apply {
                setPackage(packageName)
                putExtra("ROOM_ID", currentRoomId)
            }
            val restartServicePendingIntent = PendingIntent.getService(
                applicationContext,
                1002,
                restartServiceIntent,
                PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
            )
            val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.ELAPSED_REALTIME_WAKEUP,
                SystemClock.elapsedRealtime() + 1000,
                restartServicePendingIntent
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error in onTaskRemoved resurrection: ${e.message}")
        }
    }

    private fun restartConnections() {
        try {
            mqttClient?.disconnect()
            localWebSocket?.close(1000, "Room Changed")
        } catch (e: Exception) {
            // ignore
        }
        startBackgroundMqtt()
        startLocalWebSocket()
        startHeartbeat()
    }

    /**
     * 25-Second Live Telemetry Heartbeat
     * 1) Sends fresh battery %, storage GB, RAM, apps count, and sensors to Laptop.
     * 2) Keeps MQTT and WiFi/cellular NAT connection alive 24/7 (preventing the 5-6 min sleep kill).
     * 3) Updates Android Lockscreen Persistent Notification with live battery & storage.
     */
    private fun startHeartbeat() {
        heartbeatExecutor?.shutdownNow()
        heartbeatExecutor = Executors.newSingleThreadScheduledExecutor()
        heartbeatExecutor?.scheduleAtFixedRate({
            if (isDestroyed) return@scheduleAtFixedRate
            try {
                // Auto-sync: automatically restore sockets if disconnected in background
                if (!isLocalWsConnected || localWebSocket == null) {
                    Log.d(TAG, "[Auto-Sync Heartbeat] Local WebSocket offline. Auto-connecting...")
                    startLocalWebSocket()
                }
                if (mqttClient == null || !mqttClient!!.isConnected) {
                    Log.d(TAG, "[Auto-Sync Heartbeat] MQTT offline. Auto-connecting...")
                    startBackgroundMqtt()
                }

                val telemetry = DeviceTelemetryHelper.getTelemetryJson(this@PulseShareForegroundService)
                telemetry.put("roomId", currentRoomId)
                val rawStr = telemetry.toString()

                // 1. Send via MQTT to Laptop
                if (mqttClient != null && mqttClient!!.isConnected) {
                    val msg = MqttMessage(rawStr.toByteArray()).apply { qos = 0 }
                    try {
                        mqttClient?.publish("webdrop/v2/$currentRoomId/telemetry", msg)
                        mqttClient?.publish("webdrop/v2/$currentRoomId/signal/broadcast", msg)
                    } catch (e: Exception) {
                        Log.w(TAG, "MQTT Telemetry publish error: ${e.message}")
                    }
                }

                // 2. Send via Local WebSocket
                try {
                    localWebSocket?.send(rawStr)
                } catch (e: Exception) {
                    // ignore
                }

                // 3. Update Foreground Notification with live battery & storage metrics
                val batteryObj = telemetry.optJSONObject("battery")
                val storageObj = telemetry.optJSONObject("storage")
                val batLevel = batteryObj?.optInt("level", -1) ?: -1
                val isCharging = batteryObj?.optBoolean("isCharging", false) ?: false
                val isLow = batteryObj?.optBoolean("isLow", false) ?: false
                val storageUsed = storageObj?.optString("usedGB", "") ?: ""
                val storageTotal = storageObj?.optString("totalGB", "") ?: ""

                val notifText = buildString {
                    append(if (isLow) "⚠️ Low Battery" else "⚡ Active")
                    if (batLevel >= 0) append(" • 🔋 $batLevel%${if (isCharging) " ⚡" else ""}")
                    if (storageUsed.isNotBlank()) append(" • 💾 ${storageUsed}/${storageTotal}GB")
                    append(" (Room: $currentRoomId)")
                }
                lastStatusText = notifText

                val manager = getSystemService(NotificationManager::class.java)
                manager?.notify(NOTIFICATION_ID, buildForegroundNotification(notifText))

            } catch (e: Exception) {
                Log.w(TAG, "Heartbeat exception: ${e.message}")
            }
        }, 2, 20, TimeUnit.SECONDS)
    }

    /**
     * AlarmManager Watchdog scheduled every 2 minutes.
     * Guarantees wakeup even if HiOS / Tecno Power Marathon enters aggressive Doze mode.
     */
    private fun scheduleWatchdogAlarm() {
        try {
            val alarmManager = getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val intent = Intent(this, com.pulseshare.app.receiver.WatchdogAlarmReceiver::class.java).apply {
                action = "com.pulseshare.app.ACTION_WATCHDOG_WAKEUP"
                putExtra("ROOM_ID", currentRoomId)
            }
            val pendingIntent = PendingIntent.getBroadcast(
                this,
                WATCHDOG_REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val triggerAtMillis = SystemClock.elapsedRealtime() + (2 * 60 * 1000L) // 2 minutes
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    triggerAtMillis,
                    pendingIntent
                )
            } else {
                alarmManager.set(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    triggerAtMillis,
                    pendingIntent
                )
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to schedule AlarmManager watchdog: ${e.message}")
        }
    }

    /**
     * Native Background MQTT Client (Survives app swipe-away & background multitasking)
     */
    private fun startBackgroundMqtt() {
        if (isDestroyed) return

        Thread {
            try {
                val brokerUrl = "tcp://broker.emqx.io:1883"
                val clientId = "pulseshare_native_${Build.MODEL.replace(" ", "_")}_${System.currentTimeMillis() % 10000}"
                val client = MqttAsyncClient(brokerUrl, clientId, MemoryPersistence())
                mqttClient = client

                val options = MqttConnectOptions().apply {
                    isCleanSession = true
                    connectionTimeout = 10
                    keepAliveInterval = 25
                    isAutomaticReconnect = true
                }

                client.setCallback(object : MqttCallbackExtended {
                    override fun connectComplete(reconnect: Boolean, serverURI: String?) {
                        Log.d(TAG, "Native MQTT Connected to $serverURI (reconnect=$reconnect)")
                        try {
                            client.subscribe("webdrop/v2/$currentRoomId/#", 1)
                            client.subscribe("webdrop/v2/+/signal/#", 1)
                        } catch (e: Exception) {
                            Log.e(TAG, "MQTT Subscribe error: ${e.message}")
                        }
                    }

                    override fun connectionLost(cause: Throwable?) {
                        Log.w(TAG, "Native MQTT Connection lost: ${cause?.message}")
                    }

                    override fun messageArrived(topic: String?, message: MqttMessage?) {
                        if (message == null) return
                        val payload = String(message.payload)
                        try {
                            val json = JSONObject(payload)
                            val from = json.optString("from", "")
                            if (from.startsWith("android_") || from.contains("mobile")) {
                                return
                            }
                        } catch (e: Exception) {}
                        handleIncomingPayload(payload)
                    }

                    override fun deliveryComplete(token: IMqttDeliveryToken?) {}
                })

                client.connect(options)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start Native MQTT: ${e.message}")
                serviceHandler.postDelayed({
                    if (!isDestroyed && (mqttClient == null || !mqttClient!!.isConnected)) {
                        startBackgroundMqtt()
                    }
                }, 10000)
            }
        }.start()
    }

    /**
     * Native Local WebSocket Client for offline gigabit PC transfer
     */
    private fun startLocalWebSocket() {
        if (isDestroyed) return
        if (isLocalWsConnected && localWebSocket != null) return

        try {
            localWebSocket?.cancel()
        } catch (e: Exception) {}
        localWebSocket = null

        val prefs = getSharedPreferences("pulseshare_prefs", Context.MODE_PRIVATE)
        val savedRoom = prefs.getString("room_id", currentRoomId) ?: currentRoomId
        currentRoomId = savedRoom

        val savedIp = prefs.getString("last_lan_ip", serverHost) ?: serverHost
        if (savedIp.isNotBlank()) {
            serverHost = savedIp
        }

        val request = Request.Builder()
            .url("ws://$serverHost:3000/ws")
            .build()

        localWebSocket = okHttpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                isLocalWsConnected = true
                Log.d(TAG, "Native Local WebSocket Connected to PC (Room: $currentRoomId)")
                val telemetry = DeviceTelemetryHelper.getTelemetryJson(this@PulseShareForegroundService)
                val devObj = telemetry.optJSONObject("device")
                val osVersion = devObj?.optString("osVersion", "Android 14") ?: "Android 14"
                val model = devObj?.optString("model", Build.MODEL) ?: Build.MODEL
                val mfr = devObj?.optString("manufacturer", Build.MANUFACTURER) ?: Build.MANUFACTURER
                val devName = "$mfr $model".trim()

                val persistentDeviceId = telemetry.optString("peerId", "android_" + Build.MODEL.replace(" ", "_").lowercase())
                val joinMsg = JSONObject().apply {
                    put("type", "join_room")
                    put("roomId", currentRoomId)
                    put("deviceInfo", JSONObject().apply {
                        put("id", persistentDeviceId)
                        put("name", devName)
                        put("type", "mobile")
                        put("os", osVersion)
                        put("browser", "PulseShare Service")
                        put("telemetry", telemetry)
                    })
                }
                webSocket.send(joinMsg.toString())

                // Immediately send live telemetry frame to PC
                telemetry.put("roomId", currentRoomId)
                webSocket.send(telemetry.toString())
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val jsonObj = JSONObject(text)
                    val type = jsonObj.optString("type")
                    if (type == "room_joined") {
                        val joinedRoom = jsonObj.optString("roomId")
                        if (joinedRoom.isNotBlank() && joinedRoom != currentRoomId) {
                            Log.d(TAG, "[Auto-Pair] Server automatically paired mobile service into active room: $joinedRoom")
                            currentRoomId = joinedRoom
                        }
                        val lanIp = jsonObj.optString("lanIp")
                        if (lanIp.isNotBlank()) {
                            serverHost = lanIp
                            getSharedPreferences("pulseshare_prefs", Context.MODE_PRIVATE)
                                .edit()
                                .putString("last_lan_ip", lanIp)
                                .apply()
                            Log.d(TAG, "⚡ Updated PC Server Host IP to $serverHost")
                        }
                        val peersArray = jsonObj.optJSONArray("peers")
                        var hasLaptop = false
                        var pcName = "Laptop PC"
                        if (peersArray != null) {
                            for (i in 0 until peersArray.length()) {
                                val p = peersArray.getJSONObject(i)
                                val dev = p.optJSONObject("deviceInfo")
                                val pType = dev?.optString("type") ?: ""
                                if (pType != "mobile" && pType != "phone") {
                                    hasLaptop = true
                                    pcName = dev?.optString("name") ?: "Laptop PC"
                                    break
                                }
                            }
                        }
                        serviceHandler.post {
                            ConnectionStateHolder.isConnectedToLaptop.value = hasLaptop
                            ConnectionStateHolder.laptopName.value = pcName
                            ConnectionStateHolder.connectedRoom.value = currentRoomId
                        }
                    } else if (type == "peer_join") {
                        val dev = jsonObj.optJSONObject("deviceInfo")
                        val pType = dev?.optString("type") ?: ""
                        if (pType != "mobile" && pType != "phone") {
                            val pcName = dev?.optString("name") ?: "Laptop PC"
                            serviceHandler.post {
                                ConnectionStateHolder.isConnectedToLaptop.value = true
                                ConnectionStateHolder.laptopName.value = pcName
                                Toast.makeText(this@PulseShareForegroundService, "🟢 Paired with $pcName!", Toast.LENGTH_SHORT).show()
                            }
                        }
                    } else if (type == "peer_leave") {
                        serviceHandler.post {
                            ConnectionStateHolder.isConnectedToLaptop.value = false
                        }
                    }
                } catch (e: Exception) {}
                handleIncomingPayload(text)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                if (localWebSocket != null && localWebSocket != webSocket) return
                isLocalWsConnected = false
                localWebSocket = null
                serviceHandler.post { ConnectionStateHolder.isConnectedToLaptop.value = false }
                Log.w(TAG, "Local WebSocket failed: ${t.message}. Will auto-reconnect in 3s...")
                serviceHandler.postDelayed({
                    if (!isDestroyed && !isLocalWsConnected) startLocalWebSocket()
                }, 3000)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                if (localWebSocket != null && localWebSocket != webSocket) return
                isLocalWsConnected = false
                localWebSocket = null
                serviceHandler.post { ConnectionStateHolder.isConnectedToLaptop.value = false }
                if (reason.contains("Replaced", ignoreCase = true)) {
                    Log.d(TAG, "Local WebSocket was replaced by newer session; skipping reconnect.")
                    return
                }
                Log.w(TAG, "Local WebSocket closed ($code, $reason). Will auto-reconnect in 3s...")
                serviceHandler.postDelayed({
                    if (!isDestroyed && !isLocalWsConnected) startLocalWebSocket()
                }, 3000)
            }
        })
    }

    /**
     * Centralized Native Hardware Command Dispatcher
     */
    private fun handleIncomingPayload(rawJson: String) {
        try {
            val json = JSONObject(rawJson)
            val cmd = when {
                json.has("signal") && json.getJSONObject("signal").optString("type") == "device_command" ->
                    json.getJSONObject("signal")
                json.optString("type") == "device_command" ->
                    json
                else -> null
            }

            if (cmd != null) {
                val action = cmd.optString("action")
                Log.d(TAG, "Executing Remote Command in Background: $action (Payload: $cmd)")

                serviceHandler.post {
                    when (action) {
                        "vibrate" -> {
                            val duration = cmd.optLong("durationMs", 1500L)
                            DeviceHardwareHelper.vibrate(this@PulseShareForegroundService, duration)
                        }

                        "torch_toggle" -> {
                            val state = DeviceHardwareHelper.toggleFlashlight(this@PulseShareForegroundService)
                            val resp = JSONObject().apply {
                                put("type", "torch_state")
                                put("enabled", state)
                                put("roomId", currentRoomId)
                            }
                            sendPayloadToLaptop(resp.toString())
                            Toast.makeText(this@PulseShareForegroundService, if (state) "🔦 Flashlight ON" else "🔦 Flashlight OFF", Toast.LENGTH_SHORT).show()
                        }

                        "torch_set" -> {
                            val enable = cmd.optBoolean("enabled", false)
                            DeviceHardwareHelper.setFlashlight(this@PulseShareForegroundService, enable)
                            val resp = JSONObject().apply {
                                put("type", "torch_state")
                                put("enabled", enable)
                                put("roomId", currentRoomId)
                            }
                            sendPayloadToLaptop(resp.toString())
                        }

                        "find_my_phone" -> {
                            val isEnabled = cmd.optBoolean("enabled", true)
                            if (isEnabled) {
                                DeviceHardwareHelper.startFindMyPhoneAlert(this@PulseShareForegroundService)
                            } else {
                                DeviceHardwareHelper.stopFindMyPhoneAlert(this@PulseShareForegroundService)
                            }
                        }

                        "get_phone_location" -> {
                            fetchAndSendLocation()
                        }

                        "get_remote_media" -> {
                            val category = cmd.optString("category", "ALL")
                            val limit = cmd.optInt("limit", 10000)
                            val album = cmd.optString("album", "")
                            val offset = cmd.optInt("offset", 0)
                            fetchAndSendRemoteMedia(category, limit, album, offset)
                        }

                        "fetch_remote_file" -> {
                            val fileId = cmd.optString("fileId", "")
                            if (fileId.isNotBlank()) {
                                fetchAndSendRemoteFile(fileId)
                            }
                        }

                        "set_wallpaper" -> {
                            val screen = cmd.optString("screen", "both")
                            val fileId = cmd.optString("fileId", "")
                            val base64Data = cmd.optString("base64Data", "")
                            handleSetWallpaper(fileId, base64Data, screen)
                        }

                        "scan_folders", "get_remote_folders" -> {
                            fetchAndSendFolders()
                        }

                        "get_folder_items" -> {
                            val folderName = cmd.optString("folderName", "")
                            val limit = cmd.optInt("limit", 10000)
                            val offset = cmd.optInt("offset", 0)
                            fetchAndSendFolderItems(folderName, limit, offset)
                        }

                        "download_zip", "bundle_zip" -> {
                            val taskId = cmd.optString("taskId", "zip_${System.currentTimeMillis()}")
                            val zipName = cmd.optString("zipName", "Media_Bundle.zip")
                            val folderName = cmd.optString("folderName", "")
                            val fileIdsArray = cmd.optJSONArray("fileIds")
                            if (fileIdsArray != null && fileIdsArray.length() > 0) {
                                val ids = mutableListOf<String>()
                                for (i in 0 until fileIdsArray.length()) {
                                    ids.add(fileIdsArray.getString(i))
                                }
                                fetchAndSendZipArchive(ids, zipName, taskId)
                            } else if (folderName.isNotBlank()) {
                                fetchAndSendFolderZip(folderName, taskId)
                            }
                        }

                        "get_contacts", "get_remote_contacts" -> {
                            val query = cmd.optString("query", "")
                            val onlyFav = cmd.optBoolean("onlyFavorites", false)
                            val limit = cmd.optInt("limit", 30)
                            val offset = cmd.optInt("offset", 0)
                            fetchAndSendContacts(query, onlyFav, limit, offset)
                        }

                        "get_clipboard_history" -> {
                            sendClipboardHistory()
                        }

                        "clear_clipboard_history" -> {
                            DeviceClipboardHelper.clearHistory(this@PulseShareForegroundService)
                            sendClipboardHistory()
                        }

                        "set_phone_clipboard" -> {
                            val text = cmd.optString("text", "")
                            if (text.isNotBlank()) {
                                serviceHandler.post {
                                    lastClipText = text
                                    val success = DeviceClipboardHelper.setPrimaryClip(this@PulseShareForegroundService, text)
                                    if (success) {
                                        Toast.makeText(this@PulseShareForegroundService, "📋 Copied text from Laptop!", Toast.LENGTH_SHORT).show()
                                    }
                                    sendClipboardHistory()
                                }
                            }
                        }
                    }
                }
            } else {
                // Check direct non-command signals
                val directType = json.optString("type")
                when (directType) {
                    "torch_toggle", "flashlight_toggle", "toggle_flashlight" -> {
                        val state = DeviceHardwareHelper.toggleFlashlight(this@PulseShareForegroundService)
                        val resp = JSONObject().apply {
                            put("type", "torch_state")
                            put("enabled", state)
                            put("roomId", currentRoomId)
                        }
                        sendPayloadToLaptop(resp.toString())
                        Toast.makeText(this@PulseShareForegroundService, if (state) "🔦 Flashlight ON" else "🔦 Flashlight OFF", Toast.LENGTH_SHORT).show()
                    }
                    "torch_set" -> {
                        val enable = json.optBoolean("enabled", false)
                        DeviceHardwareHelper.setFlashlight(this@PulseShareForegroundService, enable)
                        val resp = JSONObject().apply {
                            put("type", "torch_state")
                            put("enabled", enable)
                            put("roomId", currentRoomId)
                        }
                        sendPayloadToLaptop(resp.toString())
                    }
                    "vibrate" -> {
                        val duration = json.optLong("duration", 1500L)
                        DeviceHardwareHelper.vibrate(this@PulseShareForegroundService, duration)
                        Toast.makeText(this@PulseShareForegroundService, "📳 Buzz!", Toast.LENGTH_SHORT).show()
                    }
                    "find_my_phone_start" -> {
                        DeviceHardwareHelper.startFindMyPhoneAlert(this@PulseShareForegroundService)
                        Toast.makeText(this@PulseShareForegroundService, "🚨 FIND MY PHONE ACTIVE!", Toast.LENGTH_LONG).show()
                    }
                    "find_my_phone_stop" -> {
                        DeviceHardwareHelper.stopFindMyPhoneAlert(this@PulseShareForegroundService)
                        Toast.makeText(this@PulseShareForegroundService, "🚨 Alert Stopped", Toast.LENGTH_SHORT).show()
                    }
                    "get_phone_location" -> fetchAndSendLocation()
                    "scan_folders", "get_remote_folders" -> fetchAndSendFolders()
                    "get_contacts", "get_remote_contacts" -> {
                        val query = json.optString("query", "")
                        val onlyFav = json.optBoolean("onlyFavorites", false)
                        val limit = json.optInt("limit", 30)
                        val offset = json.optInt("offset", 0)
                        fetchAndSendContacts(query, onlyFav, limit, offset)
                    }
                    "get_clipboard_history" -> sendClipboardHistory()
                    "clear_clipboard_history" -> {
                        DeviceClipboardHelper.clearHistory(this@PulseShareForegroundService)
                        sendClipboardHistory()
                    }
                    "set_phone_clipboard" -> {
                        val text = json.optString("text", "")
                        if (text.isNotBlank()) {
                            serviceHandler.post {
                                lastClipText = text
                                val success = DeviceClipboardHelper.setPrimaryClip(this@PulseShareForegroundService, text)
                                if (success) {
                                    Toast.makeText(this@PulseShareForegroundService, "📋 Copied text from Laptop!", Toast.LENGTH_SHORT).show()
                                }
                                sendClipboardHistory()
                            }
                        }
                    }
                    "get_folder_items" -> {
                        val folderName = json.optString("folderName", "")
                        val limit = json.optInt("limit", 10000)
                        val offset = json.optInt("offset", 0)
                        fetchAndSendFolderItems(folderName, limit, offset)
                    }
                    "download_zip", "bundle_zip" -> {
                        val taskId = json.optString("taskId", "zip_${System.currentTimeMillis()}")
                        val zipName = json.optString("zipName", "Media_Bundle.zip")
                        val folderName = json.optString("folderName", "")
                        val fileIdsArray = json.optJSONArray("fileIds")
                        if (fileIdsArray != null && fileIdsArray.length() > 0) {
                            val ids = mutableListOf<String>()
                            for (i in 0 until fileIdsArray.length()) {
                                ids.add(fileIdsArray.getString(i))
                            }
                            fetchAndSendZipArchive(ids, zipName, taskId)
                        } else if (folderName.isNotBlank()) {
                            fetchAndSendFolderZip(folderName, taskId)
                        }
                    }
                    "get_remote_media" -> {
                        val category = json.optString("category", "ALL")
                        val limit = json.optInt("limit", 10000)
                        val album = json.optString("album", "")
                        val offset = json.optInt("offset", 0)
                        fetchAndSendRemoteMedia(category, limit, album, offset)
                    }
                    "fetch_remote_file" -> {
                        val fileId = json.optString("fileId", "")
                        if (fileId.isNotBlank()) fetchAndSendRemoteFile(fileId)
                    }
                    "set_wallpaper" -> {
                        val screen = json.optString("screen", "both")
                        val fileId = json.optString("fileId", "")
                        val base64Data = json.optString("base64Data", "")
                        handleSetWallpaper(fileId, base64Data, screen)
                    }
                }
            }
        } catch (e: Exception) {
            // Non-JSON or WebRTC packet
        }
    }

    private fun sendPayloadToLaptop(rawStr: String) {
        Thread {
            try {
                if (isLocalWsConnected && localWebSocket != null) {
                    localWebSocket?.send(rawStr)
                }
            } catch (e: Exception) {
                // ignore
            }

            // Dual-delivery: also send over MQTT if active and within broker packet limits (<60KB)
            try {
                if (mqttClient != null && mqttClient!!.isConnected && rawStr.length < 60000) {
                    val msg = MqttMessage(rawStr.toByteArray()).apply { qos = 0 }
                    mqttClient?.publish("webdrop/v2/$currentRoomId/signal/broadcast", msg)
                }
            } catch (e: Exception) {
                // ignore
            }
        }.start()
    }

    private fun fetchAndSendLocation() {
        Thread {
            try {
                val locManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
                val hasGps = locManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
                val hasNet = locManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)

                var bestLoc: Location? = null
                if (hasGps) {
                    try {
                        bestLoc = locManager.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                    } catch (e: SecurityException) {}
                }
                if (bestLoc == null && hasNet) {
                    try {
                        bestLoc = locManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
                    } catch (e: SecurityException) {}
                }

                val locObj = JSONObject().apply {
                    put("type", "phone_location")
                    put("roomId", currentRoomId)
                    put("timestamp", System.currentTimeMillis())
                    if (bestLoc != null) {
                        put("latitude", bestLoc.latitude)
                        put("longitude", bestLoc.longitude)
                        put("accuracy", bestLoc.accuracy)
                        put("provider", bestLoc.provider)
                        put("mapsUrl", "https://www.google.com/maps?q=${bestLoc.latitude},${bestLoc.longitude}")
                    } else {
                        put("error", "Location unavailable. Please ensure GPS/Location is enabled in phone settings.")
                    }
                }
                sendPayloadToLaptop(locObj.toString())
            } catch (e: Exception) {
                Log.e(TAG, "Error fetching location: ${e.message}")
            }
        }.start()
    }

    private fun sendProgress(taskId: String, percent: Int, total: Int, detail: String) {
        try {
            val progressObj = JSONObject().apply {
                put("type", "task_progress")
                put("roomId", currentRoomId)
                put("taskId", taskId)
                put("percent", percent)
                put("total", total)
                put("detail", detail)
            }
            sendPayloadToLaptop(progressObj.toString())
        } catch (e: Exception) {}
    }

    private fun fetchAndSendZipArchive(fileIds: List<String>, zipName: String, taskId: String) {
        mediaExecutor.execute {
            try {
                sendProgress(taskId, 0, fileIds.size, "Preparing archive...")
                val result = DeviceMediaHelper.createZipArchiveFile(
                    this@PulseShareForegroundService,
                    fileIds,
                    zipName
                ) { current, total ->
                    val percent = if (total > 0) (current * 90) / total else 0
                    sendProgress(taskId, percent, total, "Compressing item $current of $total...")
                }

                if (result != null) {
                    val (fileName, tempFile) = result
                    sendProgress(taskId, 92, fileIds.size, "Transferring archive to PC (${tempFile.length() / 1024} KB)...")
                    var downloadUrl: String? = null
                    try {
                        val mediaType = "application/zip".toMediaTypeOrNull()
                        val reqBody = tempFile.asRequestBody(mediaType)
                        val uploadReq = Request.Builder()
                            .url("http://$serverHost:3000/api/upload-bundle")
                            .header("x-file-name", URLEncoder.encode(fileName, "UTF-8"))
                            .post(reqBody)
                            .build()
                        val uploadResp = okHttpClient.newCall(uploadReq).execute()
                        if (uploadResp.isSuccessful) {
                            val respStr = uploadResp.body?.string() ?: ""
                            val respJson = JSONObject(respStr)
                            if (respJson.optBoolean("success")) {
                                downloadUrl = respJson.optString("downloadUrl")
                            }
                        }
                    } catch (uploadErr: Exception) {
                        Log.e(TAG, "Direct bundle HTTP upload failed: ${uploadErr.message}")
                    }

                    if (downloadUrl != null) {
                        val reply = JSONObject().apply {
                            put("type", "remote_zip_ready")
                            put("roomId", currentRoomId)
                            put("taskId", taskId)
                            put("name", fileName)
                            put("sizeBytes", tempFile.length())
                            put("downloadUrl", downloadUrl)
                        }
                        sendPayloadToLaptop(reply.toString())
                        sendProgress(taskId, 100, fileIds.size, "Archive ready! (${tempFile.length() / 1024} KB)")
                    } else if (tempFile.length() < 12 * 1024 * 1024) {
                        // Fallback to Base64 only if small
                        val bytes = tempFile.readBytes()
                        val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                        val reply = JSONObject().apply {
                            put("type", "remote_zip_ready")
                            put("roomId", currentRoomId)
                            put("taskId", taskId)
                            put("name", fileName)
                            put("sizeBytes", bytes.size)
                            put("dataUrl", "data:application/zip;base64,$base64")
                        }
                        sendPayloadToLaptop(reply.toString())
                        sendProgress(taskId, 100, fileIds.size, "Archive ready! (${bytes.size / 1024} KB)")
                    } else {
                        sendProgress(taskId, -1, 0, "ZIP size is ${tempFile.length() / (1024 * 1024)}MB. Direct upload failed.")
                    }
                    try { tempFile.delete() } catch (e: Exception) {}
                } else {
                    sendProgress(taskId, -1, 0, "Failed to create archive")
                }
            } catch (e: Throwable) {
                Log.e(TAG, "Error creating zip: ${e.message}")
                sendProgress(taskId, -1, 0, "Error: ${e.message}")
            }
        }
    }

    private fun fetchAndSendFolderZip(folderName: String, taskId: String) {
        mediaExecutor.execute {
            try {
                sendProgress(taskId, 0, 100, "Scanning folder $folderName...")
                val result = DeviceMediaHelper.createFolderZipArchiveFile(
                    this@PulseShareForegroundService,
                    folderName
                ) { current, total ->
                    val percent = if (total > 0) (current * 90) / total else 0
                    sendProgress(taskId, percent, total, "Compressing $folderName: $current of $total...")
                }

                if (result != null) {
                    val (fileName, tempFile) = result
                    sendProgress(taskId, 92, 100, "Transferring $folderName archive to PC (${tempFile.length() / 1024} KB)...")
                    var downloadUrl: String? = null
                    try {
                        val mediaType = "application/zip".toMediaTypeOrNull()
                        val reqBody = tempFile.asRequestBody(mediaType)
                        val uploadReq = Request.Builder()
                            .url("http://$serverHost:3000/api/upload-bundle")
                            .header("x-file-name", URLEncoder.encode(fileName, "UTF-8"))
                            .post(reqBody)
                            .build()
                        val uploadResp = okHttpClient.newCall(uploadReq).execute()
                        if (uploadResp.isSuccessful) {
                            val respStr = uploadResp.body?.string() ?: ""
                            val respJson = JSONObject(respStr)
                            if (respJson.optBoolean("success")) {
                                downloadUrl = respJson.optString("downloadUrl")
                            }
                        }
                    } catch (uploadErr: Exception) {
                        Log.e(TAG, "Direct bundle HTTP upload failed: ${uploadErr.message}")
                    }

                    if (downloadUrl != null) {
                        val reply = JSONObject().apply {
                            put("type", "remote_zip_ready")
                            put("roomId", currentRoomId)
                            put("taskId", taskId)
                            put("name", fileName)
                            put("sizeBytes", tempFile.length())
                            put("downloadUrl", downloadUrl)
                        }
                        sendPayloadToLaptop(reply.toString())
                        sendProgress(taskId, 100, 100, "Folder archive ready!")
                    } else if (tempFile.length() < 12 * 1024 * 1024) {
                        val bytes = tempFile.readBytes()
                        val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                        val reply = JSONObject().apply {
                            put("type", "remote_zip_ready")
                            put("roomId", currentRoomId)
                            put("taskId", taskId)
                            put("name", fileName)
                            put("sizeBytes", bytes.size)
                            put("dataUrl", "data:application/zip;base64,$base64")
                        }
                        sendPayloadToLaptop(reply.toString())
                        sendProgress(taskId, 100, 100, "Folder archive ready!")
                    } else {
                        sendProgress(taskId, -1, 0, "ZIP size is ${tempFile.length() / (1024 * 1024)}MB. Direct upload failed.")
                    }
                    try { tempFile.delete() } catch (e: Exception) {}
                } else {
                    sendProgress(taskId, -1, 0, "Failed to create folder archive")
                }
            } catch (e: Throwable) {
                Log.e(TAG, "Error creating folder zip: ${e.message}")
                sendProgress(taskId, -1, 0, "Error: ${e.message}")
            }
        }
    }

    private fun fetchAndSendRemoteMedia(category: String, limit: Int, album: String = "", offset: Int = 0) {
        mediaExecutor.execute {
            try {
                val mediaJson = DeviceMediaHelper.getRemoteGalleryJson(this@PulseShareForegroundService, category, limit, album, offset)
                mediaJson.put("roomId", currentRoomId)
                mediaJson.put("album", album)
                mediaJson.put("offset", offset)
                sendPayloadToLaptop(mediaJson.toString())
            } catch (e: Exception) {
                Log.e(TAG, "Error fetching remote gallery: ${e.message}")
            }
        }
    }

    private fun fetchAndSendFolders() {
        mediaExecutor.execute {
            try {
                val foldersJson = DeviceMediaHelper.getRemoteFoldersJson(this@PulseShareForegroundService)
                foldersJson.put("roomId", currentRoomId)
                sendPayloadToLaptop(foldersJson.toString())
                Log.d(TAG, "Sent remote folders list to laptop. Folders count: ${foldersJson.optInt("totalFolders")}")
            } catch (e: Exception) {
                Log.e(TAG, "Error fetching remote folders: ${e.message}")
                try {
                    val fallback = JSONObject().apply {
                        put("type", "remote_folders_list")
                        put("roomId", currentRoomId)
                        put("folders", JSONArray())
                        put("totalMedia", 0)
                        put("totalFolders", 0)
                        put("error", e.message ?: "Failed to scan folders")
                    }
                    sendPayloadToLaptop(fallback.toString())
                } catch (ex: Exception) {}
            }
        }
    }

    private fun fetchAndSendFolderItems(folderName: String, limit: Int, offset: Int) {
        mediaExecutor.execute {
            try {
                val itemsJson = DeviceMediaHelper.getFolderMediaItemsJson(this@PulseShareForegroundService, folderName, limit, offset)
                itemsJson.put("roomId", currentRoomId)
                sendPayloadToLaptop(itemsJson.toString())
                Log.d(TAG, "Sent folder items for $folderName to laptop. Items count: ${itemsJson.optInt("total")}")
            } catch (e: Exception) {
                Log.e(TAG, "Error fetching folder items: ${e.message}")
            }
        }
    }

    private fun handleSetWallpaper(fileId: String, base64Data: String, screen: String) {
        mediaExecutor.execute {
            try {
                var success = false
                if (fileId.isNotBlank()) {
                    success = DeviceHardwareHelper.setPhoneWallpaperFromFileId(this@PulseShareForegroundService, fileId, screen)
                } else if (base64Data.isNotBlank()) {
                    success = DeviceHardwareHelper.setPhoneWallpaperFromBase64(this@PulseShareForegroundService, base64Data, screen)
                }

                val screenName = when (screen.lowercase()) {
                    "home" -> "Home Screen"
                    "lock" -> "Lock Screen"
                    else -> "Home & Lock Screen"
                }

                serviceHandler.post {
                    if (success) {
                        android.widget.Toast.makeText(
                            this@PulseShareForegroundService,
                            "🎨 Wallpaper set ($screenName) from Laptop!",
                            android.widget.Toast.LENGTH_LONG
                        ).show()
                    } else {
                        android.widget.Toast.makeText(
                            this@PulseShareForegroundService,
                            "Failed to set wallpaper",
                            android.widget.Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                val reply = JSONObject().apply {
                    put("type", "wallpaper_set_result")
                    put("roomId", currentRoomId)
                    put("success", success)
                    put("screen", screen)
                    put("fileId", fileId)
                }
                sendPayloadToLaptop(reply.toString())
            } catch (e: Exception) {
                Log.e(TAG, "Error handling set_wallpaper: ${e.message}")
            }
        }
    }

    private fun fetchAndSendRemoteFile(fileId: String) {
        val now = System.currentTimeMillis()
        val last = inFlightFiles[fileId] ?: 0L
        if (now - last < 3500L) {
            Log.d(TAG, "Skipping duplicate in-flight fetch for $fileId")
            return
        }
        inFlightFiles[fileId] = now

        mediaExecutor.execute {
            try {
                val result = DeviceMediaHelper.getMediaFileBytes(this@PulseShareForegroundService, fileId)
                if (result != null) {
                    val (fileName, bytes) = result
                    val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                    val mime = if (fileId.startsWith("vid_")) "video/mp4" else "image/jpeg"
                    val fileObj = JSONObject().apply {
                        put("type", "remote_file_content")
                        put("roomId", currentRoomId)
                        put("fileId", fileId)
                        put("name", fileName)
                        put("mimeType", mime)
                        put("sizeBytes", bytes.size)
                        put("dataUrl", "data:$mime;base64,$base64")
                    }
                    sendPayloadToLaptop(fileObj.toString())
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error fetching remote file content: ${e.message}")
            }
        }
    }

    private fun startClipboardMonitor() {
        serviceHandler.post {
            try {
                clipboardManager = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                clipListener = ClipboardManager.OnPrimaryClipChangedListener {
                    try {
                        val clip = clipboardManager?.primaryClip
                        if (clip != null && clip.itemCount > 0) {
                            val text = clip.getItemAt(0)?.coerceToText(this@PulseShareForegroundService)?.toString() ?: ""
                            if (text.isNotBlank() && text != lastClipText) {
                                lastClipText = text
                                val clipObj = DeviceClipboardHelper.addClip(this@PulseShareForegroundService, text, "mobile")
                                if (clipObj != null) {
                                    val syncMsg = JSONObject().apply {
                                        put("type", "clipboard_sync")
                                        put("roomId", currentRoomId)
                                        put("clip", clipObj)
                                        put("history", DeviceClipboardHelper.getHistory(this@PulseShareForegroundService))
                                    }
                                    sendPayloadToLaptop(syncMsg.toString())
                                    Log.d(TAG, "📋 Synced copied mobile text to laptop: ${text.take(30)}...")
                                }
                            }
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Clipboard monitor read error: ${e.message}")
                    }
                }
                clipboardManager?.addPrimaryClipChangedListener(clipListener)
                Log.d(TAG, "⚡ Real-Time Clipboard Monitor registered successfully!")
            } catch (e: Exception) {
                Log.w(TAG, "Failed to register clipboard monitor: ${e.message}")
            }
        }
    }

    private fun sendClipboardHistory() {
        serviceHandler.post {
            try {
                val history = DeviceClipboardHelper.getHistory(this@PulseShareForegroundService)
                val msg = JSONObject().apply {
                    put("type", "remote_clipboard_history")
                    put("roomId", currentRoomId)
                    put("history", history)
                }
                sendPayloadToLaptop(msg.toString())
            } catch (e: Exception) {}
        }
    }

    private fun fetchAndSendContacts(query: String = "", onlyFavorites: Boolean = false, limit: Int = 30, offset: Int = 0) {
        mediaExecutor.execute {
            try {
                val json = DeviceContactsHelper.getDeviceContacts(
                    context = this@PulseShareForegroundService,
                    searchQuery = query,
                    onlyFavorites = onlyFavorites,
                    limit = limit,
                    offset = offset
                )
                json.put("roomId", currentRoomId)
                sendPayloadToLaptop(json.toString())
            } catch (e: Exception) {
                Log.e(TAG, "Error fetching contacts: ${e.message}")
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        isDestroyed = true
        heartbeatExecutor?.shutdownNow()
        mediaExecutor.shutdownNow()
        try {
            if (clipListener != null) {
                clipboardManager?.removePrimaryClipChangedListener(clipListener)
            }
        } catch (e: Exception) {}
        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
            if (wifiLock?.isHeld == true) wifiLock?.release()
            if (multicastLock?.isHeld == true) multicastLock?.release()
            val connManager = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            if (networkCallback != null) {
                connManager?.unregisterNetworkCallback(networkCallback!!)
            }
            mqttClient?.disconnect()
            localWebSocket?.close(1000, "Service destroyed")
        } catch (e: Exception) {
            // ignore
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildForegroundNotification(contentText: String = lastStatusText): Notification {
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            action = Intent.ACTION_MAIN
            addCategory(Intent.CATEGORY_LAUNCHER)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("⚡ PulseShare Connected to Laptop")
            .setContentText(contentText)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "PulseShare Background Sync",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps PulseShare connected to Laptop in the background"
                setShowBadge(false)
            }

            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    companion object {
        private const val TAG = "PulseShareService"
        const val CHANNEL_ID = "pulseshare_background_sync_channel"
        const val NOTIFICATION_ID = 1001
        const val WATCHDOG_REQUEST_CODE = 1002
        const val ACTION_NETWORK_RESTORED = "com.pulseshare.app.ACTION_NETWORK_RESTORED"
        const val ACTION_WATCHDOG_PING = "com.pulseshare.app.ACTION_WATCHDOG_PING"

        fun start(context: Context, roomId: String = "PULSE1", forceReconnect: Boolean = false) {
            val intent = Intent(context, PulseShareForegroundService::class.java).apply {
                putExtra("ROOM_ID", roomId)
                putExtra("FORCE_RECONNECT", forceReconnect)
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start service: ${e.message}")
            }
        }

        fun onNetworkRestored(context: Context) {
            val intent = Intent(context, PulseShareForegroundService::class.java).apply {
                action = ACTION_NETWORK_RESTORED
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to send onNetworkRestored: ${e.message}")
            }
        }

        fun pingWatchdog(context: Context) {
            val intent = Intent(context, PulseShareForegroundService::class.java).apply {
                action = ACTION_WATCHDOG_PING
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to send pingWatchdog: ${e.message}")
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, PulseShareForegroundService::class.java)
            context.stopService(intent)
        }
    }
}
