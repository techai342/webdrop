package com.pulseshare.app.service

import android.app.Notification
import android.app.RemoteInput
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Base64
import android.util.Log
import android.util.LruCache
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.concurrent.ConcurrentHashMap

/**
 * Android NotificationListenerService to mirror real-time notifications
 * (WhatsApp, SMS, Instagram, Banking alerts) to PC, with 1-click Quick Reply
 * and remote dismiss capabilities.
 */
class PulseNotificationListener : NotificationListenerService() {

    override fun onListenerConnected() {
        super.onListenerConnected()
        instance = this
        Log.d(TAG, "Notification Listener connected!")
        PulseShareForegroundService.onNotificationListenerStateChanged(true)
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        if (instance === this) {
            instance = null
        }
        Log.d(TAG, "Notification Listener disconnected!")
        PulseShareForegroundService.onNotificationListenerStateChanged(false)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)
        if (sbn == null) return

        // Skip our own PulseShare background foreground notifications to avoid self-loop
        if (sbn.packageName == packageName) return

        try {
            val json = parseNotification(sbn) ?: return
            PulseShareForegroundService.broadcastPhoneNotification(json)
        } catch (e: Exception) {
            Log.e(TAG, "Error processing incoming notification from ${sbn.packageName}: ${e.message}")
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        super.onNotificationRemoved(sbn)
        if (sbn == null) return
        if (sbn.packageName == packageName) return

        try {
            replyActionMap.remove(sbn.key)
            val json = JSONObject().apply {
                put("type", "notification_removed")
                put("key", sbn.key)
                put("packageName", sbn.packageName)
                put("timestamp", System.currentTimeMillis())
            }
            PulseShareForegroundService.broadcastPhoneNotification(json)
        } catch (e: Exception) {
            Log.e(TAG, "Error processing notification removal: ${e.message}")
        }
    }

    private fun parseNotification(sbn: StatusBarNotification): JSONObject? {
        val n = sbn.notification ?: return null
        val extras = n.extras ?: Bundle()

        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
            ?: extras.getCharSequence(Notification.EXTRA_TITLE_BIG)?.toString()
            ?: ""

        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
            ?: extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
            ?: extras.getCharSequence(Notification.EXTRA_INFO_TEXT)?.toString()
            ?: ""

        val subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString() ?: ""

        // Skip blank non-content notifications
        if (title.isBlank() && text.isBlank()) return null

        val pm = packageManager
        val appName = try {
            val appInfo = pm.getApplicationInfo(sbn.packageName, 0)
            pm.getApplicationLabel(appInfo).toString()
        } catch (e: Exception) {
            sbn.packageName
        }

        // Check for Quick Reply action
        var canReply = false
        var replyActionLabel = "Reply"
        val actions = n.actions
        if (actions != null) {
            for (act in actions) {
                val remoteInputs = act.remoteInputs
                if (remoteInputs != null && remoteInputs.isNotEmpty()) {
                    for (ri in remoteInputs) {
                        if (ri.resultKey != null) {
                            replyActionMap[sbn.key] = Pair(act, ri)
                            canReply = true
                            if (!act.title.isNullOrBlank()) {
                                replyActionLabel = act.title.toString()
                            }
                            break
                        }
                    }
                }
                if (canReply) break
            }
        }

        val iconBase64 = getNotificationIconBase64(sbn)

        return JSONObject().apply {
            put("type", "phone_notification")
            put("key", sbn.key)
            put("id", sbn.id)
            put("packageName", sbn.packageName)
            put("appName", appName)
            put("title", title)
            put("text", text)
            put("subText", subText)
            put("postTime", sbn.postTime)
            put("isClearable", sbn.isClearable)
            put("isOngoing", sbn.isOngoing)
            put("canReply", canReply)
            put("replyActionLabel", replyActionLabel)
            if (iconBase64.isNotBlank()) {
                put("iconBase64", iconBase64)
            }
        }
    }

    private fun getNotificationIconBase64(sbn: StatusBarNotification): String {
        val cached = iconCache.get(sbn.packageName)
        if (cached != null) return cached

        return try {
            val pm = packageManager
            val appInfo = pm.getApplicationInfo(sbn.packageName, 0)
            val drawable = pm.getApplicationIcon(appInfo)
            val base64 = drawableToBase64(drawable)
            if (base64.isNotBlank()) {
                iconCache.put(sbn.packageName, base64)
            }
            base64
        } catch (e: Exception) {
            ""
        }
    }

