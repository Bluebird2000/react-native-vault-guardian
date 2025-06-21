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
declare const useVaultGuardian: () => VaultGuardianStatus;

export { useVaultGuardian };
