public class HardwareModule extends ReactContextBaseJavaModule {
  public HardwareModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return "HardwareModule";
  }

  @ReactMethod
  public void isTampered(Promise promise) {
    boolean tampered = Build.FINGERPRINT.contains("generic") ||
                       Build.MODEL.contains("Emulator") ||
                       Build.MANUFACTURER.contains("Genymotion") ||
                       Build.BRAND.startsWith("generic") ||
                       Build.DEVICE.startsWith("generic");
    promise.resolve(tampered);
  }
}