    private fun drawableToBase64(drawable: Drawable): String {
        return try {
            val bitmap = if (drawable is BitmapDrawable && drawable.bitmap != null) {
                drawable.bitmap
            } else {
                val w = if (drawable.intrinsicWidth > 0) drawable.intrinsicWidth else 48
                val h = if (drawable.intrinsicHeight > 0) drawable.intrinsicHeight else 48
                val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                val canvas = Canvas(bmp)
                drawable.setBounds(0, 0, canvas.width, canvas.height)
                drawable.draw(canvas)
                bmp
            }

            val scaled = if (bitmap.width > 48 || bitmap.height > 48) {
                Bitmap.createScaledBitmap(bitmap, 48, 48, true)
            } else {
                bitmap
            }

            val stream = ByteArrayOutputStream()
            scaled.compress(Bitmap.CompressFormat.PNG, 85, stream)
            Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
        } catch (e: Exception) {
            ""
        }
    }

    companion object {
        private const val TAG = "PulseNotifListener"

        @Volatile
        var instance: PulseNotificationListener? = null
            private set

        // Key -> (Notification.Action, RemoteInput)
        private val replyActionMap = ConcurrentHashMap<String, Pair<Notification.Action, RemoteInput>>()
        private val iconCache = object : LruCache<String, String>(150) {}

        fun isAccessGranted(context: Context): Boolean {
            val listeners = NotificationManagerCompat.getEnabledListenerPackages(context)
            return listeners.contains(context.packageName)
        }

        fun openAccessSettings(context: Context) {
            try {
                val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to open notification settings: ${e.message}")
            }
        }

        fun sendQuickReply(context: Context, key: String, replyText: String): Boolean {
            val pair = replyActionMap[key]
            if (pair == null) {
                Log.w(TAG, "No quick reply action cached for key: $key")
                return false
            }

            val (action, remoteInput) = pair
            return try {
                val intent = Intent()
                val bundle = Bundle()
                bundle.putCharSequence(remoteInput.resultKey, replyText)
                RemoteInput.addResultsToIntent(arrayOf(remoteInput), intent, bundle)

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    action.actionIntent.send(context, 0, intent, null, null)
                } else {
                    action.actionIntent.send(context, 0, intent)
                }
                Log.d(TAG, "Successfully sent quick reply for key: $key, text: $replyText")
                true
            } catch (e: Exception) {
                Log.e(TAG, "Error sending quick reply for key $key: ${e.message}", e)
                false
            }
        }

        fun dismissNotification(key: String): Boolean {
            val inst = instance
            if (inst == null) {
                Log.w(TAG, "Cannot dismiss notification: listener instance is null")
                return false
            }

            return try {
                inst.cancelNotification(key)
                replyActionMap.remove(key)
                Log.d(TAG, "Dismissed notification: $key")
                true
            } catch (e: Exception) {
                Log.e(TAG, "Failed to dismiss notification $key: ${e.message}")
                false
            }
        }

        fun getActiveNotificationsJson(context: Context): JSONObject {
            val root = JSONObject()
            val notifsArr = JSONArray()
            val inst = instance

            val isGranted = isAccessGranted(context)
            root.put("type", "active_notifications_list")
            root.put("isAccessGranted", isGranted)
            root.put("isListenerConnected", inst != null)

            if (inst == null || !isGranted) {
                root.put("count", 0)
                root.put("notifications", notifsArr)
                return root
            }

            try {
                val active = inst.activeNotifications ?: emptyArray()
                for (sbn in active) {
                    if (sbn.packageName == context.packageName) continue
                    val parsed = inst.parseNotification(sbn)
                    if (parsed != null) {
                        notifsArr.put(parsed)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error fetching active notifications: ${e.message}")
                root.put("error", e.message ?: "Failed to read active notifications")
            }

            root.put("count", notifsArr.length())
            root.put("notifications", notifsArr)
            root.put("timestamp", System.currentTimeMillis())
            return root
        }
    }
}
