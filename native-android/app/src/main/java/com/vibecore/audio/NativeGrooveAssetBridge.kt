package com.vibecore.audio

import android.webkit.JavascriptInterface

/**
 * NativeGrooveAssetBridge — decode/asset ingress only.
 *
 * This bridge is intentionally separate from VibeCoreNative transport/DSP
 * control. It never starts/stops audio, changes transport or owns project state.
 * PCM load/clear is cold-load only and is rejected by native code while the
 * Oboe stream is running.
 */
class NativeGrooveAssetBridge {

    companion object {
        init {
            System.loadLibrary("vibecore-native")
        }
    }

    @JavascriptInterface
    fun canLoad(): Boolean = nativeCanLoad()

    @JavascriptInterface
    fun loadSample(sampleId: Int, data: FloatArray, sampleRate: Int): Boolean {
        if (sampleId < 0 || data.isEmpty() || sampleRate <= 0) return false
        return nativeLoadSample(sampleId, data, sampleRate)
    }

    @JavascriptInterface
    fun clearSample(sampleId: Int): Boolean {
        if (sampleId < 0) return false
        return nativeClearSample(sampleId)
    }

    @JavascriptInterface
    fun sampleLoaded(sampleId: Int): Boolean {
        if (sampleId < 0) return false
        return nativeSampleLoaded(sampleId)
    }

    private external fun nativeCanLoad(): Boolean
    private external fun nativeLoadSample(sampleId: Int, data: FloatArray, sampleRate: Int): Boolean
    private external fun nativeClearSample(sampleId: Int): Boolean
    private external fun nativeSampleLoaded(sampleId: Int): Boolean
}
