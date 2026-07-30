$f = 'd:\Project\Master\mi-core\server\src\routes\qb-mirror-router.ts'
$c = Get-Content $f -Raw
$c = $c -replace 'res\.json\(\{ ok: true, entity_type, records_', 'res.json({ ok: true, entity_type, records_upserted: count });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
'
$c | Set-Content $f -NoNewline
Write-Host Done
