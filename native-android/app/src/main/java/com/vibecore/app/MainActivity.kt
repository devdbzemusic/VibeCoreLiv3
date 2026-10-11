package com.vibecore.app

import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import com.vibecore.app.nativeui.VibeCoreViewModel
import com.vibecore.app.ui.VibeCoreApp

/**
 * Pure Android VibeCore launcher.
 *
 * No WebView is created here. Compose owns presentation, Kotlin owns UI/project
 * state and the existing C++/Oboe core remains the sole real-time audio/timing
 * authority through NativeAudioBridge → JNI.
 */
class MainActivity : ComponentActivity() {

    private val viewModel: VibeCoreViewModel by viewModels()
    private var audioFocusRequest: AudioFocusRequest? = null
    private val legacyAudioFocusListener = AudioManager.OnAudioFocusChangeListener(::onAudioFocusChange)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            VibeCoreApp(viewModel)
        }

        requestAudioFocus()
    }

    private fun requestAudioFocus() {
        val audioManager = getSystemService(AUDIO_SERVICE) as AudioManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val attributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build()
            val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(attributes)
                .setOnAudioFocusChangeListener(::onAudioFocusChange)
                .build()
            audioFocusRequest = request
            audioManager.requestAudioFocus(request)
        } else {
            @Suppress("DEPRECATION")
            audioManager.requestAudioFocus(
                legacyAudioFocusListener,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN,
            )
        }
    }

    private fun onAudioFocusChange(change: Int) {
        when (change) {
            AudioManager.AUDIOFOCUS_GAIN -> viewModel.onAudioFocusGained()
            AudioManager.AUDIOFOCUS_LOSS -> viewModel.onAudioFocusLost(transient = false)
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK ->
                viewModel.onAudioFocusLost(transient = true)
        }
    }

    override fun onDestroy() {
        val audioManager = getSystemService(AUDIO_SERVICE) as AudioManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest?.let(audioManager::abandonAudioFocusRequest)
        } else {
            @Suppress("DEPRECATION")
            audioManager.abandonAudioFocus(legacyAudioFocusListener)
        }
        super.onDestroy()
    }
}
