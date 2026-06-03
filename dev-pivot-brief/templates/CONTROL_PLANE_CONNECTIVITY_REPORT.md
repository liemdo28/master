# CONTROL_PLANE_CONNECTIVITY_REPORT.md

**Author:** <your name>
**Date:** <YYYY-MM-DD>
**Purpose:** Document the Laptop↔Worker connection — chosen transport, auth, latency, reliability.

---

## 1. Chosen transport

- [ ] WebSocket over TLS (recommended in spec)
- [ ] Plain HTTP/2 long-poll
- [ ] ZeroMQ
- [ ] gRPC
- [ ] Other:

Reasoning (3 sentences max):

## 2. Network topology

Draw the actual physical/logical topology for this CEO's setup:

```
[ Laptop in Las Vegas ]
      |
   ... (over what?) ...
      |
[ PC in <location> ]
```

How is the connection routable today? Pick one:

- [ ] Same LAN (CEO and PC are both at home)
- [ ] Tailscale (both nodes already in same tailnet)
- [ ] WireGuard self-hosted
- [ ] PC has public IP / port forward
- [ ] Cloudflare Tunnel / similar
- [ ] None — need to set up

If "None — need to set up": document the plan, the cost, the effort.

## 3. Pairing flow (concrete UX)

Write the actual command-by-command flow a CEO runs the first time:

```
[on PC]
> agent-os-worker.exe pair
Generated pairing code: 4 8 2 9 1 7   (valid 5 min)
Listening on 0.0.0.0:7421 for pairing...

[on Laptop]
> agentctl pair pc-master.local 4 8 2 9 1 7
Connecting to pc-master.local:7421 ...
✓ paired. PSK stored in ~/.agentctl/keys/pc-master.psk

[on Laptop, repeat]
> agentctl ping pc-master
pong, latency 23ms
```

## 4. Latency measurements

After pairing, measure 10 round-trip pings and paste output. Sustained p50 and p99 here matter more than peak.

```
ping #1: 23ms
ping #2: 19ms
...
p50: __ms
p99: __ms
```

Target: p50 < 100ms on LAN, p99 < 500ms.

## 5. Failure tests

Run each scenario and paste outcome:

### 5.1 Worker offline mid-task
- Laptop: `agentctl exec --worker pc-master shell "sleep 30"`
- During sleep, kill the worker daemon
- Expected: laptop sees `task aborted, worker disconnected` within 15s
- Actual:

### 5.2 Laptop offline mid-task
- Laptop: `agentctl exec --worker pc-master shell "sleep 30"`
- During sleep, sleep the laptop
- Expected: worker continues task; on laptop wake, agentctl shows final result
- Actual:

### 5.3 Network drop mid-task
- Block the network for 30s while a task is running
- Expected: reconnect with backoff; task survives or aborts cleanly
- Actual:

### 5.4 Stale message (replay attack)
- Capture a message; replay 10 minutes later
- Expected: rejected with "ts too old"
- Actual:

### 5.5 Bad signature
- Tamper with a message body
- Expected: rejected with "signature mismatch"
- Actual:

## 6. Concurrent task throughput

Run N tasks in parallel:

```
for i in $(seq 1 N); do agentctl exec --worker pc-master shell "echo $i" & done
```

How does Worker handle 5 / 10 / 20 in flight? Document.

## 7. Logs and audit

After running the above tests, paste the audit ledger from Worker:

```
> agentctl audit pc-master --tail 30
seq  ts                    kind          task_id      status  duration_ms
...
```

Confirm:
- [ ] Every dispatch has a matching result row
- [ ] Hash chain verifies (`agentctl audit verify pc-master` → OK)

## 8. Open issues we haven't solved

1.
2.
3.

## 9. Sign-off

Cross-machine task dispatch is verified end-to-end and reproducible.

**Signed:** <dev name>, <date>
