cmake_minimum_required(VERSION 3.22.1)
project(vibecore_native VERSION 2.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(oboe REQUIRED CONFIG)

# ─── Source files ─────────────────────────────────────────────────────────────

set(VIBECORE_PLATFORM_SOURCES
    platform/VibeCoreAudioEngine.cpp
    platform/AudioDeviceManager.cpp
    platform/AudioSessionManager.cpp
    platform/PerformanceMonitor.cpp
    platform/Diagnostics.cpp
)

set(VIBECORE_SYNC_SOURCES       # Phase 2 — VibeCore Sync
    platform/sync/VibeCoreSync.cpp
)

set(VIBECORE_GRAPH_SOURCES
    graph/AudioGraphManager.cpp
    graph/MixerNode.cpp
)

set(VIBECORE_THREAD_SOURCES
    threads/ThreadModel.cpp
)

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
    ${VIBECORE_BRIDGE_SOURCES}
)

# ─── Include paths ────────────────────────────────────────────────────────────

target_include_directories(vibecore-native PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/platform
    ${CMAKE_CURRENT_SOURCE_DIR}/platform/sync
    ${CMAKE_CURRENT_SOURCE_DIR}/graph
    ${CMAKE_CURRENT_SOURCE_DIR}/threads
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

message(STATUS "VibeCore Native Platform — Phase 2 build (Sync)")
message(STATUS "  Platform: ${VIBECORE_PLATFORM_SOURCES}")
message(STATUS "  Sync:     ${VIBECORE_SYNC_SOURCES}")
message(STATUS "  Graph:    ${VIBECORE_GRAPH_SOURCES}")
message(STATUS "  Oboe:     ${oboe_VERSION}")
