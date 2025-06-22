// FridaDetectionModule.m
#import <React/RCTBridgeModule.h>
#import <dlfcn.h>
#import <mach-o/dyld.h>

@interface FridaDetectionModule : NSObject <RCTBridgeModule>
@end

@implementation FridaDetectionModule

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(isFridaPresent:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  for (uint32_t i = 0; i < _dyld_image_count(); i++) {
    const char *image_name = _dyld_get_image_name(i);
    if (strstr(image_name, "frida") || strstr(image_name, "cycript")) {
      resolve(@(YES));
      return;
    }
  }
  resolve(@(NO));
}
@end
