cmake_minimum_required(VERSION 3.22.1)
project(vibecore LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Oboe wird als Prefab-AAR via Gradle geliefert (com.google.oboe:oboe).
find_package(oboe REQUIRED CONFIG)

add_library(vibecore-native SHARED
    vibecore_engine.cpp
    jni_bridge.cpp
)

target_link_libraries(vibecore-native
    oboe::oboe
    android      # AssetManager, JNI
    log          # __android_log_print
)

# Echtzeit-sicher bauen: kein RTTI/Exceptions, aggressives Inlining.
target_compile_options(vibecore-native PRIVATE
    -O3 -ffast-math -fno-exceptions -fno-rtti -fvisibility=hidden
)