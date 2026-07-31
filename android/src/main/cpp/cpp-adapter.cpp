#include <fbjni/fbjni.h>
#include <jni.h>

#include "VersionCheckOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, []() { margelo::nitro::versioncheck::registerAllNatives(); });
}
