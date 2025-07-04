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
declare const useVaultGuardian: () => VaultGuardianStatus;

export { useVaultGuardian };
