# Mi Open Source Adapter Architecture

Date: 2026-06-26

## Rule

Do not directly import open-source lab runtimes into Mi-Core production. Mi-Core talks to a stable adapter contract. Provider implementations live behind an external runtime boundary until CEO approval.

```text
Mi-Core
  -> Mi Open Source Adapter Layer
  -> Specific Provider Adapter
  -> Open-source Runtime
```

Example:

```text
Mi-Core
  -> VideoGenerationAdapter
  -> OpenMontageAdapter
  -> OpenMontage Runtime
```

## Common Adapter Contract

Every adapter must support:

```ts
export interface MiOpenSourceAdapter<TRequest, TResult> {
  healthCheck(): Promise<AdapterHealth>;
  capabilities(): Promise<AdapterCapabilities>;
  dryRun(request: TRequest): Promise<DryRunResult>;
  execute(request: TRequest): Promise<TResult>;
  getLogs(runId: string): Promise<AdapterLog[]>;
  getArtifacts(runId: string): Promise<AdapterArtifact[]>;
}
```

## Required Adapters

| Adapter | Provider Candidate | Production Boundary |
|---|---|---|
| WorkflowBuilderAdapter | Open Agent Builder | Lab UI -> validated workflow JSON -> Mi-Core dry-run |
| VideoGenerationAdapter | OpenMontage | External service, artifact-only return |
| VoiceGenerationAdapter | TTS Audio Suite | External service, approved voices only |
| BrowserLocalLLMAdapter | WebLLM | Browser-only, no server actions |
| BrowserAutomationAdapter | Obscura | Lab-only, no credentials |
| DigitalTwinAdapter | Map3D | Future concept module |

## Guardrail Fields

All adapter requests must include:

- `request_id`
- `requested_by`
- `risk_level`
- `dry_run`
- `approval_id` when required
- `artifact_root`
- `audit_context`

All adapter responses must include:

- `run_id`
- `status`
- `logs`
- `artifacts`
- `approval_required`
- `production_write_performed`

`production_write_performed` must be `false` for this lab phase.
