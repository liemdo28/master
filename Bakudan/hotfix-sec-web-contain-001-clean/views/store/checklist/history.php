<?php
// Phase 11 — Module 5 & 6: Store Checklist History View
?>
<style>
.history-hero {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-radius: 16px; padding: 28px; margin-bottom: 24px; border: 1px solid #2a2a3e;
}
.history-hero h2 { font-size: 24px; font-weight: 700; color: #fff; margin: 0 0 6px; }
.history-hero p { font-size: 13px; color: #9ca3af; margin: 0; }

.filter-bar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
.filter-bar select { padding: 8px 12px; background: var(--input-bg, #1f1f23); border: 1px solid var(--border, #27272a); border-radius: 8px; color: var(--text-primary); font-size: 13px; }
.filter-bar a { padding: 8px 16px; background: #3b82f6; color: white; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 500; }

.history-table { width: 100%; border-collapse: collapse; }
.history-table th { text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border, #27272a); }
.history-table td { padding: 12px 14px; font-size: 13px; color: var(--text-primary); border-bottom: 1px solid var(--border, #27272a); }
.history-table tr:last-child td { border-bottom: none; }
.history-table tr:hover td { background: rgba(255,255,255,0.02); }

.type-chip { font-size: 10px; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
.type-chip.open { background: rgba(0,204,102,0.15); color: #00cc66; }
.type-chip.close { background: rgba(59,130,246,0.15); color: #3b82f6; }

.empty-state { text-align: center; padding: 48px; color: var(--text-muted); font-size: 14px; }
.empty-state .emoji { font-size: 48px; margin-bottom: 12px; }
</style>

<div class="history-hero">
    <h2>Checklist History</h2>
    <p>Opening and closing records across all stores</p>
</div>

<div class="filter-bar">
    <form method="GET" action="/store/checklist/history">
        <select name="store_id" onchange="this.form.submit()">
            <option value="">All Stores</option>
            <?php foreach ($stores as $s): ?>
                <option value="<?= $s['id'] ?>" <?= $selectedStore == $s['id'] ? 'selected' : '' ?>>
                    <?= e($s['name']) ?>
                </option>
            <?php endforeach; ?>
        </select>
        <select name="type" onchange="this.form.submit()">
            <option value="">All Types</option>
            <option value="open" <?= $selectedType === 'open' ? 'selected' : '' ?>>Opening</option>
            <option value="close" <?= $selectedType === 'close' ? 'selected' : '' ?>>Closing</option>
        </select>
    </form>
</div>

<?php if (empty($history)): ?>
    <div class="empty-state">
        <div class="emoji">📋</div>
        <p>No checklist records found</p>
    </div>
<?php else: ?>
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;overflow:hidden">
        <table class="history-table">
            <thead>
                <tr>
                    <th>Store</th>
                    <th>Type</th>
                    <th>Completed By</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Notes</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($history as $h): ?>
                    <?php
                    $items = is_string($h['items']) ? json_decode($h['items'], true) : ($h['items'] ?? []);
                    $checked = is_array($items) ? count(array_filter($items)) : 0;
                    $total = is_array($items) ? count($items) : 0;
                    $time = !empty($h['opened_at']) ? $h['opened_at'] : ($h['closed_at'] ?? '');
                    $byName = !empty($h['opened_by_name']) ? $h['opened_by_name'] : ($h['closed_by_name'] ?? 'Unknown');
                    ?>
                    <tr>
                        <td><?= e($h['store_name'] ?? '') ?></td>
                        <td>
                            <span class="type-chip <?= e($h['type']) ?>">
                                <?= $h['type'] === 'open' ? 'Opening' : 'Closing' ?>
                            </span>
                        </td>
                        <td><?= e($byName) ?></td>
                        <td><?= e(date('M d, Y H:i', strtotime($time))) ?></td>
                        <td>
                            <?= $checked ?>/<?= $total ?> checked
                            <?php if ($h['type'] === 'close' && !empty($h['cash_count'])): ?>
                                <br><span style="font-size:11px;color:#ffaa00">Cash: $<?= number_format($h['cash_count'],2) ?></span>
                            <?php endif; ?>
                        </td>
                        <td style="max-width:200px">
                            <?php if (!empty($h['notes'])): ?>
                                <span style="font-size:12px;color:var(--text-muted)"><?= e(mb_substr($h['notes'], 0, 60)) ?><?= mb_strlen($h['notes']) > 60 ? '...' : '' ?></span>
                            <?php else: ?>
                                <span style="font-size:12px;color:var(--text-muted);opacity:0.5">—</span>
                            <?php endif; ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
<?php endif; ?>
