export interface AgentctlConfig {
    controlUrl: string;
    workerName: string;
    apiKey?: string;
    json: boolean;
}
export declare function loadConfig(): AgentctlConfig;
export declare function saveConfig(config: Partial<AgentctlConfig>): void;
export declare function getConfigPath(): string;
