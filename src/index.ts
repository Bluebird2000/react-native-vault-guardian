import { useEffect, useState } from "react";
import {
  AppState,
  AppStateStatus,
  Platform,
  NativeModules,
  LogBox,
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
  loading: boolean;
};

type BuildProps = {
  brand?: string;
  device?: string;
  fingerprint?: string;
  hardware?: string;
  model?: string;
  product?: string;
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
      const buildProps = await withTimeout<BuildProps>(
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

export const useVaultGuardian = (): VaultGuardianStatus => {
  const [status, setStatus] = useState<VaultGuardianStatus>({
    isEmulator: false,
    isJailBrokenOrRooted: false,
    isDebuggerConnected: false,
    isAppInBackground: AppState.currentState !== "active",
    isTimeTampered: false,
    isRuntimeTampered: false,
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
      ] = await Promise.all([
        checkIfEmulator(),
        checkIfJailBrokenOrRooted(),
        checkDebugger(),
        checkTimeTampering(),
        checkRuntimeIntegrity(),
      ]);

      if (isMounted) {
        setStatus((prev) => ({
          ...prev,
          isEmulator,
          isJailBrokenOrRooted,
          isDebuggerConnected,
          isTimeTampered,
          isRuntimeTampered,
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
