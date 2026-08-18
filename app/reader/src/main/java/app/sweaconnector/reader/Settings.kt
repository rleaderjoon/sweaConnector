package app.sweaconnector.reader

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

// 어느 저장소를 보는지, 그리고 그걸 열 토큰.
//
// 토큰은 저장소 접근 권한 그 자체다. 평문으로 두지 않고 기기 키스토어 키로 감싼다 —
// 백업이나 파일 덤프로 prefs 가 통째로 새 나가도 키는 기기 밖으로 못 나간다.

class Settings(context: Context) {

    private val prefs = context.getSharedPreferences("swea", Context.MODE_PRIVATE)

    var gitUrl: String?
        get() = prefs.getString(KEY_URL, null)
        set(v) = prefs.edit().putString(KEY_URL, v).apply()

    var branch: String
        get() = prefs.getString(KEY_BRANCH, null)?.takeIf { it.isNotBlank() } ?: "main"
        set(v) = prefs.edit().putString(KEY_BRANCH, v).apply()

    var token: String?
        get() = prefs.getString(KEY_TOKEN, null)?.let(Secret::decrypt)
        set(v) = prefs.edit()
            .putString(KEY_TOKEN, v?.takeIf { it.isNotBlank() }?.let(Secret::encrypt))
            .apply()

    val configured: Boolean get() = !gitUrl.isNullOrBlank()

    private companion object {
        const val KEY_URL = "gitUrl"
        const val KEY_BRANCH = "branch"
        const val KEY_TOKEN = "token"
    }
}

private object Secret {

    private const val ALIAS = "swea-token"
    private const val TRANSFORM = "AES/GCM/NoPadding"
    private const val TAG_BITS = 128

    fun encrypt(plain: String): String {
        val cipher = Cipher.getInstance(TRANSFORM).apply { init(Cipher.ENCRYPT_MODE, key()) }
        val body = cipher.doFinal(plain.toByteArray())
        return "${cipher.iv.b64()}:${body.b64()}"
    }

    fun decrypt(blob: String): String? = try {
        val (iv, body) = blob.split(":", limit = 2)
        val cipher = Cipher.getInstance(TRANSFORM)
            .apply { init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(TAG_BITS, iv.unb64())) }
        String(cipher.doFinal(body.unb64()))
    } catch (_: Exception) {
        // 키가 지워졌거나(앱 재설치·기기 초기화) 형식이 깨진 경우. 토큰을 다시 받으면 된다.
        null
    }

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getEntry(ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }

        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(
                KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .build()
            )
        }.generateKey()
    }

    private fun ByteArray.b64() = Base64.encodeToString(this, Base64.NO_WRAP)

    private fun String.unb64() = Base64.decode(this, Base64.NO_WRAP)
}
