package com.vibecore.app

import android.app.Application

/**
 * VibeCoreApplication — minimaler Application-Einstieg für den Build Host.
 * Keine Engine-Initialisierung hier: die native Bibliothek wird erst durch
 * NativeAudioBridge (System.loadLibrary) in MainActivity geladen (ADR-005:
 * Bridge = einziger Zugangspunkt, keine Business-Logik im Host).
 */
class VibeCoreApplication : Application()
