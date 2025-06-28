import { useEffect, useState } from "react";
import {
  AppState,
  AppStateStatus,
  Platform,
  NativeModules,
  LogBox,
  Clipboard,
} from "react-native";

type VaultGuardianStatus = {
  isEmulator: boolean;
  isJailBrokenOrRooted: boolean;
  isDebuggerConnected: boolean;
  isAppInBackground: boolean;
  isTimeTampered: boolean;
  isRuntimeTampered: boolean;
  isHookTampered?: boolean;
  isNetworkTampered?: boolean;
  isCertificatePinnedValid?: boolean;
  isHardwareTampered?: boolean;
  isClipboardSuspicious?: boolean;
  isEnvTampered?: boolean;
  isFridaDetected?: boolean;
  isOverlayAttackDetected?: boolean;
  isScreenBeingRecorded?: boolean;
  isAppSignatureValid?: boolean;
  isMockLocationEnabled?: boolean;
  isMemoryDumped?: boolean;
  loading: boolean;
};

const isAndroid = Platform.OS === "android";
const isIOS = Platform.OS === "ios";
const NATIVE_TIMEOUT = 3000;

LogBox.ignoreLogs(["[VaultGuardian]"]);

const log = (label: string, data: unknown) => {
  if (__DEV__) console.log(`[VaultGuardian] ${label}:`, data);
};

const withTimeout = async <T>(
  promise: Promise<T>,
  label = ""
): Promise<T | null> => {
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        setTimeout(() => {
          log(`${label} timeout`, null);
          resolve(null);
        }, NATIVE_TIMEOUT);
      }),
    ]);
  } catch (error) {
    log(`${label} failed`, error);
    return null;
  }
};

const checkIfEmulator = async (): Promise<boolean> => {
  try {
    if (isAndroid) {
      const buildProps = await withTimeout(
        NativeModules?.DeviceInfoModule?.getBuildProps?.(),
        "Android Emulator Check"
      );
      if (!buildProps) return false;
      const combined = Object.values(buildProps).join("").toLowerCase();
      return /generic|sdk|emulator|x86|goldfish|ranchu/i.test(combined);
    }
    if (isIOS) {
      const model =
        (await withTimeout(
          Promise.resolve(NativeModules?.DeviceInfoModule?.model),
          "iOS Emulator Check"
        )) || "";
      return /simulator|x86_64|i386/i.test(model.toLowerCase());
    }
  } catch (e) {
    log("Emulator check failed", e);
  }
  return false;
};

const checkIfJailBrokenOrRooted = async (): Promise<boolean> => {
  try {
    const fs = NativeModules?.FileSystemModule;
    if (!fs) return false;

    const [rootAccess, jailbreakPaths, suAccess] = await Promise.all([
      withTimeout(fs?.checkRootAccess?.(), "Root Access"),
      withTimeout(fs?.checkJailBreakPaths?.(), "Jailbreak Paths"),
      withTimeout(fs?.canExecuteSU?.(), "SU Binary Access"),
    ]);

    return Boolean(rootAccess || jailbreakPaths || suAccess);
  } catch (e) {
    log("Root/Jailbreak check failed", e);
    return false;
  }
};

