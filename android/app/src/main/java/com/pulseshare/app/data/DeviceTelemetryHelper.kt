package com.pulseshare.app.data

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorManager
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

object DeviceTelemetryHelper {

    fun getTelemetryJson(context: Context): JSONObject {
        val root = JSONObject()
        try {
            root.put("type", "device_telemetry")
            root.put("timestamp", System.currentTimeMillis())

            // 1. Device Info
            val devObj = JSONObject().apply {
                put("model", Build.MODEL)
                put("manufacturer", Build.MANUFACTURER)
                put("brand", Build.BRAND)
                put("device", Build.DEVICE)
                put("osVersion", "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
                put("cpuCores", Runtime.getRuntime().availableProcessors())
            }
            root.put("device", devObj)

            // 2. Battery Telemetry
            val batteryObj = getBatteryTelemetry(context)
            root.put("battery", batteryObj)

            // 3. Storage Telemetry
            val storageObj = getStorageTelemetry()
            root.put("storage", storageObj)

            // 4. RAM / Memory Telemetry
            val memoryObj = getMemoryTelemetry(context)
            root.put("memory", memoryObj)

            // 5. Total Installed Apps Count
            val appsObj = getAppsTelemetry(context)
            root.put("apps", appsObj)

            // 6. Hardware Sensors List
            val sensorsObj = getSensorsTelemetry(context)
            root.put("sensors", sensorsObj)

        } catch (e: Exception) {
            e.printStackTrace()
        }
        return root
    }

    private fun getBatteryTelemetry(context: Context): JSONObject {
        val obj = JSONObject()
        try {
            val batteryStatus: Intent? = IntentFilter(Intent.ACTION_BATTERY_CHANGED).let { filter ->
                context.registerReceiver(null, filter)
            }
            val level = batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
            val scale = batteryStatus?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
            val batteryPct = if (level >= 0 && scale > 0) (level * 100 / scale) else 0

            val status = batteryStatus?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
            val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                    status == BatteryManager.BATTERY_STATUS_FULL

            val plugged = batteryStatus?.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1) ?: -1
            val plugType = when (plugged) {
                BatteryManager.BATTERY_PLUGGED_AC -> "AC Charger"
                BatteryManager.BATTERY_PLUGGED_USB -> "USB Cable"
                BatteryManager.BATTERY_PLUGGED_WIRELESS -> "Wireless"
                else -> if (isCharging) "Charging" else "On Battery"
            }

            obj.put("level", batteryPct)
            obj.put("isCharging", isCharging)
            obj.put("plugType", plugType)
            obj.put("isLow", batteryPct <= 20 && !isCharging)
        } catch (e: Exception) {
            obj.put("level", 0)
            obj.put("isCharging", false)
            obj.put("plugType", "Unknown")
            obj.put("isLow", false)
        }
        return obj
    }

    private fun getStorageTelemetry(): JSONObject {
        val obj = JSONObject()
        try {
            val path: File = Environment.getDataDirectory()
            val stat = StatFs(path.path)
            val blockSize = stat.blockSizeLong
            val totalBlocks = stat.blockCountLong
            val availableBlocks = stat.availableBlocksLong

            val totalBytes = totalBlocks * blockSize
            val freeBytes = availableBlocks * blockSize
            val usedBytes = totalBytes - freeBytes

            val totalGB = totalBytes / (1024.0 * 1024.0 * 1024.0)
            val freeGB = freeBytes / (1024.0 * 1024.0 * 1024.0)
            val usedGB = usedBytes / (1024.0 * 1024.0 * 1024.0)
            val usedPercentage = if (totalBytes > 0) ((usedBytes * 100) / totalBytes).toInt() else 0

            obj.put("totalBytes", totalBytes)
            obj.put("freeBytes", freeBytes)
            obj.put("usedBytes", usedBytes)
            obj.put("totalGB", String.format("%.1f", totalGB))
            obj.put("freeGB", String.format("%.1f", freeGB))
            obj.put("usedGB", String.format("%.1f", usedGB))
            obj.put("usedPercentage", usedPercentage)
            obj.put("summary", "${String.format("%.1f", usedGB)} GB / ${String.format("%.1f", totalGB)} GB ($usedPercentage%)")
        } catch (e: Exception) {
            obj.put("summary", "Storage info unavailable")
            obj.put("usedPercentage", 0)
        }
        return obj
    }

