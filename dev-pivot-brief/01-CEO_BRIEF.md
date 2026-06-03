# CEO Brief — Pivot to Control Plane

**To:** Dev team
**From:** Hoang (CEO)
**Date:** May 2026
**Subject:** Stop building Master Intelligence Layer. Start proving the control plane works.

---

## 1. Status reality check

Bản report các bạn gửi đã đọc kỹ. Trạng thái thực tế của hệ thống là:

| Layer | Score | What's there |
|---|---:|---|
| Master Intelligence Layer | **35%** | Source indexer ✓, master inventory ✓, 26 projects discovered ✓, 9,002 files mapped ✓, architecture docs ✓ — **but Knowledge Graph empty, DNA not generated, Dependency Engine incomplete** |
| Agent OS Worker Network | **10%** | Schema chỉ, chưa demo task → worker → execute |
| Cline / Antigravity Integration | **0–5%** | **Chưa verified bất cứ thứ gì** |
| CEO Chat | **0%** | Chưa có |
| QA Platform | **10%** | Schema, chưa execute |

The honest read: chúng ta đã build một thư viện hiểu source code, nhưng chúng ta chưa chứng minh được rằng hệ thống **làm được gì** cho CEO.

## 2. The single thing that matters now

```
CEO laptop
   │
   ▼
Agent OS (Control Plane)
   │
   ▼
PC Worker
   │
   ▼
Cline / Antigravity
   │
   ▼
Code gets written, terminal commands run, files modified
```

Chuỗi này phải **chạy được** trước khi build thêm bất cứ thứ gì khác.

Không quan tâm 26 projects hay 9002 files cho đến khi CEO có thể nhập `Audit E:\Project\Master` từ laptop và Worker thực sự thực thi và trả kết quả về.

---

## 3. What I'm cancelling, what I'm prioritizing

### CANCELLED until control plane proven:
- ❌ Project DNA generation for 26 projects
- ❌ Dependency Engine completion
- ❌ Knowledge Graph data population
- ❌ CEO Search feature
- ❌ Any new module/feature/architecture work

### PRIORITY ORDER (do these in sequence, ship each before starting next):

**Priority 1 — Diagnostic reports (deadline: 3 days)**
Three reports proving we understand the integration points. Templates attached:
- `CLINE_ANTIGRAVITY_CAPABILITY_REPORT.md`
- `WORKER_CONNECTIVITY_REPORT.md`
- `CONTROL_PLANE_CONNECTIVITY_REPORT.md`

**Priority 2 — Minimum viable chain (deadline: 7 days)**
End-to-end demo of:
```
CEO sends "ping" from laptop  →  Worker receives  →  Worker responds  →  CEO sees response
```
That's it. Just a ping/pong. No business logic. Prove the wire works.

**Priority 3 — Open Antigravity (deadline: 10 days)**
CEO command: `Open Antigravity` → Worker opens Antigravity application → CEO sees confirmation.

**Priority 4 — Start API Proxy (deadline: 12 days)**
CEO command: `Start API Proxy` → Worker runs `E:\Project\Master\Agent\agent-coding-api-keys\start-proxy-win.bat` → CEO receives "started, listening on port X" or specific error.

**Priority 5 — Audit Master (deadline: 18 days)**
CEO command: `Audit E:\Project\Master` → Worker runs a real audit using the Master Intelligence Layer we already built → produces report → CEO receives report path/summary.

**Priority 6 — Inject prompt to Cline (deadline: 25 days)**
CEO command: `Build Review Auto in E:\Project\Master\Agent` → Worker injects the prompt into Cline → Cline starts working → Worker streams Cline's output back to CEO.

After Priority 6 works, then we resume Master Intelligence Layer work.

---

## 4. The 7 capability checks the Dev must answer in writing

Before any code work, file **`CLINE_ANTIGRAVITY_CAPABILITY_REPORT.md`** (template attached) answering all 7. If the answer to any is "I don't know," that's an acceptable answer — but I need to see it, with a research plan to find out.

**Check 1 — Antigravity: Where does it live?**
- Exact install path on the PC worker
- Is it: standalone app, VS Code extension, Cursor extension, something else?
- Does it have a CLI? An executable that takes flags? A `--help` output?
- Confirm with: `where antigravity` / `Get-Command antigravity` / look for `.exe`

**Check 2 — Cline: API, CLI, headless mode?**
- Is Cline a VS Code extension only, or does it have a CLI?
- Is there an HTTP server it exposes? On what port?
- Can it be invoked programmatically without opening VS Code UI?
- Reference: <https://github.com/cline/cline> — read the actual source/docs

