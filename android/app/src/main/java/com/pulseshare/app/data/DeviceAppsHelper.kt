package com.pulseshare.app.data

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.net.Uri
import android.provider.Settings
import android.util.Base64
import android.util.Log
import android.util.LruCache
import androidx.core.content.pm.PackageInfoCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * Helper to query all installed applications on the phone,
 * launch apps remotely, extract .apk files to PC, and open app details.
 */
object DeviceAppsHelper {
    private const val TAG = "DeviceAppsHelper"

    // LRU cache for 64x64 base64 app icons to ensure blazing-fast queries
    private val iconCache = object : LruCache<String, String>(250) {}

    fun getInstalledApps(context: Context, includeIcons: Boolean = true): JSONObject {
        val root = JSONObject()
        val appsArray = JSONArray()
        val pm = context.packageManager

        var userAppsCount = 0
        var systemAppsCount = 0

        try {
            val packages = pm.getInstalledPackages(PackageManager.GET_META_DATA)

            // Separate user apps and system apps
            val appItems = mutableListOf<JSONObject>()

            for (pkg in packages) {
                val appInfo = pkg.applicationInfo ?: continue
                val isSystem = (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0

                if (isSystem) {
                    systemAppsCount++
                } else {
                    userAppsCount++
                }

                val appName = try {
                    appInfo.loadLabel(pm).toString()
                } catch (e: Exception) {
                    pkg.packageName
                }

                val packageName = pkg.packageName
                val versionName = pkg.versionName ?: "1.0"
                val versionCode = PackageInfoCompat.getLongVersionCode(pkg)
                val sourceDir = appInfo.sourceDir ?: ""
                val apkFile = if (sourceDir.isNotBlank()) File(sourceDir) else null
                val apkSizeBytes = if (apkFile != null && apkFile.exists()) apkFile.length() else 0L

                val item = JSONObject().apply {
                    put("appName", appName)
                    put("packageName", packageName)
                    put("versionName", versionName)
                    put("versionCode", versionCode)
                    put("isSystemApp", isSystem)
                    put("apkSizeBytes", apkSizeBytes)
                    put("sizeFormatted", formatFileSize(apkSizeBytes))
                    put("firstInstallTime", pkg.firstInstallTime)
                    put("lastUpdateTime", pkg.lastUpdateTime)
                    put("sourceDir", sourceDir)
                }

                // Attach icon if requested (prioritize user apps or if cached)
                if (includeIcons) {
                    val cachedIcon = iconCache.get(packageName)
                    if (cachedIcon != null) {
                        item.put("iconBase64", cachedIcon)
                    } else if (!isSystem || isCommonApp(packageName)) {
                        try {
                            val iconDrawable = appInfo.loadIcon(pm)
                            val base64 = drawableToBase64(iconDrawable)
                            if (base64.isNotBlank()) {
                                iconCache.put(packageName, base64)
                                item.put("iconBase64", base64)
                            }
                        } catch (e: Exception) {
                            Log.w(TAG, "Failed to load icon for $packageName: ${e.message}")
                        }
                    }
                }

                appItems.add(item)
            }

            // Sort: User apps first (alphabetical by name), then System apps (alphabetical by name)
            appItems.sortWith(
                compareBy<JSONObject> { it.optBoolean("isSystemApp", false) }
                    .thenBy { it.optString("appName", "").lowercase() }
            )

            for (item in appItems) {
                appsArray.put(item)
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error querying installed packages: ${e.message}", e)
            root.put("error", e.message ?: "Failed to query installed apps")
        }

        root.apply {
            put("type", "remote_apps_list")
            put("count", appsArray.length())
            put("userAppsCount", userAppsCount)
            put("systemAppsCount", systemAppsCount)
            put("apps", appsArray)
            put("timestamp", System.currentTimeMillis())
        }

        return root
    }

    fun launchApp(context: Context, packageName: String): Boolean {
        return try {
            val pm = context.packageManager
            val intent = pm.getLaunchIntentForPackage(packageName)
            if (intent != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
                context.startActivity(intent)
                Log.d(TAG, "Launched app: $packageName")
                true
            } else {
                Log.w(TAG, "No launch intent found for $packageName")
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error launching app $packageName: ${e.message}")
            false
        }
    }

    fun openAppDetails(context: Context, packageName: String): Boolean {
        return try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:$packageName")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            Log.d(TAG, "Opened app details settings for $packageName")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error opening app details for $packageName: ${e.message}")
            false
        }
    }

    fun getApkFileBytes(context: Context, packageName: String): Pair<String, ByteArray>? {
        return try {
            val pm = context.packageManager
            val appInfo = pm.getApplicationInfo(packageName, 0)
            val sourceDir = appInfo.sourceDir ?: return null
            val file = File(sourceDir)
            if (!file.exists() || !file.canRead()) {
                Log.w(TAG, "Cannot read APK file at $sourceDir")
                return null
            }

            val appLabel = try {
                appInfo.loadLabel(pm).toString().replace(Regex("[^a-zA-Z0-9_.-]"), "_")
            } catch (e: Exception) {
                packageName
            }
            val fileName = "${appLabel}_${packageName}.apk"
            val bytes = file.readBytes()
            Log.d(TAG, "Extracted APK for $packageName (${bytes.size} bytes)")
            Pair(fileName, bytes)
        } catch (e: Exception) {
            Log.e(TAG, "Error reading APK for $packageName: ${e.message}")
            null
        }
    }

    private fun drawableToBase64(drawable: Drawable): String {
        return try {
            val bitmap = if (drawable is BitmapDrawable && drawable.bitmap != null) {
                drawable.bitmap
            } else {
                val w = if (drawable.intrinsicWidth > 0) drawable.intrinsicWidth else 64
                val h = if (drawable.intrinsicHeight > 0) drawable.intrinsicHeight else 64
                val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                val canvas = Canvas(bmp)
                drawable.setBounds(0, 0, canvas.width, canvas.height)
                drawable.draw(canvas)
                bmp
            }

            // Downscale to max 64x64 to preserve network bandwidth and memory
            val scaled = if (bitmap.width > 64 || bitmap.height > 64) {
                Bitmap.createScaledBitmap(bitmap, 64, 64, true)
            } else {
                bitmap
            }

            val stream = ByteArrayOutputStream()
            scaled.compress(Bitmap.CompressFormat.PNG, 85, stream)
            val byteArray = stream.toByteArray()
            Base64.encodeToString(byteArray, Base64.NO_WRAP)
        } catch (e: Exception) {
            ""
        }
    }

    private fun isCommonApp(pkg: String): Boolean {
        return pkg.startsWith("com.google.") ||
                pkg.startsWith("com.android.") ||
                pkg.startsWith("com.whatsapp") ||
                pkg.startsWith("com.facebook") ||
                pkg.startsWith("com.instagram") ||
                pkg.startsWith("com.microsoft") ||
                pkg.startsWith("org.telegram")
    }

    private fun formatFileSize(bytes: Long): String {
        if (bytes <= 0L) return "0 B"
        val kb = bytes / 1024.0
        val mb = kb / 1024.0
        val gb = mb / 1024.0
        return when {
            gb >= 1.0 -> String.format("%.2f GB", gb)
            mb >= 1.0 -> String.format("%.1f MB", mb)
            kb >= 1.0 -> String.format("%.1f KB", kb)
            else -> "$bytes B"
        }
    }
}
