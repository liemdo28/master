# D1 — Control Plane Connectivity Report

**Author:** Claude (Agent OS build session)
**Date:** 2026-06-02
**Purpose:** Document the Control Plane location, transport, auth model, and laptop→PC connectivity path. This is the ground truth for how the CEO's laptop talks to the PC Worker.

---

## 1. Architecture — corrected model

**The Control Plane runs on the PC, not on the laptop.**

```
[ Laptop — dos-macbook-air ]           [ PC — LIEMDO-PC ]
  Tailscale: 100.117.1.73               Tailscale: 100.118.102.113
  (thin client — agentctl CLI)          (Control Plane :3700 + Worker)
            |                                      |
            |         WebSocket over Tailscale     |
            +--------------------------------------+
                  laptop connects TO pc-master
                  PC never opens inbound to laptop
```

The laptop is a thin client. The CEO runs `agentctl` on the laptop; it connects to the PC at `100.118.102.113:3700` over Tailscale.

---

## 2. Control Plane

- **Host:** LIEMDO-PC
- **Port:** 3700
- **Protocol:** WebSocket (currently plaintext on localhost; TLS required when exposing over Tailscale)
- **Process manager:** pm2 (`agent-worker` connects to it via WebSocket to localhost:3700)
- **Worker registered name (current):** `windows-liemdo-PC`
- **Worker registered name (target):** `pc-master`

---

## 3. Transport choice

**Chosen:** WebSocket over Tailscale

| Option | Status | Reason |
|---|---|---|
| WebSocket over Tailscale | **Selected** | Tailscale is installed and active on PC; zero-config NAT traversal; Worker already uses WebSocket |
| Plain HTTP polling | Fallback only | Already implemented as 3s poll fallback in agent-worker |
| WireGuard self-hosted | Not selected | Not installed |
| Public IP / port forward | Not selected | No inbound ports open on PC |
| Cloudflare Tunnel | Not selected | Not set up |

**Reasoning:** Tailscale is already running on LIEMDO-PC (IP `100.118.102.113`). The Worker daemon already uses WebSocket for its connection to the local Control Plane. Extending this over Tailscale requires only changing the Control Plane bind address from `localhost` to `0.0.0.0` (or the Tailscale interface) and ensuring `agentctl` targets `100.118.102.113:3700`.

---

## 4. Network reachability — current state

| From | To | Address | Reachable now? |
|---|---|---|---|
| Laptop | PC (Tailscale) | 100.118.102.113:3700 | **No — laptop is offline** (last seen 2 days ago) |
| PC | PC (localhost) | localhost:3700 | Yes — Control Plane running |
| PC | PC (Tailscale self) | 100.118.102.113:3700 | Yes — Tailscale active |
| Laptop | PC (Tailscale) | 100.117.1.73 → 100.118.102.113 | Pending laptop reconnect |

**Blocking issue:** The laptop (dos-macbook-air, Tailscale IP `100.117.1.73`) has been offline for 2 days. Cross-machine task dispatch cannot be tested until the laptop reconnects to Tailscale.

---

## 5. Auth model

- **Method:** Worker token system — 32-byte hex tokens
- **Token issuance:** Existing system in agent-worker
- **Token storage on laptop:** `~/.agentctl/keys/pc-master.token` (target path)
- **Token storage on PC:** Held in Control Plane config; validated on WebSocket handshake

No new auth system needs to be built. The existing 32-byte hex token model is carried forward.

---

## 6. Pairing flow (target UX for D2)

```bash
# On PC — run once
> agentctl workers list
# shows pc-master (localhost, already paired)

# On Laptop — after Tailscale reconnects
> agentctl connect 100.118.102.113:3700 --token <32-byte-hex>
Connected to pc-master. Latency: __ms

> agentctl ping pc-master
pong from pc-master, latency __ms
```

---

## 7. Latency expectations

| Path | Expected p50 | Expected p99 | Measured |
|---|---|---|---|
| localhost:3700 (same machine) | < 1ms | < 5ms | Not yet measured |
| Tailscale (LAN, same home network) | < 10ms | < 30ms | Not yet measured |
| Tailscale (laptop remote / overseas) | 100–250ms | < 500ms | KNOWN_UNKNOWN — depends on DERP relay |

Latency measurements will be completed during D2 when the laptop is online.

---

## 8. Failure scenarios — planned tests (D2)

| Scenario | Expected behavior | Tested? |
|---|---|---|
| Worker process crashes mid-task | Task marked `aborted`, Control Plane notifies agentctl | No — D2 |
| Laptop goes offline mid-task | Worker continues task; result queued; laptop retrieves on reconnect | No — D2 |
| Tailscale drops for 30s | WebSocket reconnects via backoff (1s, 2s, 4s… max 60s) | No — D2 |
| Stale token / wrong token | Handshake rejected, connection closed | No — D2 |

---

## 9. Open issues

1. **Laptop offline.** The laptop (dos-macbook-air) has been offline for 2 days. Cross-machine connectivity cannot be verified until it reconnects. No action needed on PC side — it will appear in the tailnet automatically.

2. **Control Plane bind address.** Currently bound to `localhost` only. Must be changed to bind on the Tailscale interface (`100.118.102.113`) or `0.0.0.0` before cross-machine use.

3. **Worker daemon rename.** `windows-liemdo-PC` must be renamed to `pc-master` in the Control Plane registry and pm2 config.

4. **TLS on Tailscale traffic.** Tailscale encrypts all traffic at the network layer (WireGuard). Application-layer TLS on top is optional for the Tailscale path but is required if the Control Plane is ever exposed on a non-Tailscale interface.

---

## 10. Deliverable readiness

| Deliverable | Blocker | Ready? |
|---|---|---|
| D2 — ping/pong end-to-end | Laptop must come online + bind address change + agentctl CLI | Not yet — 2 days |
| D3 — open Antigravity | No connectivity blocker; ShellExecute on PC | Ready |
| D4 — start API proxy | Proxy already running via pm2 | Partially done |

---

**Signed:** Claude (Agent OS build session), 2026-06-02