**Check 3 — Prompt injection: Can we send Cline a prompt programmatically?**
- If Cline is VS Code-extension-only: can we invoke its command palette command from outside?
- Is there a websocket/IPC mechanism we can post a prompt to?
- What's the data format?
- Test: write a 10-line script that sends "echo hello" to Cline and prove Cline received it.

**Check 4 — Output capture: Can we read Cline's responses?**
- Does Cline write logs to disk? Where?
- Does it emit events on a socket/pipe?
- Can we tail or subscribe?
- Test: write 10 lines that prove we can read what Cline produced.

**Check 5 — Log streaming: Real-time visibility?**
- Latency: how fast does CEO see Cline's progress?
- Granularity: token-by-token, line-by-line, message-by-message?
- Acceptable target: ≤2 seconds from Cline emitting to CEO seeing.

**Check 6 — Worker remote control: Can the Worker run a local file?**
- Specific test: `E:\Project\Master\Agent\agent-coding-api-keys\start-proxy-win.bat`
- The Worker process must be able to:
  - Receive instruction from Control Plane
  - Spawn the .bat file
  - Capture its stdout/stderr
  - Send result back to Control Plane
- Test with the actual file — not a placeholder.

**Check 7 — Laptop ↔ PC: Cross-machine task dispatch?**
- Laptop creates a task
- PC receives the task
- What's the transport? (named pipe, websocket, HTTP, ZeroMQ, message queue?)
- Auth: how does Laptop prove it's allowed to dispatch?
- Reliability: what happens if PC is offline when Laptop dispatches?
- Test: create task "list files in E:\Project\Master" on laptop → PC executes → laptop receives output.

---

## 5. Hard deliverables (with deadlines and acceptance criteria)

I'm done with reports that say "this is hard, we're working on it." I want one of three states for every item below:
- ✅ Done, here is the verifiable artifact
- ⏳ Blocked, here is what's blocking and what I need from you (CEO)
- ❌ Not done yet, here is the realistic ETA based on what I've learned

### Deliverable D1 — Three capability reports (Day 3)

**Files:**
- `CLINE_ANTIGRAVITY_CAPABILITY_REPORT.md`
- `WORKER_CONNECTIVITY_REPORT.md`
- `CONTROL_PLANE_CONNECTIVITY_REPORT.md`

**Templates:** see `report-templates/` folder.

**Acceptance:** all three filed in repo, all 7 checks answered, every claim either has a code reference or a `KNOWN_UNKNOWN: <how we'll find out>` tag.

### Deliverable D2 — Ping/pong demo (Day 7)

**What it is:** the most boring possible demo that proves the wire works.

**Acceptance:**
```
1. Laptop runs:    agentctl ping
2. Within 5s:      laptop terminal prints "pong from <hostname>, latency Xms"
3. Worker's audit ledger has a row:  kind=control_ping, source=laptop, dest=worker
4. Test repeated 10 times in a row — 10/10 pass
5. Worker can be on the same LAN or different LAN (test both)
```

**Record:** a 60-second asciinema or screen recording, committed to `demos/d2-ping-pong.cast`.

### Deliverable D3 — Open Antigravity (Day 10)

**Acceptance:**
```
1. CEO sends:      agentctl exec open-antigravity
2. Within 10s:     Worker opens Antigravity on its display
3. Worker reports back: { status: "opened", pid: <pid>, window_title: "<title>" }
4. CEO sees the response within 12s total
5. agentctl exec close-antigravity   → Antigravity closes, response received
```

**If Antigravity has no programmatic interface and we have to ShellExecute its .exe:** that's fine, document it. Acceptance is "Worker opened it and reported success," not how.

### Deliverable D4 — Start API Proxy (Day 12)

**Acceptance:**
```
1. CEO sends:      agentctl exec start-api-proxy
2. Worker runs:    E:\Project\Master\Agent\agent-coding-api-keys\start-proxy-win.bat
3. Within 30s:     CEO receives: { status: "started", pid, port, log_tail: <last 20 lines> }
4. Subsequent:     agentctl status api-proxy  →  shows running, uptime, port
5. agentctl exec stop-api-proxy  →  proxy stops cleanly, CEO receives confirmation
6. agentctl logs api-proxy --tail 50  →  CEO sees last 50 log lines
```

### Deliverable D5 — Audit Master (Day 18)

**Acceptance:**
```
1. CEO sends:      agentctl exec audit "E:\Project\Master"
2. Worker uses the existing Master Intelligence Layer to produce an audit report
3. Within 5 min:   CEO receives:
                     - Report path on Worker: E:\Project\Master\.agent\reports\audit-<ts>.md
                     - Report summary: 5-10 lines about the most important findings
                     - Counts: projects scanned, issues found, criticals, warnings
4. CEO can fetch the full report:  agentctl fetch <path>  →  file streams to laptop
```

