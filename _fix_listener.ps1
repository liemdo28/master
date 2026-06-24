# WhatsApp Routing Collision Fix - P0
# Run: powershell -ExecutionPolicy Bypass -File _fix_listener.ps1

$path = 'E:\Project\Master\mi-core\services\whatsapp-ai-gateway\src\whatsapp\message-listener.js'
$bak = $path + '.bak'
$lines = [System.IO.File]::ReadAllLines($path)

Write-Host "=== FIX 1: Add 'return;' inside 'if (!isAdmin)' block (line 838) ==="
Write-Host "Before: L838 = $($lines[837])"
# Add return; after the log.info line inside if(!isAdmin)
$lines[837] = "    if (!isAdmin) {"
$lines[838] = "      log.info('[MESSAGE_FLOW] no_prefix_non_ceo_silent_drop', { ...runtimeTraceBase, route: 'no_prefix_silent_drop', phone });"
$lines[839] = "      return; // P0 FIX: non-CEO no-prefix must NOT fall through to GREETING block"
$lines[840] = "    } else {"
Write-Host "After:  L838 = $($lines[837])"
Write-Host "        L839 = $($lines[838])"
Write-Host "        L840 = $($lines[839])"

Write-Host ""
Write-Host "=== FIX 2: Fix forwardResult error-reply condition (line 866) ==="
Write-Host "Before: L866 = $($lines[865])"
# Change: if (!sent && !forwardResult.ok) -> if (forwardResult.ok && forwardResult.reply && !sent)
$lines[865] = "        if (forwardResult.ok && forwardResult.reply && !sent) {"
$lines[866] = "          // Forward succeeded but sendMiForwardResult suppressed (dedup/stale) — mi-core reply expected"
Write-Host "After:  L866 = $($lines[865])"
Write-Host "        L867 = $($lines[866])"

Write-Host ""
Write-Host "=== FIX 3: Block CEO from GREETING and generic AI (before line 877) ==="
# Insert CEO block before the GREETING block
# Current L876 = empty, L877 = if (nlp.autoHandle && nlp.intent === 'GREETING') {
# We need to insert CEO block before L877
$insertLines = @(
  "  // P0 FIX: CEO senders must NEVER receive generic greeting or generic AI reply",
  "  // Only Mi-Core may respond to CEO. This prevents collision when mi-core is slow.",
  "  if (miAccess.isCeoSender(phone)) {",
  "    log.info('[MESSAGE_FLOW] ceo_sender_blocked_from_generic_ai', { ...runtimeTraceBase, route: 'ceo_generic_ai_blocked' });",
  "    return; // CEO always routes to Mi. Never use generic AI or greeting.",
  "  }",
  ""
)

# Find the index of the GREETING block (line 877, index 876)
$insertIndex = 876
Write-Host "Inserting CEO block before line $($insertIndex+1) (GREETING block)"

# Build new array: insert before index 876
$newLines = @()
for ($i = 0; $i -lt $insertIndex; $i++) { $newLines += $lines[$i] }
foreach ($l in $insertLines) { $newLines += $l }
for ($i = $insertIndex; $i -lt $lines.Count; $i++) { $newLines += $lines[$i] }

Write-Host ""
Write-Host "=== Writing fixed file ==="
Write-Host "Original lines: $($lines.Count)"
Write-Host "New lines: $($newLines.Count)"

[System.IO.File]::WriteAllLines($path, $newLines)
Write-Host "Written to: $path"

Write-Host ""
Write-Host "=== Verification ==="
$check1 = Select-String -Path $path -Pattern "no_prefix_non_ceo_silent_drop"
$check2 = Select-String -Path $path -Pattern "ceo_generic_ai_blocked"
$check3 = Select-String -Path $path -Pattern "forwardResult.ok && forwardResult.reply && !sent"
Write-Host "Fix 1 (no_prefix_non_ceo_silent_drop): $($check1.LineNumber)"
Write-Host "Fix 2 (forwardResult.ok && forwardResult.reply): $($check2.LineNumber)"
Write-Host "Fix 3 (ceo_generic_ai_blocked): $($check3.LineNumber)"
