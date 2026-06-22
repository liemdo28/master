export interface MachineIdentity {
    machine_id: string;
    hostname: string;
    windows_username: string | null;
    os_version: string;
    ip_address: string | null;
    agent_version: string;
    token: string;
}
export declare function getMachineIdentity(): MachineIdentity;
export declare function getMachineId(): string;
export declare function updateMachineQuickBooksVersion(version: string | null): void;
//# sourceMappingURL=machine-id.d.ts.map