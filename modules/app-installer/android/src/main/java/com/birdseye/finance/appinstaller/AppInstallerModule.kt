package com.birdseye.finance.appinstaller

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.content.pm.Signature
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.security.MessageDigest

/**
 * Installing an APK the app downloaded itself (FEATURE_SPEC 3.2 C, CLAUDE.md rule 1 (c)).
 *
 * Everything here is about refusing to install the wrong thing: the file's SHA-256 is compared
 * with the digest GitHub publishes, and the APK's package, signing certificate and versionCode
 * are compared with the running app before anything is handed to Android. On Android 12+ an app
 * may update *itself* without the system's confirmation dialog, which is why the install goes
 * through a PackageInstaller session rather than an ACTION_VIEW intent; older versions (and any
 * device that refuses) simply show Android's own dialog instead.
 */
class AppInstallerModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw CodedException("No Android context available")

  override fun definition() = ModuleDefinition {
    Name("AppInstaller")

    AsyncFunction("sha256") { path: String -> sha256(resolve(path)) }

    AsyncFunction("inspectApk") { path: String -> inspectApk(resolve(path)) }

    /** False until the user allows "install unknown apps" for this app. */
    Function("canInstallPackages") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.packageManager.canRequestPackageInstalls()
      } else {
        true
      }
    }

    AsyncFunction("openInstallPermissionSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val intent = Intent(
          Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
          Uri.parse("package:${context.packageName}")
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
    }

    AsyncFunction("installApk") { path: String -> installApk(resolve(path)) }
  }

  private fun resolve(path: String): File {
    val file = File(path.removePrefix("file://"))
    if (!file.isFile) throw CodedException("ERR_FILE_MISSING", "No file at $path", null)
    return file
  }

  private fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().use { input ->
      val buffer = ByteArray(64 * 1024)
      while (true) {
        val read = input.read(buffer)
        if (read <= 0) break
        digest.update(buffer, 0, read)
      }
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
  }

  @Suppress("DEPRECATION")
  private fun signatureDigests(info: PackageInfo): List<String> {
    val signatures: Array<Signature> = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      val signingInfo = info.signingInfo
      when {
        signingInfo == null -> emptyArray<Signature>()
        signingInfo.hasMultipleSigners() -> signingInfo.apkContentsSigners ?: emptyArray()
        else -> signingInfo.signingCertificateHistory ?: emptyArray()
      }
    } else {
      info.signatures ?: emptyArray()
    }
    val digest = MessageDigest.getInstance("SHA-256")
    return signatures.map { digest.digest(it.toByteArray()).joinToString("") { b -> "%02x".format(b) } }
  }

  private fun versionCodeOf(info: PackageInfo): Long =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else info.versionCode.toLong()

  /** What the file claims to be, beside what is installed — the caller decides whether they match. */
  private fun inspectApk(file: File): Map<String, Any?> {
    val pm = context.packageManager
    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      PackageManager.GET_SIGNING_CERTIFICATES
    } else {
      @Suppress("DEPRECATION") PackageManager.GET_SIGNATURES
    }
    val apk = pm.getPackageArchiveInfo(file.absolutePath, flags)
      ?: throw CodedException("ERR_NOT_AN_APK", "The file is not a readable APK", null)
    val installed = pm.getPackageInfo(context.packageName, flags)

    return mapOf(
      "packageName" to apk.packageName,
      "versionCode" to versionCodeOf(apk),
      "versionName" to apk.versionName,
      "signatureSha256" to signatureDigests(apk),
      "installedPackageName" to context.packageName,
      "installedVersionCode" to versionCodeOf(installed),
      "installedSignatureSha256" to signatureDigests(installed)
    )
  }

  private fun installApk(file: File) {
    val installer = context.packageManager.packageInstaller
    val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
    params.setAppPackageName(context.packageName)
    // Android 12+ lets an app update itself with no confirmation dialog, given
    // REQUEST_INSTALL_PACKAGES and UPDATE_PACKAGES_WITHOUT_USER_ACTION (app.json). Where the
    // system declines, it falls back to showing its own dialog — nothing breaks.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
    }

    val sessionId = try {
      installer.createSession(params)
    } catch (error: Exception) {
      throw CodedException("ERR_INSTALL_SESSION", "Could not start the install", error)
    }

    try {
      installer.openSession(sessionId).use { session ->
        session.openWrite("update.apk", 0, file.length()).use { output ->
          file.inputStream().use { input -> input.copyTo(output) }
          session.fsync(output)
        }
        val intent = Intent(INSTALL_RESULT_ACTION).setPackage(context.packageName)
        val pendingFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          PendingIntent.FLAG_MUTABLE
        } else {
          0
        }
        val pending = PendingIntent.getBroadcast(context, sessionId, intent, pendingFlags)
        // Android takes it from here: it replaces the app and stops this process.
        session.commit(pending.intentSender)
      }
    } catch (error: Exception) {
      installer.abandonSession(sessionId)
      throw CodedException("ERR_INSTALL_FAILED", "Android refused the install", error)
    }
  }

  companion object {
    private const val INSTALL_RESULT_ACTION = "com.birdseye.finance.appinstaller.INSTALL_RESULT"
  }
}
