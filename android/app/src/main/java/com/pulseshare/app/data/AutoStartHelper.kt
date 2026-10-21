package com.pulseshare.app.data

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log

object AutoStartHelper {
    private const val TAG = "AutoStartHelper"

    /**
     * Attempts to open the OEM Auto-Start / Background App Protection screen.
     * Returns true if a specific OEM intent was launched, false otherwise.
     */
    fun openAutoStartSettings(context: Context): Boolean {
        val mfr = Build.MANUFACTURER.uppercase()
        val brand = Build.BRAND.uppercase()

        val intents = mutableListOf<Intent>()

        // 1. Xiaomi / Redmi / POCO (MIUI / HyperOS)
        if (mfr.contains("XIAOMI") || brand.contains("REDMI") || brand.contains("POCO")) {
            intents.add(Intent().setComponent(ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")))
            intents.add(Intent().setComponent(ComponentName("com.miui.securitycenter", "com.miui.powercenter.PowerSettings")))
        }

        // 2. Transsion (TECNO / Infinix / itel - HiOS / XOS)
        if (mfr.contains("TECNO") || brand.contains("TECNO") || mfr.contains("INFINIX") || brand.contains("INFINIX")) {
            intents.add(Intent().setComponent(ComponentName("com.transsion.phonemanager", "com.transsion.phonemanager.settings.AutoStartManageActivity")))
            intents.add(Intent().setComponent(ComponentName("com.transsion.phonemanager", "com.transsion.phonemanager.autostart.AutoStartActivity")))
            intents.add(Intent().setComponent(ComponentName("com.transsion.phonemanager", "com.transsion.phonemanager.power.PowerSettingsActivity")))
        }

        // 3. Samsung
        if (mfr.contains("SAMSUNG")) {
            intents.add(Intent().setComponent(ComponentName("com.samsung.android.lool", "com.samsung.android.sm.battery.ui.BatteryActivity")))
            intents.add(Intent().setComponent(ComponentName("com.samsung.android.sm", "com.samsung.android.sm.battery.ui.BatteryActivity")))
        }

        // 4. Huawei / Honor
        if (mfr.contains("HUAWEI") || brand.contains("HONOR")) {
            intents.add(Intent().setComponent(ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity")))
            intents.add(Intent().setComponent(ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity")))
        }

        // 5. Oppo / Realme (ColorOS / Realme UI)
        if (mfr.contains("OPPO") || mfr.contains("REALME")) {
            intents.add(Intent().setComponent(ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity")))
            intents.add(Intent().setComponent(ComponentName("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity")))
            intents.add(Intent().setComponent(ComponentName("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity")))
        }

        // 6. Vivo / iQOO
        if (mfr.contains("VIVO") || brand.contains("IQOO")) {
            intents.add(Intent().setComponent(ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity")))
            intents.add(Intent().setComponent(ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity")))
        }

        // 7. OnePlus
        if (mfr.contains("ONEPLUS")) {
            intents.add(Intent().setComponent(ComponentName("com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity")))
        }

        // 8. General Android Battery Optimization
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            intents.add(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
            intents.add(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${context.packageName}")
            })
        }

        // Standard App Details Fallback
        intents.add(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.parse("package:${context.packageName}")
        })

        for (intent in intents) {
            try {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
                Log.d(TAG, "Launched auto-start activity: ${intent.component ?: intent.action}")
                return true
            } catch (e: Exception) {
                // Continue to next available intent
            }
        }

        return false
    }
}
