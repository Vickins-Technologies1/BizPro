if(NOT TARGET ReactAndroid::hermestooling)
add_library(ReactAndroid::hermestooling SHARED IMPORTED)
set_target_properties(ReactAndroid::hermestooling PROPERTIES
    IMPORTED_LOCATION "C:/Users/ABCD/.gradle/caches/8.13/transforms/0b4d493c06a8cc9a1e94de656f7c8286/transformed/react-android-0.79.6-release/prefab/modules/hermestooling/libs/android.armeabi-v7a/libhermestooling.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/ABCD/.gradle/caches/8.13/transforms/0b4d493c06a8cc9a1e94de656f7c8286/transformed/react-android-0.79.6-release/prefab/modules/hermestooling/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

if(NOT TARGET ReactAndroid::jsctooling)
add_library(ReactAndroid::jsctooling SHARED IMPORTED)
set_target_properties(ReactAndroid::jsctooling PROPERTIES
    IMPORTED_LOCATION "C:/Users/ABCD/.gradle/caches/8.13/transforms/0b4d493c06a8cc9a1e94de656f7c8286/transformed/react-android-0.79.6-release/prefab/modules/jsctooling/libs/android.armeabi-v7a/libjsctooling.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/ABCD/.gradle/caches/8.13/transforms/0b4d493c06a8cc9a1e94de656f7c8286/transformed/react-android-0.79.6-release/prefab/modules/jsctooling/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

if(NOT TARGET ReactAndroid::jsi)
add_library(ReactAndroid::jsi SHARED IMPORTED)
set_target_properties(ReactAndroid::jsi PROPERTIES
    IMPORTED_LOCATION "C:/Users/ABCD/.gradle/caches/8.13/transforms/0b4d493c06a8cc9a1e94de656f7c8286/transformed/react-android-0.79.6-release/prefab/modules/jsi/libs/android.armeabi-v7a/libjsi.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/ABCD/.gradle/caches/8.13/transforms/0b4d493c06a8cc9a1e94de656f7c8286/transformed/react-android-0.79.6-release/prefab/modules/jsi/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

if(NOT TARGET ReactAndroid::reactnative)
add_library(ReactAndroid::reactnative SHARED IMPORTED)
set_target_properties(ReactAndroid::reactnative PROPERTIES
    IMPORTED_LOCATION "C:/Users/ABCD/.gradle/caches/8.13/transforms/0b4d493c06a8cc9a1e94de656f7c8286/transformed/react-android-0.79.6-release/prefab/modules/reactnative/libs/android.armeabi-v7a/libreactnative.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/ABCD/.gradle/caches/8.13/transforms/0b4d493c06a8cc9a1e94de656f7c8286/transformed/react-android-0.79.6-release/prefab/modules/reactnative/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

