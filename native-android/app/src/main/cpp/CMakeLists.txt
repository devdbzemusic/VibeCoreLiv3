cmake_minimum_required(VERSION 3.22.1)
project(vibecore_native VERSION 1.0.0 LANGUAGES CXX)

# ─── C++ standard ─────────────────────────────────────────────────────────────
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# ─── Oboe via Prefab ──────────────────────────────────────────────────────────
find_package(oboe REQUIRED CONFIG)

# ─── Source files ─────────────────────────────────────────────────────────────
set(VIBECORE_PLATFORM_SOURCES
    platform/VibeCoreAudioEngine.cpp
    platform/AudioDeviceManager.cpp
    platform/AudioSessionManager.cpp
    platform/PerformanceMonitor.cpp
    platform/Diagnostics.cpp
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

# Legacy engine — kept for backward compatibility during transition.
# Will be removed once all callers migrate to VibeCoreAudioEngine.
set(VIBECORE_LEGACY_SOURCES
    vibecore_engine.cpp
    # jni_bridge.cpp (old) — superseded by bridge/jni_bridge.cpp
)

# ─── Shared library ───────────────────────────────────────────────────────────
add_library(
    vibecore-native
    SHARED
    ${VIBECORE_PLATFORM_SOURCES}
    ${VIBECORE_GRAPH_SOURCES}
    ${VIBECORE_THREAD_SOURCES}
    ${VIBECORE_BRIDGE_SOURCES}
    # Legacy sources are intentionally excluded in Phase 1 new build.
    # Uncomment if backward-compat JNI symbols are needed:
    # ${VIBECORE_LEGACY_SOURCES}
)

# ─── Include paths ────────────────────────────────────────────────────────────
target_include_directories(vibecore-native PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/platform
    ${CMAKE_CURRENT_SOURCE_DIR}/graph
    ${CMAKE_CURRENT_SOURCE_DIR}/threads
    ${CMAKE_CURRENT_SOURCE_DIR}/bridge
)

# ─── Link libraries ───────────────────────────────────────────────────────────
target_link_libraries(vibecore-native
    oboe::oboe
    android
    log
    atomic  # for std::atomic on older NDKs
)

# ─── Compiler flags — realtime safety ────────────────────────────────────────
target_compile_options(vibecore-native PRIVATE
    -O3
    -ffast-math
    -fno-exceptions        # exceptions are forbidden on the audio thread
    -fno-rtti
    -fvisibility=hidden    # only JNI symbols exported
    -Wall
    -Wextra
    -Wno-unused-parameter
)

# Debug builds: enable thread assertions
target_compile_definitions(vibecore-native PRIVATE
    $<$<CONFIG:Debug>:VIBECORE_THREAD_ASSERTIONS=1>
)

# ─── Export only JNI symbols ──────────────────────────────────────────────────
set_target_properties(vibecore-native PROPERTIES
    CXX_VISIBILITY_PRESET hidden
    VISIBILITY_INLINES_HIDDEN ON
)

# ─── Phase 1 validation target ────────────────────────────────────────────────
# This target verifies the platform compiles and links cleanly.
# Run: cmake --build . --target vibecore-native
# Expected: no errors, no warnings about audio-thread safety violations.
message(STATUS "VibeCore Native Platform — Phase 1 build")
message(STATUS "  Sources: platform/ graph/ threads/ bridge/")
message(STATUS "  Oboe: ${oboe_VERSION}")
message(STATUS "  C++ standard: ${CMAKE_CXX_STANDARD}")
