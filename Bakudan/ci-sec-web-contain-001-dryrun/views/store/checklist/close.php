<?php
// Phase 11 — Module 6: Store Closing Checklist View
?>
<style>
.checklist-hero {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-radius: 16px; padding: 28px; margin-bottom: 24px;
    border: 1px solid #2a2a3e;
}
.checklist-hero h2 { font-size: 24px; font-weight: 700; color: #fff; margin: 0 0 6px; }
.checklist-hero p { font-size: 13px; color: #9ca3af; margin: 0; }
.checklist-form { max-width: 640px; }
.checklist-card {
    background: var(--card-bg, #18181b); border: 1px solid var(--border, #27272a);
    border-radius: 12px; padding: 24px; margin-bottom: 20px;
}
.checklist-card h3 {
    font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0 0 16px;
    display: flex; align-items: center; gap: 8px;
}
.check-item {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 0; border-bottom: 1px solid var(--border, #27272a);
}
.check-item:last-child { border-bottom: none; }
.check-item input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; accent-color: #00cc66; }
.check-item label { flex: 1; font-size: 14px; color: var(--text-primary); cursor: pointer; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 13px; font-weight: 500; color: var(--text-muted); margin-bottom: 6px; }
.form-control { width: 100%; padding: 10px 12px; background: var(--input-bg, #1f1f23); border: 1px solid var(--border, #27272a); border-radius: 8px; color: var(--text-primary); font-size: 14px; box-sizing: border-box; }
.form-control:focus { outline: none; border-color: #3b82f6; }
.submit-btn { width: 100%; padding: 14px; background: #3b82f6; color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; }
.submit-btn:hover { background: #2563eb; }
.cash-input { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border, #27272a); }
.cash-input label { flex: 1; font-size: 14px; color: var(--text-primary); }
.cash-input input { width: 140px; padding: 8px 12px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: 14px; }
</style>

<div class="checklist-hero">
    <h2>Store Closing Checklist</h2>
    <p><?= e($today) ?> &bull; End of day procedure</p>
</div>

<div class="checklist-form">
    <form method="POST" action="/store/checklist/close/submit">
        <input type="hidden" name="csrf" value="<?= csrf_token() ?>">

        <div class="checklist-card">
            <h3>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M3 9l1-4h16l1 4"/><path d="M3 9v1a3 3 0 0 0 6 0V9m0 1a3 3 0 0 0 6 0V9m0 1a3 3 0 0 0 6 0V9"/></svg>
                Select Store
            </h3>
            <div class="form-group">
                <select name="store_id" class="form-control" required>
                    <option value="">— Select store —</option>
                    <?php foreach ($stores as $s): ?>
                        <option value="<?= $s['id'] ?>"><?= e($s['name']) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
        </div>

        <div class="checklist-card">
            <h3>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00cc66" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                Closing Checklist
            </h3>
            <div class="check-item">
                <input type="checkbox" name="checklist[cleaning]" id="cl_clean">
                <label for="cl_clean">Store cleaned & sanitized</label>
            </div>
            <div class="check-item">
                <input type="checkbox" name="checklist[cash_count]" id="cl_cash">
                <label for="cl_cash">Cash counted & reconciled</label>
            </div>
            <div class="check-item">
                <input type="checkbox" name="checklist[inventory]" id="cl_inv">
                <label for="cl_inv">End-of-day inventory done</label>
            </div>
            <div class="check-item">
                <input type="checkbox" name="checklist[security]" id="cl_sec">
                <label for="cl_sec">Cash & valuables secured</label>
            </div>
            <div class="check-item">
                <input type="checkbox" name="checklist[equipment_off]" id="cl_eq">
                <label for="cl_eq">Equipment turned off</label>
            </div>
            <div class="check-item">
                <input type="checkbox" name="checklist[trash]" id="cl_trash">
                <label for="cl_trash">Trash emptied</label>
            </div>
            <div class="check-item">
                <input type="checkbox" name="checklist[alarms]" id="cl_alarm">
                <label for="cl_alarm">Alarm set & verified</label>
            </div>
            <div class="check-item">
                <input type="checkbox" name="checklist[last_check]" id="cl_last">
                <label for="cl_last">Final walk-through completed</label>
            </div>
        </div>

        <div class="checklist-card">
            <div class="cash-input">
                <label>Cash Count ($)</label>
                <input type="number" name="cash_count" step="0.01" min="0" placeholder="0.00">
            </div>
            <div class="form-group" style="margin-top:16px">
                <label>Notes (optional)</label>
                <textarea name="notes" class="form-control" rows="3" placeholder="Any incidents, issues, or observations..."></textarea>
            </div>
        </div>

        <button type="submit" class="submit-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;margin-right:6px"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            Submit Closing Checklist
        </button>
    </form>
</div>
