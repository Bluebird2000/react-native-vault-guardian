import { useEffect, useState } from "react";
import {
  AppState,
  AppStateStatus,
  Platform,
  NativeModules,
} from "react-native";

export type VaultGuardianStatus = {
  isEmulator: boolean;
  isJailBrokenOrRooted: boolean;
  isDebuggerConnected: boolean;
  isAppInBackground: boolean;
  isTimeTampered: boolean;
};

const isAndroid = Platform.OS === "android";
const isIOS = Platform.OS === "ios";

const checkIfEmulator = (): boolean => {
  try {
    if (isAndroid) {
      const buildProps =
        NativeModules?.DeviceInfoModule?.getBuildProps?.() || {};
      const {
        brand = "",
        device = "",
        fingerprint = "",
        hardware = "",
        model = "",
        product = "",
      } = buildProps;

      return /generic|sdk|emulator|x86|goldfish|ranchu/i.test(
        `${brand}${device}${fingerprint}${hardware}${model}${product}`
      );
    }

    if (isIOS) {
      const model = NativeModules?.DeviceInfoModule?.model || "";
      return /simulator|x86_64|i386/i.test(model);
    }
  } catch (e) {
    console.warn("Emulator check failed:", e);
  }

  return false;
};

const checkIfJailBrokenOrRooted = (): boolean => {
  try {
    const fs = NativeModules?.FileSystemModule;

    return (
      fs?.checkRootAccess?.() ||
      fs?.checkJailBreakPaths?.() ||
      fs?.canExecuteSU?.() ||
      false
    );
  } catch (e) {
    console.warn("Jailbreak/root detection failed:", e);
    return false;
  }
};

const checkDebugger = (): boolean => {
  try {
    const devToolsHook = (global as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (devToolsHook) return true;

    const nativeCheck = NativeModules?.DebuggerModule?.isDebuggerConnected?.();
    return !!nativeCheck;
  } catch (e) {
    console.warn("Debugger check failed:", e);
    return false;
  }
};

// Improved Time Tampering Detection
const checkTimeTampering = (): boolean => {
  try {
    const now = new Date();
    const year = now.getFullYear();

    if (year < 2015 || year > 2100) return true;

    // Optional: Trust secure native time module
    const nativeTime = NativeModules?.SecureTimeModule?.getSecureTime?.();
    if (nativeTime && Math.abs(now.getTime() - nativeTime) > 5 * 60 * 1000) {
      return true;
    }

    return false;
  } catch (e) {
    console.warn("Time tampering check failed:", e);
    return false;
  }
};

export const useVaultGuardian = (): VaultGuardianStatus => {
  const [status, setStatus] = useState<VaultGuardianStatus>({
    isEmulator: false,
    isJailBrokenOrRooted: false,
    isDebuggerConnected: false,
    isAppInBackground: false,
    isTimeTampered: false,
  });

  useEffect(() => {
    const performChecks = async () => {
      const results: VaultGuardianStatus = {
        isEmulator: checkIfEmulator(),
        isJailBrokenOrRooted: checkIfJailBrokenOrRooted(),
        isDebuggerConnected: checkDebugger(),
        isAppInBackground: AppState.currentState !== "active",
        isTimeTampered: checkTimeTampering(),
      };

      setStatus(results);
    };

    const appStateListener = (nextAppState: AppStateStatus) => {
      setStatus((prev) => ({
        ...prev,
        isAppInBackground: nextAppState !== "active",
      }));
    };

    performChecks();

    const subscription = AppState.addEventListener("change", appStateListener);
    return () => subscription.remove();
  }, []);

  return status;
};
