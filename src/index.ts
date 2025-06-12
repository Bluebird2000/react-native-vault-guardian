// src/index.ts

import { useEffect, useState } from 'react';
import { AppState, AppStateStatus, Platform, NativeModules } from 'react-native';

export type VaultGuardianStatus = {
  isEmulator: boolean;
  isJailBrokenOrRooted: boolean;
  isDebuggerConnected: boolean;
  isAppInBackground: boolean;
  isTimeTampered: boolean;
};

const checkIfEmulator = (): boolean => {
  if (Platform.OS === 'android') {
    const brand = (NativeModules.DeviceInfoModule?.brand || '').toLowerCase();
    return brand === 'generic';
  }
  if (Platform.OS === 'ios') {
    const model = (NativeModules.DeviceInfoModule?.model || '').toLowerCase();
    return model.includes('simulator');
  }
  return false;
};

const checkIfJailBrokenOrRooted = (): boolean => {
  try {
    const fs = NativeModules.FileSystemModule;
    return fs?.checkRootAccess?.() || false;
  } catch {
    return false;
  }
};

const checkDebugger = (): boolean => {
  return Boolean(global?.__REACT_DEVTOOLS_GLOBAL_HOOK__);
};

const checkTimeTampering = (): boolean => {
  const now = new Date();
  return now.getFullYear() < 2010 || now.getFullYear() > 2100;
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
    const appStateListener = (nextAppState: AppStateStatus) => {
      setStatus(prev => ({ ...prev, isAppInBackground: nextAppState !== 'active' }));
    };

    setStatus({
      isEmulator: checkIfEmulator(),
      isJailBrokenOrRooted: checkIfJailBrokenOrRooted(),
      isDebuggerConnected: checkDebugger(),
      isAppInBackground: AppState.currentState !== 'active',
      isTimeTampered: checkTimeTampering(),
    });

    const subscription = AppState.addEventListener('change', appStateListener);

    return () => {
      subscription.remove();
    };
  }, []);

  return status;
};
