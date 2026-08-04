#pragma once
/**
 * VibeCoreLog.h — Centralised logging for all native VibeCore components.
 *
 * All native code MUST use these macros instead of raw __android_log_print.
 * The tag "VibeCoreAudio" is used system-wide so logcat filters work.
 *
 * Thread-safety: safe on any thread (android log is thread-safe).
 * Audio-thread rule: use VLOG_AUDIO_* sparingly; never in hot path.
 */

#include <android/log.h>

#define VIBECORE_LOG_TAG "VibeCoreAudio"

// General-purpose levels
#define VLOG_V(fmt, ...) __android_log_print(ANDROID_LOG_VERBOSE, VIBECORE_LOG_TAG, "[%s] " fmt, __func__, ##__VA_ARGS__)
#define VLOG_D(fmt, ...) __android_log_print(ANDROID_LOG_DEBUG,   VIBECORE_LOG_TAG, "[%s] " fmt, __func__, ##__VA_ARGS__)
#define VLOG_I(fmt, ...) __android_log_print(ANDROID_LOG_INFO,    VIBECORE_LOG_TAG, "[%s] " fmt, __func__, ##__VA_ARGS__)
#define VLOG_W(fmt, ...) __android_log_print(ANDROID_LOG_WARN,    VIBECORE_LOG_TAG, "[%s] " fmt, __func__, ##__VA_ARGS__)
#define VLOG_E(fmt, ...) __android_log_print(ANDROID_LOG_ERROR,   VIBECORE_LOG_TAG, "[%s] " fmt, __func__, ##__VA_ARGS__)

// Audio-thread variants — only use outside of hot render path
#define VLOG_AUDIO_I(fmt, ...) __android_log_print(ANDROID_LOG_INFO,  VIBECORE_LOG_TAG, "[AUDIO][%s] " fmt, __func__, ##__VA_ARGS__)
#define VLOG_AUDIO_W(fmt, ...) __android_log_print(ANDROID_LOG_WARN,  VIBECORE_LOG_TAG, "[AUDIO][%s] " fmt, __func__, ##__VA_ARGS__)
#define VLOG_AUDIO_E(fmt, ...) __android_log_print(ANDROID_LOG_ERROR, VIBECORE_LOG_TAG, "[AUDIO][%s] " fmt, __func__, ##__VA_ARGS__)

// Phase-tagged logs — use to trace lifecycle
#define VLOG_PHASE(phase, fmt, ...) __android_log_print(ANDROID_LOG_INFO, VIBECORE_LOG_TAG, "[" phase "][%s] " fmt, __func__, ##__VA_ARGS__)