### Deliverable D6 — Inject Prompt to Cline (Day 25)

**Acceptance:**
```
1. CEO sends:      agentctl exec cline-prompt --project "E:\Project\Master\Agent" \
                                              --prompt "Build review automation"
2. Worker:
   - opens Cline on the right project
   - sends the prompt into Cline's input
   - Cline starts working
3. CEO sees a streaming feed:
   - Cline's plan
   - Each file Cline edits
   - Each terminal command Cline runs
   - Final result
4. agentctl exec cline-abort  →  Cline stops cleanly
```

If Cline doesn't have direct programmatic injection, this becomes the **hardest** deliverable. Acceptable fallbacks (in order of preference):
- (a) Use Cline's MCP server interface if it has one
- (b) Use Cline's VS Code command via `code --command cline.openWithPrompt "<prompt>"` if such a command exists
- (c) Use OS-level UI automation (AutoHotkey on Windows, with caveats — document them)
- (d) Tell me Cline doesn't support this and recommend an alternative (Antigravity, Aider, our own implementation)

A clear "(d)" with reasoning is better than a fragile "(c)" that breaks every time Cline updates.

---

## 6. Tools and conventions

### `agentctl` — the CEO's CLI

Single binary or script. Runs on laptop. Talks to the Control Plane.

```
agentctl ping [worker]
agentctl workers list
agentctl exec <command> [args...]
agentctl status [resource]
agentctl logs <resource> [--tail N] [--follow]
agentctl fetch <worker-path>            # download file from worker to laptop
agentctl push <local-file> <worker-path> # opposite
agentctl tasks list
agentctl task show <id>
agentctl task abort <id>
```

### Worker daemon — runs on PC

Long-running process. Hostname: e.g. `pc-master`. Registers with Control Plane on startup. Receives tasks, executes, reports.

### Control Plane — the broker between Laptop and Worker

Can be:
- On the laptop itself (Laptop runs both `agentctl` and Control Plane)
- On the PC itself (PC is its own broker; laptop is a thin client)
- On a third box (rare; only if multi-laptop multi-PC setup)

Default: Control Plane on the laptop. PC connects out. Avoids inbound firewall complexity on the PC.

### Transport

Default: WebSocket over TLS, using a pre-shared key generated on first pairing.
Alternative: ZeroMQ if we need durability/queuing.
Document choice and tradeoffs in `CONTROL_PLANE_CONNECTIVITY_REPORT.md`.

### Audit ledger

Every task dispatch, every Worker action, every result: row in the audit DB.
Schema in `agent-os/audit/schema.sql` (already exists from prior work — use it).

---

## 7. What "done" looks like for this whole pivot

I'll consider the pivot successful when:

```
I sit at my laptop in Las Vegas.
The PC is in Vietnam (or wherever).
I type:    agentctl exec audit E:\Project\Master
30 seconds later I see a summary.
I type:    agentctl exec cline-prompt --project Bakudan-Analytics --prompt "Generate Q2 report"
2 minutes later Cline is working, I'm watching the stream from my laptop.
30 minutes later the report is on the PC and I have the path.
```

That's the demo. That's the milestone. After that we resume the Master Intelligence Layer ambition.

Until then, **every engineering hour goes into the control plane.**

---

## 8. Reporting cadence

- Daily: 1-line status in #agent-os Slack channel (or whatever we're using). Format: `D<N> — <state> — <next>`. Example: `D3 — capability reports filed — starting ping/pong prototype`.
- Every 3 days: a longer written update. What was learned, what's blocking, what's the next 3 days.
- Per deliverable: when claiming a deliverable done, post the acceptance script output AND the 60-second screen recording.

No surprises. If a deliverable is going to slip, I want to know 48 hours before the deadline, not on the deadline.

---

## 9. The escalation path

You're stuck on something — I'm the first call, not the last call.

You disagree with this pivot — say so now, on the record, in writing. I'll listen. If the case is good, I'll change. After today, "I disagreed with the pivot" is not a valid reason for missed deliverables.

You found out something the brief assumed wrong (e.g., Cline genuinely cannot be programmatically driven) — escalate immediately with what you found. We replan together.

---

## 10. Why I'm doing this

The Master Intelligence Layer is impressive engineering. The fact that we can index 9002 files across 26 projects is a real achievement. **But it doesn't help me run my businesses, and right now that's what I need it to do.** I need to run audits from my phone. I need to start the API proxy without RDP-ing into the PC. I need Cline to do work on the PC while I'm at the restaurant. The intelligence layer is the brain — but right now we have a brain with no hands. We need hands first. Then the brain has something to do.

Build the hands. Then we go back to making the brain smarter.

— Hoang