    private fun getMemoryTelemetry(context: Context): JSONObject {
        val obj = JSONObject()
        try {
            val actManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val memInfo = ActivityManager.MemoryInfo()
            actManager.getMemoryInfo(memInfo)

            val totalRam = memInfo.totalMem
            val availRam = memInfo.availMem
            val usedRam = totalRam - availRam

            val totalRamGB = totalRam / (1024.0 * 1024.0 * 1024.0)
            val availRamGB = availRam / (1024.0 * 1024.0 * 1024.0)
            val usedRamGB = usedRam / (1024.0 * 1024.0 * 1024.0)
            val usedRamPct = if (totalRam > 0) ((usedRam * 100) / totalRam).toInt() else 0

            obj.put("totalRamGB", String.format("%.1f", totalRamGB))
            obj.put("availRamGB", String.format("%.1f", availRamGB))
            obj.put("usedRamGB", String.format("%.1f", usedRamGB))
            obj.put("usedPercentage", usedRamPct)
            obj.put("isLowRam", memInfo.lowMemory)
            obj.put("summary", "${String.format("%.1f", availRamGB)} GB Free of ${String.format("%.1f", totalRamGB)} GB")
        } catch (e: Exception) {
            obj.put("summary", "RAM info unavailable")
        }
        return obj
    }

    private fun getAppsTelemetry(context: Context): JSONObject {
        val obj = JSONObject()
        try {
            val pm = context.packageManager
            val installedApps = pm.getInstalledApplications(PackageManager.GET_META_DATA)
            val totalCount = installedApps.size
            val systemApps = installedApps.count { (it.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0 }
            val userApps = totalCount - systemApps

            obj.put("totalApps", totalCount)
            obj.put("userApps", userApps)
            obj.put("systemApps", systemApps)
            obj.put("summary", "$totalCount Apps Installed ($userApps User Apps)")
        } catch (e: Exception) {
            obj.put("totalApps", 0)
            obj.put("summary", "Apps count unavailable")
        }
        return obj
    }

    private fun getSensorsTelemetry(context: Context): JSONObject {
        val obj = JSONObject()
        try {
            val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
            val sensorList = sensorManager.getSensorList(Sensor.TYPE_ALL)
            val sensorsArray = JSONArray()

            val uniqueTypes = mutableSetOf<String>()
            for (s in sensorList) {
                val readableName = when (s.type) {
                    Sensor.TYPE_ACCELEROMETER -> "Accelerometer (Motion)"
                    Sensor.TYPE_GYROSCOPE -> "Gyroscope (Rotation)"
                    Sensor.TYPE_MAGNETIC_FIELD -> "Compass (Magnetometer)"
                    Sensor.TYPE_PROXIMITY -> "Proximity Sensor"
                    Sensor.TYPE_LIGHT -> "Ambient Light Sensor"
                    Sensor.TYPE_PRESSURE -> "Barometer (Air Pressure)"
                    Sensor.TYPE_STEP_COUNTER -> "Pedometer (Step Counter)"
                    Sensor.TYPE_GRAVITY -> "Gravity Sensor"
                    Sensor.TYPE_ROTATION_VECTOR -> "Rotation Vector (3D Orientation)"
                    Sensor.TYPE_LINEAR_ACCELERATION -> "Linear Acceleration"
                    else -> s.name
                }
                if (uniqueTypes.add(readableName)) {
                    val sObj = JSONObject().apply {
                        put("name", readableName)
                        put("vendor", s.vendor)
                        put("power", "${s.power} mA")
                    }
                    sensorsArray.put(sObj)
                }
            }

            obj.put("count", sensorList.size)
            obj.put("uniqueCount", uniqueTypes.size)
            obj.put("list", sensorsArray)
            obj.put("summary", "${sensorList.size} Hardware Sensors Detected")
        } catch (e: Exception) {
            obj.put("count", 0)
            obj.put("summary", "Sensors unavailable")
        }
        return obj
    }
}
