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
import { useEffect, useRef, useState } from "react";
import {
  AppState,
  Platform,
  NativeModules,
  LogBox,
  Clipboard
} from "react-native";
var isAndroid = Platform.OS === "android";
var isIOS = Platform.OS === "ios";
var NATIVE_TIMEOUT = 3e3;
var CLIPBOARD_POLL_INTERVAL = 5e3;
LogBox.ignoreLogs(["[VaultGuardian]"]);
var log = (label, data) => {
  if (__DEV__) console.log(`[VaultGuardian] ${label}:`, data);
};
var logWarn = (label, data) => {
  if (__DEV__) console.warn(`[VaultGuardian:WARN] ${label}`, data);
};
var logError = (label, data) => {
  if (__DEV__) console.error(`[VaultGuardian:ERROR] ${label}`, data);
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
    logError(`${label} failed`, error);
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
    logError("Emulator check failed", e);
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
    logError("Root/Jailbreak check failed", e);
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
    logError("Debugger check failed", e);
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
      const delta2 = Math.abs(now - Number(secureTime));
      return delta2 > 5 * 60 * 1e3;
    }
    const start = performance.now();
    yield new Promise((res) => setTimeout(res, 100));
    const delta = performance.now() - start;
    return delta < 80 || delta > 150;
  } catch (e) {
    logError("Time tampering check failed", e);
    return false;
  }
});
var checkRuntimeIntegrity = () => __async(null, null, function* () {
  var _a, _b;
  try {
    const runtimeModule = (_a = NativeModules) == null ? void 0 : _a.RuntimeMonitorModule;
    const nativeCheck = yield withTimeout(
      (_b = runtimeModule == null ? void 0 : runtimeModule.checkRuntimeIntegrity) == null ? void 0 : _b.call(runtimeModule),
      "Runtime Integrity"
    );
    return !!nativeCheck;
  } catch (e) {
    logError("Runtime integrity check failed", e);
    return false;
  }
});
var detectHookTampering = () => {
  try {
    const originalConsoleLog = console.log.toString();
    return !originalConsoleLog.includes("native code");
  } catch (e) {
    logError("Hook tampering check failed", e);
    return false;
  }
};
var checkNetworkTampering = () => __async(null, null, function* () {
  var _a, _b, _c;
  try {
    const result = yield withTimeout(
      (_c = (_b = (_a = NativeModules) == null ? void 0 : _a.NetworkTamperModule) == null ? void 0 : _b.detectMITMAttack) == null ? void 0 : _c.call(_b),
      "Network Tampering"
    );
    return !!result;
  } catch (e) {
    logError("Network tampering check failed", e);
    return false;
  }
});
var validateCertificatePinning = () => __async(null, null, function* () {
  var _a, _b, _c;
  try {
    const result = yield withTimeout(
      (_c = (_b = (_a = NativeModules) == null ? void 0 : _a.SSLPinningModule) == null ? void 0 : _b.validatePinnedCertificate) == null ? void 0 : _c.call(_b),
      "Certificate Pinning"
    );
    return !!result;
  } catch (e) {
    logError("Cert pinning check failed", e);
    return false;
  }
});
var checkHardwareTampering = () => __async(null, null, function* () {
  var _a, _b, _c;
  try {
    const result = yield withTimeout(
      (_c = (_b = (_a = NativeModules) == null ? void 0 : _a.HardwareModule) == null ? void 0 : _b.isTampered) == null ? void 0 : _c.call(_b),
      "Hardware Tampering"
    );
    return !!result;
  } catch (e) {
    logError("Hardware tampering check failed", e);
    return false;
  }
});
var checkClipboardForSensitiveData = () => __async(null, null, function* () {
  try {
    const content = yield Clipboard.getString();
    if (!content) return false;
    const suspiciousPatterns = [
      /Bearer\s+[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+/,
      /\b4[0-9]{12}(?:[0-9]{3})?\b/,
      /\b\d{6}\b/
    ];
    const isSuspicious = suspiciousPatterns.some(
      (regex) => regex.test(content)
    );
    if (isSuspicious) Clipboard.setString("");
    return isSuspicious;
  } catch (e) {
    logError("Clipboard check failed", e);
    return false;
  }
});
var detectEnvTampering = () => {
  try {
    const suspiciousEnvKeys = ["NODE_OPTIONS", "LD_PRELOAD", "__REACT_DEVTOOLS_GLOBAL_HOOK__"];
    return suspiciousEnvKeys.some((key) => typeof global[key] !== "undefined");
  } catch (e) {
    logError("Env tampering check failed", e);
    return false;
  }
};
var detectFridaOrInjectedLibs = () => __async(null, null, function* () {
  var _a, _b, _c;
  try {
    const result = yield withTimeout(
      (_c = (_b = (_a = NativeModules) == null ? void 0 : _a.FridaDetectionModule) == null ? void 0 : _b.isFridaPresent) == null ? void 0 : _c.call(_b),
      "Frida Check"
    );
    return !!result;
  } catch (e) {
    logError("Frida detection failed", e);
    return false;
  }
});
var detectSignalTampering = () => __async(null, null, function* () {
  var _a, _b, _c;
  try {
    const result = yield withTimeout(
      (_c = (_b = (_a = NativeModules) == null ? void 0 : _a.SignalTamperModule) == null ? void 0 : _b.isSignalTampered) == null ? void 0 : _c.call(_b),
      "Signal Tamper Detection"
    );
    return !!result;
  } catch (e) {
    logWarn("Signal tamper detection not available", e);
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
    isClipboardSuspicious: false,
    isEnvTampered: false,
    isFridaDetected: false,
    isSignalTampered: false,
    loading: true
  });
  const clipboardIntervalRef = useRef(null);
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
        isHardwareTampered,
        isClipboardSuspicious,
        isFridaDetected,
        isSignalTampered
      ] = yield Promise.all([
        checkIfEmulator(),
        checkIfJailBrokenOrRooted(),
        checkDebugger(),
        checkTimeTampering(),
        checkRuntimeIntegrity(),
        checkNetworkTampering(),
        validateCertificatePinning(),
        checkHardwareTampering(),
        checkClipboardForSensitiveData(),
        detectFridaOrInjectedLibs(),
        detectSignalTampering()
      ]);
      const isHookTampered = detectHookTampering();
      const isEnvTampered = detectEnvTampering();
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
          isClipboardSuspicious,
          isEnvTampered,
          isFridaDetected,
          isSignalTampered,
          loading: false
        }));
      }
    });
    performChecks();
    const appStateSubscription = AppState.addEventListener("change", (nextAppState) => {
      setStatus((prev) => __spreadProps(__spreadValues({}, prev), {
        isAppInBackground: nextAppState !== "active"
      }));
    });
    clipboardIntervalRef.current = setInterval(() => __async(null, null, function* () {
      const suspicious = yield checkClipboardForSensitiveData();
      if (suspicious) {
        setStatus((prev) => __spreadProps(__spreadValues({}, prev), { isClipboardSuspicious: true }));
      }
    }), CLIPBOARD_POLL_INTERVAL);
    return () => {
      isMounted = false;
      appStateSubscription.remove();
      if (clipboardIntervalRef.current) clearInterval(clipboardIntervalRef.current);
    };
  }, []);
  return status;
};
export {
  useVaultGuardian
};
