# Raw Shell Block Policy

## Policy

CEO chat must not execute arbitrary shell text.

Blocked examples:

```text
hi
dir
rm -rf node_modules
curl example.com
run command whoami
```

Unless a command is explicitly registered in `COMMAND_REGISTRY.json`, Agent OS must return unsupported and create no task.

## Worker enforcement

The worker also enforces the block. A `script` task fails unless:

1. `payload.registryIntent` exists.
2. The script path is in `raw_shell.approved_script_paths`, or the payload was explicitly marked `rawShellApproved: true` by trusted internal code.

Current approved script path:

```text
E:\Project\Master\Agent\agent-coding-api-keys\start-proxy-win.bat
```

## Acceptance

Acceptance is not a developer claim. Acceptance means the script/build/test path runs on the CEO machine and the chat API proves unknown text does not create a task.

