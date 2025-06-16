type VaultGuardianStatus = {
    isEmulator: boolean;
    isJailBrokenOrRooted: boolean;
    isDebuggerConnected: boolean;
    isAppInBackground: boolean;
    isTimeTampered: boolean;
    isRuntimeTampered: boolean;
};
declare const useVaultGuardian: () => VaultGuardianStatus;

export { useVaultGuardian };
