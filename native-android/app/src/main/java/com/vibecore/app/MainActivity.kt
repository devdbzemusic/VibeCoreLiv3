package com.vibecore.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.app.Activity
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.vibecore.audio.NativeAudioBridge

/**
 * MainActivity — WebView-Host für die VibeCore-Web-App + native Oboe-Engine.
 *
 * Verbindlicher Bridge-Vertrag (ADR-005, Decision C):
 *   webView.addJavascriptInterface(bridge, "VibeCoreNative")
 * `window.VibeCoreNative` ist der einzige Erkennungspunkt der Web-Seite
 * (src/lib/audio/AudioBackend.ts). KEIN anderer Name.
 *
 * Web-App-Auslieferung: das Vite-Build (dist/) muss nach
 * app/src/main/assets/webapp/ kopiert werden (index.html + assets/).
 * Dieser Schritt ist Teil der externen Build-Pipeline, nicht dieses Repos.
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView
    private lateinit var bridge: NativeAudioBridge
    private var audioFocusRequest: AudioFocusRequest? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        bridge = NativeAudioBridge(applicationContext)

        webView = WebView(this)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = true
        }
        webView.webViewClient = WebViewClient()

        // ADR-005 Decision C — verbindlicher Interface-Name.
        webView.addJavascriptInterface(bridge, "VibeCoreNative")
        // Host-Funktionen (Permissions), bewusst getrennt von der Audio-Bridge:
        webView.addJavascriptInterface(HostBridge(), "VibeCoreHost")

        setContentView(webView)
        webView.loadUrl("file:///android_asset/webapp/index.html")

        requestAudioFocus()
        // RECORD_AUDIO wird NICHT beim Start angefragt, sondern muss von der
        // Web-Seite vor Voice-Live-Input ausgelöst werden (UX-Entscheidung:
        // Permission-Prompt erst bei tatsächlicher Mikrofonnutzung).
    }

    /**
     * HostBridge — von der Web-Seite erreichbare Host-Funktionen
     * (window.VibeCoreHost). Die Web-App MUSS requestMicrophonePermission()
     * aufrufen und ein true-Ergebnis erhalten, BEVOR sie Voice-Live-Input
     * über die Audio-Bridge aktiviert.
     */
    inner class HostBridge {
        @android.webkit.JavascriptInterface
        fun hasMicrophonePermission(): Boolean =
            ContextCompat.checkSelfPermission(
                this@MainActivity, Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED

        /** Startet ggf. den System-Permission-Dialog. Gibt den AKTUELLEN
         *  Stand zurück; nach dem Dialog erneut hasMicrophonePermission()
         *  abfragen (der Dialog ist asynchron). */
        @android.webkit.JavascriptInterface
        fun requestMicrophonePermission(): Boolean {
            val granted = hasMicrophonePermission()
            if (!granted) runOnUiThread { ensureRecordAudioPermission() }
            return granted
        }
    }

    /** Fordert die Mikrofon-Permission an (System-Dialog). */
    fun ensureRecordAudioPermission(): Boolean {
        val granted = ContextCompat.checkSelfPermission(
            this, Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
        if (!granted) {
            ActivityCompat.requestPermissions(
                this, arrayOf(Manifest.permission.RECORD_AUDIO), REQ_RECORD_AUDIO
            )
        }
        return granted
    }

    private fun requestAudioFocus() {
        val am = getSystemService(AUDIO_SERVICE) as AudioManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build()
            val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(attrs)
                .setOnAudioFocusChangeListener { change -> onFocusChange(change) }
                .build()
            audioFocusRequest = req
            am.requestAudioFocus(req)
        } else {
            @Suppress("DEPRECATION")
            am.requestAudioFocus(
                { change -> onFocusChange(change) },
                AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN
            )
        }
    }

    /**
     * Fokusverlust wird DURCHGESETZT, nicht nur gemeldet:
     * - permanenter Verlust  → Transport stoppen + Engine stoppen (Stille)
     * - transienter Verlust  → Transport stoppen (Engine bleibt startbereit)
     * - Rückgewinn           → nur native Statusmeldung; Wiedergabe startet
     *                          bewusst NICHT automatisch (User-Entscheidung)
     */
    private fun onFocusChange(change: Int) {
        when (change) {
            AudioManager.AUDIOFOCUS_GAIN -> bridge.onAudioFocusGained()
            AudioManager.AUDIOFOCUS_LOSS -> {
                bridge.onAudioFocusLost(false)
                bridge.stop()
                bridge.stopEngine()
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                bridge.onAudioFocusLost(true)
                bridge.stop()
            }
        }
    }

    override fun onDestroy() {
        val am = getSystemService(AUDIO_SERVICE) as AudioManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest?.let { am.abandonAudioFocusRequest(it) }
        }
        bridge.stopEngine()
        webView.destroy()
        super.onDestroy()
    }

    companion object {
        private const val REQ_RECORD_AUDIO = 1001
    }
}