const checkDebugger = async (): Promise<boolean> => {
  try {
    if ((global as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) return true;
    const nativeCheck = await withTimeout(
      NativeModules?.DebuggerModule?.isDebuggerConnected?.(),
      "Debugger Check"
    );
    return !!nativeCheck;
  } catch (e) {
    log("Debugger check failed", e);
    return false;
  }
};

const checkTimeTampering = async (): Promise<boolean> => {
  try {
    const now = Date.now();
    const year = new Date(now).getFullYear();
    if (year < 2015 || year > 2100) return true;

    const secureTime = await withTimeout(
      NativeModules?.SecureTimeModule?.getSecureTime?.(),
      "Secure Time"
    );

    if (secureTime) {
      const delta = Math.abs(now - Number(secureTime));
      return delta > 5 * 60 * 1000;
    }
    return false;
  } catch (e) {
    log("Time tampering check failed", e);
    return false;
  }
};

const checkRuntimeIntegrity = async (): Promise<boolean> => {
  try {
    const runtimeModule = NativeModules?.RuntimeMonitorModule;
    if (!runtimeModule?.checkRuntimeIntegrity) return false;
    const nativeCheck = await withTimeout(
      runtimeModule.checkRuntimeIntegrity(),
      "Runtime Integrity"
    );
    return !!nativeCheck;
  } catch (e) {
    log("Runtime integrity check failed", e);
    return false;
  }
};

const detectHookTampering = (): boolean => {
  try {
    const originalConsoleLog = console.log.toString();
    return !originalConsoleLog.includes("native code");
  } catch (e) {
    log("Hook tampering check failed", e);
    return false;
  }
};

const checkNetworkTampering = async (): Promise<boolean> => {
  try {
    const networkModule = NativeModules?.NetworkTamperModule;
    const result = await withTimeout(
      networkModule?.detectMITMAttack?.(),
      "Network Tampering"
    );
    return !!result;
  } catch (e) {
    log("Network tampering check failed", e);
    return false;
  }
};

const validateCertificatePinning = async (): Promise<boolean> => {
  try {
    const sslModule = NativeModules?.SSLPinningModule;
    const result = await withTimeout(
      sslModule?.validatePinnedCertificate?.(),
      "Certificate Pinning"
    );
    return !!result;
  } catch (e) {
    log("Cert pinning check failed", e);
    return false;
  }
};

const checkHardwareTampering = async (): Promise<boolean> => {
  try {
    const hardwareModule = NativeModules?.HardwareModule;
    const result = await withTimeout(
      hardwareModule?.isTampered?.(),
      "Hardware Tampering"
    );
    return !!result;
  } catch (e) {
    log("Hardware tampering check failed", e);
    return false;
  }
};

const checkClipboardForSensitiveData = async (): Promise<boolean> => {
  try {
    const content = await Clipboard.getString();
    if (!content) return false;

    const suspiciousPatterns = [
      /Bearer\s+[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+/,
      /\b4[0-9]{12}(?:[0-9]{3})?\b/,
      /\b\d{6}\b/,
    ];

    const isSuspicious = suspiciousPatterns.some((regex) =>
      regex.test(content)
    );

    if (isSuspicious) {
      Clipboard.setString(""); // Clear clipboard
    }

    return isSuspicious;
  } catch (e) {
    log("Clipboard check failed", e);
    return false;
  }
};

const checkOverlayAttack = async (): Promise<boolean> => {
  try {
    const result = await withTimeout(
      NativeModules?.OverlayDetectionModule?.isOverlayActive?.(),
      "Overlay Attack Check"
    );
    return !!result;
  } catch (e) {
    log("Overlay check failed", e);
    return false;
  }
};

const checkAppSignature = async (): Promise<boolean> => {
  try {
    const result = await withTimeout(
      NativeModules?.SignatureModule?.isSignatureValid?.(),
      "App Signature Validation"
    );
    return !!result;
  } catch (e) {
    log("App signature check failed", e);
    return false;
  }
};

const checkScreenRecording = async (): Promise<boolean> => {
  try {
    const result = await withTimeout(
      NativeModules?.ScreenSecurityModule?.isScreenBeingCaptured?.(),
      "Screen Recording Check"
    );
    return !!result;
  } catch (e) {
    log("Screen recording check failed", e);
    return false;
  }
};

const checkMockLocation = async (): Promise<boolean> => {
  try {
    const result = await withTimeout(
      NativeModules?.LocationModule?.isMockLocationEnabled?.(),
      "Mock Location Check"
    );
    return !!result;
  } catch (e) {
    log("Mock location check failed", e);
    return false;
  }
};

const detectMemoryDump = async (): Promise<boolean> => {
  try {
    const memoryModule = NativeModules?.MemoryCheckModule;
    const result = await withTimeout(
      memoryModule?.isMemoryDumped?.(),
      "Memory Dump Check"
    );
    return !!result;
  } catch (e) {
    log("Memory dump detection failed", e);
    return false;
  }
};

const detectEnvTampering = (): boolean => {
  try {
    const suspiciousEnvKeys = [
      "NODE_OPTIONS",
      "LD_PRELOAD",
      "__REACT_DEVTOOLS_GLOBAL_HOOK__",
    ];
    return suspiciousEnvKeys.some(
      (key) => typeof (global as any)[key] !== "undefined"
    );
  } catch (e) {
    log("Env tampering check failed", e);
    return false;
  }
};

const detectFridaOrInjectedLibs = async (): Promise<boolean> => {
  try {
    const fridaCheck = await withTimeout(
      NativeModules?.FridaDetectionModule?.isFridaPresent?.(),
      "Frida Check"
    );
    return !!fridaCheck;
  } catch (e) {
    log("Frida detection failed", e);
    return false;
  }
};

export const useVaultGuardian = (): VaultGuardianStatus => {
  const [status, setStatus] = useState<VaultGuardianStatus>({
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
    loading: true,
  });

  useEffect(() => {
    let isMounted = true;

    const performChecks = async () => {
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
        isOverlayAttackDetected,
        isScreenBeingRecorded,
        isAppSignatureValid,
        isMockLocationEnabled,
        isMemoryDumped
      ] = await Promise.all([
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
        checkOverlayAttack(),
        checkScreenRecording(),
        checkAppSignature(),
        checkMockLocation(),
        detectMemoryDump(),
      ]);

      const isHookTampered = detectHookTampering();
      const isEnvTampered = detectEnvTampering();

      if (isMounted) {
        setStatus((prev) => ({
          ...prev,
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
          isOverlayAttackDetected,
          isScreenBeingRecorded,
          isAppSignatureValid,
          isMockLocationEnabled,
          isMemoryDumped,
          loading: false,
        }));
      }
    };

    performChecks();

    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        setStatus((prev) => ({
          ...prev,
          isAppInBackground: nextAppState !== "active",
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
