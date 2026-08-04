cmake_minimum_required(VERSION 3.22.1)
project(vibecore_native VERSION 5.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(oboe REQUIRED CONFIG)

# ─── Platform sources (Phase 1) ───────────────────────────────────────────────

set(VIBECORE_PLATFORM_SOURCES
    platform/VibeCoreAudioEngine.cpp
    platform/AudioDeviceManager.cpp
    platform/AudioSessionManager.cpp
    platform/PerformanceMonitor.cpp
    platform/Diagnostics.cpp
)

# ─── Sync sources (Phase 2) ───────────────────────────────────────────────────

set(VIBECORE_SYNC_SOURCES
    platform/sync/VibeCoreSync.cpp
)

# ─── Graph sources (Phase 1+2) ────────────────────────────────────────────────

set(VIBECORE_GRAPH_SOURCES
    graph/AudioGraphManager.cpp
    graph/MixerNode.cpp
)

# ─── Thread sources (Phase 1) ─────────────────────────────────────────────────

set(VIBECORE_THREAD_SOURCES
    threads/ThreadModel.cpp
)

# ─── Groove sources (Phase 3) ─────────────────────────────────────────────────

set(VIBECORE_GROOVE_SOURCES
    groove/VoicePool.cpp
    groove/StepSequencer.cpp
    groove/PianoRoll.cpp
    groove/SceneEngine.cpp
    groove/GrooveNode.cpp
    groove/GrooveEngine.cpp
)

# ─── Bass sources (Phase 5) ───────────────────────────────────────────────────

set(VIBECORE_BASS_SOURCES
    bass/BassWavetable.cpp
    bass/BassFilter.cpp
    bass/BassEnvelope.cpp
    bass/BassLFO.cpp
    bass/BassVoice.cpp
    bass/BassVoicePool.cpp
    bass/Bass3DStereo.cpp
    bass/BassNode.cpp
    bass/BassEngine.cpp
)

# ─── Bridge ───────────────────────────────────────────────────────────────────

set(VIBECORE_BRIDGE_SOURCES
    bridge/jni_bridge.cpp
)

# ─── Shared library ───────────────────────────────────────────────────────────

add_library(
    vibecore-native
    SHARED
    ${VIBECORE_PLATFORM_SOURCES}
    ${VIBECORE_SYNC_SOURCES}
    ${VIBECORE_GRAPH_SOURCES}
    ${VIBECORE_THREAD_SOURCES}
    ${VIBECORE_GROOVE_SOURCES}
    ${VIBECORE_BASS_SOURCES}
    ${VIBECORE_BRIDGE_SOURCES}
)

# ─── Include paths ────────────────────────────────────────────────────────────

target_include_directories(vibecore-native PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/platform
    ${CMAKE_CURRENT_SOURCE_DIR}/platform/sync
    ${CMAKE_CURRENT_SOURCE_DIR}/graph
    ${CMAKE_CURRENT_SOURCE_DIR}/threads
    ${CMAKE_CURRENT_SOURCE_DIR}/groove
    ${CMAKE_CURRENT_SOURCE_DIR}/bass
    ${CMAKE_CURRENT_SOURCE_DIR}/bridge
)

# ─── Link libraries ───────────────────────────────────────────────────────────

target_link_libraries(vibecore-native
    oboe::oboe
    android
    log
    atomic
)

# ─── Compiler flags ───────────────────────────────────────────────────────────

target_compile_options(vibecore-native PRIVATE
    -O3
    -ffast-math
    -fno-exceptions
    -fno-rtti
    -fvisibility=hidden
    -Wall
    -Wextra
    -Wno-unused-parameter
)

target_compile_definitions(vibecore-native PRIVATE
    $<$<CONFIG:Debug>:VIBECORE_THREAD_ASSERTIONS=1>
    VIBECORE_PPQ=1920
)

set_target_properties(vibecore-native PROPERTIES
    CXX_VISIBILITY_PRESET hidden
    VISIBILITY_INLINES_HIDDEN ON
)

message(STATUS "VibeCore Native Platform — Phase 5 build (3D Bass + Groove Engine)")
message(STATUS "  Platform: ${VIBECORE_PLATFORM_SOURCES}")
message(STATUS "  Sync:     ${VIBECORE_SYNC_SOURCES}")
message(STATUS "  Graph:    ${VIBECORE_GRAPH_SOURCES}")
message(STATUS "  Groove:   ${VIBECORE_GROOVE_SOURCES}")
message(STATUS "  Bass:     ${VIBECORE_BASS_SOURCES}")
message(STATUS "  Oboe:     ${oboe_VERSION}")
