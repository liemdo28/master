# Clean Laptop Install Validation

Date: 2026-06-05

## Rule

Do not mark the Windows installer ready until clean laptop install and reboot auto-start validation both pass.

## Matrix

| # | Test case | Status | Evidence screenshot/log |
|---|---|---|---|
| 1 | Clean laptop with no Node | BLOCKED | Pending target laptop run |
| 2 | Clean laptop with no Chrome | BLOCKED | Pending target laptop run |
| 3 | Existing install update | BLOCKED | Pending target laptop run |
| 4 | Existing install while gateway running | BLOCKED | Pending target laptop run |
| 5 | Existing install with dashboard open | BLOCKED | Pending target laptop run |
| 6 | Existing install with Chrome open | BLOCKED | Pending target laptop run |
| 7 | Non-admin install | BLOCKED | Pending target laptop run |
| 8 | Admin install | BLOCKED | Pending target laptop run |
| 9 | Reboot autostart | BLOCKED | Pending target laptop run |
| 10 | Stop/Start shortcuts | BLOCKED | Pending target laptop run |

## Clean Laptop Steps

1. Run installer as Admin.
2. Confirm installer completes.
3. Confirm dashboard opens.
4. Confirm `http://localhost:3210/api/health` returns `ok=true`.
5. Restart Windows.
6. Wait one minute.
7. Confirm gateway auto-started.
8. Run `Gateway Status.bat`.
9. In WhatsApp, test `/version`.
10. In WhatsApp, test `/ldagent`.

## Dev Machine Commands

```powershell
npm test
node tests\windows\runtime-service-tests.js
node tests\live\runtime-acceptance-test.js
powershell -File .\scripts\windows\start-gateway-hidden.ps1
powershell -File .\scripts\windows\status-gateway.ps1
powershell -File .\scripts\windows\stop-gateway.ps1
powershell -File .\pack.ps1
```

## Release Gate

PASS requires:

- Installer completes on the clean laptop.
- Logging race does not fail installation.
- Hidden gateway starts.
- Dashboard opens.
- Auto-start installs or Startup shortcut fallback is created.
- Reboot restores gateway automatically.
- Update install works after the old gateway was running.
- No manual `npm install`.
- No manual Node install.
- `Gateway Status.bat` shows healthy.
