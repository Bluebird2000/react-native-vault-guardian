// FridaDetectionModule.java
package com.yourapp.security;

import com.facebook.react.bridge.*;

public class FridaDetectionModule extends ReactContextBaseJavaModule {
  public FridaDetectionModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return "FridaDetectionModule";
  }

  @ReactMethod
  public void isFridaPresent(Promise promise) {
    try {
      String[] suspiciousLibs = {
        "frida", "gum-js-loop", "libsubstrate.so", "xposed", "libxposed_art.so"
      };

      for (String lib : suspiciousLibs) {
        try {
          System.loadLibrary(lib);
          promise.resolve(true); // Suspicious library loaded
          return;
        } catch (UnsatisfiedLinkError ignored) {
          // Normal case if not present
        }
      }

      promise.resolve(false);
    } catch (Exception e) {
      promise.reject("FRIDA_DETECTION_ERROR", e);
    }
  }
}
