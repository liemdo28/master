$html = Get-Content 'd:\Project\Master\mi-core\ui\qb-dashboard.html' -Raw

# Fix tab divs to have class="view" instead of class="tab-content"
$html = $html -replace 'class="tab-content"', 'class="view"'

# Add if statements to nav function for the 4 new views
$nav_checks = @'
  if (view === 'stores') renderStores();
  if (view === 'store-detail') renderStoreDetail();
  if (view === 'store-revenue') renderStoreRevenue();
  if (view === 'store-compare') renderStoreCompare();
'@

if ($html -notmatch "view === 'stores'") {
    $html = $html -replace "(if \(view === 'bills'\) renderBills\(\);)", "$nav_checks`n  `$1"
    Write-Host "Added nav if-statements"
}

# Add titles
$title_additions = ",stores:'Stores Overview',store-detail:'Store Report',store-revenue:'Store Revenue',store-compare:'Store Compare'"
if ($html -notmatch "stores:'Stores Overview'") {
    $html = $html -replace "(stores:'Store Sync',sync:'Sync Status'\})", "`$1$title_additions`$2"
    Write-Host "Added titles"
}

Set-Content 'd:\Project\Master\mi-core\ui\qb-dashboard.html' -Value $html -NoNewline
Write-Host "Done"
