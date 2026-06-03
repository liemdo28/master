# agentctl

CEO CLI for Agent OS — control your workers from your laptop.

## Install

```
cd E:\Project\Master\agent-os\agentctl
npm install
npm link   # makes 'agentctl' available in PATH
```

## Config

Copy `config-example.json` to `~/.agentctl/config.json` and edit:

```json
{
  "control_plane": "http://100.118.102.113:3700",
  "default_worker": "pc-master",
  "token": "optional-auth-token"
}
```

## Commands

```
agentctl workers list
agentctl workers show <name>
agentctl ping <worker> [--timeout N]
agentctl exec [--worker NAME] [--json] [--timeout N] <command> [args...]
agentctl tasks list [--limit N]
agentctl task show <id>
agentctl logs <task-id> [--tail N] [--follow]
agentctl audit <worker> [--tail N]
agentctl audit verify <worker>
agentctl fetch <worker>:<path> [--to <local>]
agentctl status [resource] [--worker NAME] [--json]
```

## D2 Acceptance Tests

```bash
agentctl workers list | grep -q 'pc-master'
agentctl workers show pc-master | grep -q 'online'
agentctl ping pc-master --timeout 5
agentctl audit pc-master --tail 20 | grep -q 'control_ping'
agentctl audit verify pc-master
```
