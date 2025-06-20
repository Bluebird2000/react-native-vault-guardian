import { useEffect, useState } from "react";
import {
  AppState,
  AppStateStatus,
  Platform,
  NativeModules,
  LogBox,
  Clipboard
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

    // Add patterns of sensitive data (e.g. JWT, tokens, card numbers)
    const suspiciousPatterns = [
      /Bearer\s+[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+/, // JWT
      /\b4[0-9]{12}(?:[0-9]{3})?\b/, // Visa-like card numbers
      /\b\d{6}\b/, // OTP
    ];

    return suspiciousPatterns.some((regex) => regex.test(content));
  } catch (e) {
    log("Clipboard check failed", e);
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
      ]);

      const isHookTampered = detectHookTampering();

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