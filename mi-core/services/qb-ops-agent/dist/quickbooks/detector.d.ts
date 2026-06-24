export interface QuickBooksStatus {
    installed: boolean;
    running: boolean;
    version: string | null;
    processName: string | null;
}
export declare function isQuickBooksRunning(): boolean;
export declare function detectInstalledQuickBooksVersion(): string | null;
export declare function detectQuickBooksStatus(): QuickBooksStatus;
export declare function getActiveCompanyFilePathIfPossible(): string | null;
//# sourceMappingURL=detector.d.ts.map