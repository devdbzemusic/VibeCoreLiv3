if(NOT TARGET oboe::oboe)
add_library(oboe::oboe SHARED IMPORTED)
set_target_properties(oboe::oboe PROPERTIES
    IMPORTED_LOCATION "/home/runner/.gradle/caches/transforms-4/81f64aead9b355bd19655219c6d751b7/transformed/oboe-1.9.0/prefab/modules/oboe/libs/android.armeabi-v7a/liboboe.so"
    INTERFACE_INCLUDE_DIRECTORIES "/home/runner/.gradle/caches/transforms-4/81f64aead9b355bd19655219c6d751b7/transformed/oboe-1.9.0/prefab/modules/oboe/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

