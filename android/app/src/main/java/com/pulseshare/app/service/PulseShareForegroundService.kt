package com.pulseshare.app.service

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.*
import android.util.Log
import androidx.core.app.NotificationCompat
import com.pulseshare.app.MainActivity
import com.pulseshare.app.data.DeviceHardwareHelper
import okhttp3.*
import org.eclipse.paho.client.mqttv3.*
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class PulseShareForegroundService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null
    private var mqttClient: MqttAsyncClient? = null
    private var localWebSocket: WebSocket? = null
    private val okHttpClient = OkHttpClient.Builder()
        .pingInterval(15, TimeUnit.SECONDS)
        .connectTimeout(5, TimeUnit.SECONDS)
        .build()

    private val serviceHandler = Handler(Looper.getMainLooper())
    private var isDestroyed = false
    private var currentRoomId = "PULSE1"

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()

        // 1. Acquire WakeLock for deep-sleep CPU survival
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "PulseShare::BackgroundSyncWakeLock"
        ).apply {
            setReferenceCounted(false)
            acquire(24 * 60 * 60 * 1000L)
        }

        // 2. Start Native Background Listeners
        startBackgroundMqtt()
        startLocalWebSocket()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val newRoom = intent?.getStringExtra("ROOM_ID")
        if (!newRoom.isNullOrBlank() && newRoom != currentRoomId) {
            currentRoomId = newRoom.trim().uppercase()
            restartConnections()
        }

        val notification = buildForegroundNotification()

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

    private fun restartConnections() {
        try {
            mqttClient?.disconnect()
            localWebSocket?.close(1000, "Room Changed")
        } catch (e: Exception) {
            // ignore
        }
        startBackgroundMqtt()
        startLocalWebSocket()
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
                    keepAliveInterval = 30
                    isAutomaticReconnect = true
                }

                client.setCallback(object : MqttCallbackExtended {
                    override fun connectComplete(reconnect: Boolean, serverURI: String?) {
                        Log.d(TAG, "Native MQTT Connected to $serverURI (reconnect=$reconnect)")
                        // Subscribe to room topics
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
                        handleIncomingPayload(payload)
                    }

                    override fun deliveryComplete(token: IMqttDeliveryToken?) {}
                })

                client.connect(options)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start Native MQTT: ${e.message}")
                // Retry in 10s if initial connection failed
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

        val request = Request.Builder()
            .url("ws://192.168.1.5:3000/ws")
            .build()

        localWebSocket = okHttpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d(TAG, "Native Local WebSocket Connected to PC")
                // Join room
                val joinMsg = JSONObject().apply {
                    put("type", "join_room")
                    put("roomId", currentRoomId)
                    put("deviceInfo", JSONObject().apply {
                        put("id", "tecno-camon-20-native")
                        put("name", "TECNO CAMON 20 (Background)")
                        put("type", "mobile")
                        put("os", "Android 14")
                        put("browser", "PulseShare Service")
                    })
                }
                webSocket.send(joinMsg.toString())
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                handleIncomingPayload(text)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.w(TAG, "Local WebSocket failed: ${t.message}. Will retry in 12s...")
                serviceHandler.postDelayed({
                    if (!isDestroyed) startLocalWebSocket()
                }, 12000)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                serviceHandler.postDelayed({
                    if (!isDestroyed) startLocalWebSocket()
                }, 5000)
            }
        })
    }

    /**
     * Centralized Native Hardware Command Dispatcher
     * Executes whether app is in foreground, minimized in TikTok, or screen is off!
     */
    private fun handleIncomingPayload(rawJson: String) {
        try {
            val json = JSONObject(rawJson)

            // Extract command object (direct or nested inside signal)
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
                            DeviceHardwareHelper.toggleFlashlight(this@PulseShareForegroundService)
                        }

                        "torch_set" -> {
                            val enable = cmd.optBoolean("enabled", false)
                            DeviceHardwareHelper.setFlashlight(this@PulseShareForegroundService, enable)
                        }

                        "find_my_phone" -> {
                            val isEnabled = cmd.optBoolean("enabled", true)
                            if (isEnabled) {
                                DeviceHardwareHelper.startFindMyPhoneAlert(this@PulseShareForegroundService)
                            } else {
                                DeviceHardwareHelper.stopFindMyPhoneAlert(this@PulseShareForegroundService)
                            }
                        }
                    }
                }
            }
        } catch (e: Exception) {
            // Non-JSON or standard WebRTC packet
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        isDestroyed = true
        try {
            wakeLock?.release()
            mqttClient?.disconnect()
            localWebSocket?.close(1000, "Service destroyed")
        } catch (e: Exception) {
            // ignore
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildForegroundNotification(): Notification {
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
            .setContentText("Background Active • Vibrate, Flashlight & Transfers Ready (Room: $currentRoomId)")
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

        fun start(context: Context, roomId: String = "PULSE1") {
            val intent = Intent(context, PulseShareForegroundService::class.java).apply {
                putExtra("ROOM_ID", roomId)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, PulseShareForegroundService::class.java)
            context.stopService(intent)
        }
    }
}
