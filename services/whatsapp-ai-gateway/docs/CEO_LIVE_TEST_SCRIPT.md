# CEO Live Test Script

Date: 2026-06-05

1. Open dashboard: `http://localhost:3210`.
2. Click Open Template Sheet.
3. Click Open Daily Log Sheet.
4. Force Sync Template.
5. Verify item count is 19.
6. WhatsApp: send `/version`.
7. Confirm WhatsApp build equals dashboard `/api/runtime-truth`.
8. WhatsApp: send `Biết tiếng Việt ko`.
9. WhatsApp: send `/ldagent`.
10. Confirm menu says `Chọn cửa hàng:`.
11. Choose `1` for Rim.
12. Choose `1` for Daily Entry.
13. Confirm `Item 1/19`.
14. Enter `44`.
15. Confirm accepted for target `30°F - 45°F`.
16. Enter `10` for Walk-in Freezer.
17. Confirm outside-range warning.
18. Send `STATUS`.
19. Confirm progress is out of 19.
20. Send `CANCEL`.

Required screenshots:

- dashboard valid sheet buttons
- template count 19
- `/version` response
- Vietnamese `/ldagent`
- Item 1/19
- range display
- STATUS progress
