var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/index.ts
import { useEffect, useState } from "react";
import {
  AppState,
  Platform,
  NativeModules,
  LogBox
} from "react-native";
var isAndroid = Platform.OS === "android";
var isIOS = Platform.OS === "ios";
var NATIVE_TIMEOUT = 3e3;
LogBox.ignoreLogs(["[VaultGuardian]"]);
var log = (label, data) => {
  if (__DEV__) console.log(`[VaultGuardian] ${label}:`, data);
};
var withTimeout = (promise, label = "") => __async(null, null, function* () {
  try {
    return yield Promise.race([
      promise,
      new Promise((resolve) => {
        setTimeout(() => {
          log(`${label} timeout`, null);
          resolve(null);
        }, NATIVE_TIMEOUT);
      })
    ]);
  } catch (error) {
    log(`${label} failed`, error);
    return null;
  }
});
var checkIfEmulator = () => __async(null, null, function* () {
  var _a, _b, _c, _d, _e;
  try {
    if (isAndroid) {
      const buildProps = yield withTimeout(
        (_c = (_b = (_a = NativeModules) == null ? void 0 : _a.DeviceInfoModule) == null ? void 0 : _b.getBuildProps) == null ? void 0 : _c.call(_b),
        "Android Emulator Check"
      );
      if (!buildProps) return false;
      const combined = Object.values(buildProps).join("").toLowerCase();
      return /generic|sdk|emulator|x86|goldfish|ranchu/i.test(combined);
    }
    if (isIOS) {
      const model = (yield withTimeout(
        Promise.resolve((_e = (_d = NativeModules) == null ? void 0 : _d.DeviceInfoModule) == null ? void 0 : _e.model),
        "iOS Emulator Check"
      )) || "";
      return /simulator|x86_64|i386/i.test(model.toLowerCase());
    }
  } catch (e) {
    log("Emulator check failed", e);
  }
  return false;
});
var checkIfJailBrokenOrRooted = () => __async(null, null, function* () {
  var _a, _b, _c, _d;
  try {
    const fs = (_a = NativeModules) == null ? void 0 : _a.FileSystemModule;
    if (!fs) return false;
    const [rootAccess, jailbreakPaths, suAccess] = yield Promise.all([
      withTimeout((_b = fs == null ? void 0 : fs.checkRootAccess) == null ? void 0 : _b.call(fs), "Root Access"),
      withTimeout((_c = fs == null ? void 0 : fs.checkJailBreakPaths) == null ? void 0 : _c.call(fs), "Jailbreak Paths"),
      withTimeout((_d = fs == null ? void 0 : fs.canExecuteSU) == null ? void 0 : _d.call(fs), "SU Binary Access")
    ]);
    return Boolean(rootAccess || jailbreakPaths || suAccess);
  } catch (e) {
    log("Root/Jailbreak check failed", e);
    return false;
  }
});
var checkDebugger = () => __async(null, null, function* () {
  var _a, _b, _c;
  try {
    if (global.__REACT_DEVTOOLS_GLOBAL_HOOK__) return true;
    const nativeCheck = yield withTimeout(
      (_c = (_b = (_a = NativeModules) == null ? void 0 : _a.DebuggerModule) == null ? void 0 : _b.isDebuggerConnected) == null ? void 0 : _c.call(_b),
      "Debugger Check"
    );
    return !!nativeCheck;
  } catch (e) {
    log("Debugger check failed", e);
    return false;
  }
});
var checkTimeTampering = () => __async(null, null, function* () {
  var _a, _b, _c;
  try {
    const now = Date.now();
    const year = new Date(now).getFullYear();
    if (year < 2015 || year > 2100) return true;
    const secureTime = yield withTimeout(
      (_c = (_b = (_a = NativeModules) == null ? void 0 : _a.SecureTimeModule) == null ? void 0 : _b.getSecureTime) == null ? void 0 : _c.call(_b),
      "Secure Time"
    );
    if (secureTime) {
      const delta = Math.abs(now - Number(secureTime));
      return delta > 5 * 60 * 1e3;
    }
    return false;
  } catch (e) {
    log("Time tampering check failed", e);
    return false;
  }
});
var checkRuntimeIntegrity = () => __async(null, null, function* () {
  var _a;
  try {
    const runtimeModule = (_a = NativeModules) == null ? void 0 : _a.RuntimeMonitorModule;
    if (!(runtimeModule == null ? void 0 : runtimeModule.checkRuntimeIntegrity)) return false;
    const nativeCheck = yield withTimeout(
      runtimeModule.checkRuntimeIntegrity(),
      "Runtime Integrity"
    );
    return !!nativeCheck;
  } catch (e) {
    log("Runtime integrity check failed", e);
    return false;
  }
});
var detectHookTampering = () => {
  try {
    const originalConsoleLog = console.log.toString();
    return !originalConsoleLog.includes("native code");
  } catch (e) {
    log("Hook tampering check failed", e);
    return false;
  }
};
var checkNetworkTampering = () => __async(null, null, function* () {
  var _a, _b;
  try {
    const networkModule = (_a = NativeModules) == null ? void 0 : _a.NetworkTamperModule;
    const result = yield withTimeout(
      (_b = networkModule == null ? void 0 : networkModule.detectMITMAttack) == null ? void 0 : _b.call(networkModule),
      "Network Tampering"
    );
    return !!result;
  } catch (e) {
    log("Network tampering check failed", e);
    return false;
  }
});
var validateCertificatePinning = () => __async(null, null, function* () {
  var _a, _b;
  try {
    const sslModule = (_a = NativeModules) == null ? void 0 : _a.SSLPinningModule;
    const result = yield withTimeout(
      (_b = sslModule == null ? void 0 : sslModule.validatePinnedCertificate) == null ? void 0 : _b.call(sslModule),
      "Certificate Pinning"
    );
    return !!result;
  } catch (e) {
    log("Cert pinning check failed", e);
    return false;
  }
});
var checkHardwareTampering = () => __async(null, null, function* () {
  var _a, _b;
  try {
    const hardwareModule = (_a = NativeModules) == null ? void 0 : _a.HardwareModule;
    const result = yield withTimeout(
      (_b = hardwareModule == null ? void 0 : hardwareModule.isTampered) == null ? void 0 : _b.call(hardwareModule),
      "Hardware Tampering"
    );
    return !!result;
  } catch (e) {
    log("Hardware tampering check failed", e);
    return false;
  }
});
var useVaultGuardian = () => {
  const [status, setStatus] = useState({
    isEmulator: false,
    isJailBrokenOrRooted: false,
    isDebuggerConnected: false,
    isAppInBackground: AppState.currentState !== "active",
    isTimeTampered: false,
    isRuntimeTampered: false,
    isHookTampered: false,
    isNetworkTampered: false,
    isCertificatePinnedValid: true,
    isHardwareTampered: false,
    loading: true
  });
  useEffect(() => {
    let isMounted = true;
    const performChecks = () => __async(null, null, function* () {
      const [
        isEmulator,
        isJailBrokenOrRooted,
        isDebuggerConnected,
        isTimeTampered,
        isRuntimeTampered,
        isNetworkTampered,
        isCertificatePinnedValid,
        isHardwareTampered
      ] = yield Promise.all([
        checkIfEmulator(),
        checkIfJailBrokenOrRooted(),
        checkDebugger(),
        checkTimeTampering(),
        checkRuntimeIntegrity(),
        checkNetworkTampering(),
        validateCertificatePinning(),
        checkHardwareTampering()
      ]);
      const isHookTampered = detectHookTampering();
      if (isMounted) {
        setStatus((prev) => __spreadProps(__spreadValues({}, prev), {
          isEmulator,
          isJailBrokenOrRooted,
          isDebuggerConnected,
          isTimeTampered,
          isRuntimeTampered,
          isHookTampered,
          isNetworkTampered,
          isCertificatePinnedValid,
          isHardwareTampered,
          loading: false
        }));
      }
    });
    performChecks();
    const subscription = AppState.addEventListener(
      "change",
      (nextAppState) => {
        setStatus((prev) => __spreadProps(__spreadValues({}, prev), {
          isAppInBackground: nextAppState !== "active"
        }));
      }
    );
    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);
  return status;
};
export {
  useVaultGuardian
};
