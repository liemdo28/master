<?php
// Phase 11 — Module 5: Store Opening Checklist View
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
.check-item .check-icon { width: 20px; height: 20px; border: 2px solid #3b82f6; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 13px; font-weight: 500; color: var(--text-muted); margin-bottom: 6px; }
.form-control { width: 100%; padding: 10px 12px; background: var(--input-bg, #1f1f23); border: 1px solid var(--border, #27272a); border-radius: 8px; color: var(--text-primary); font-size: 14px; box-sizing: border-box; }
.form-control:focus { outline: none; border-color: #3b82f6; }
.submit-btn { width: 100%; padding: 14px; background: #00cc66; color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; }
.submit-btn:hover { background: #00b85c; }
.opened-today { margin-top: 20px; }
.opened-today h4 { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 10px; }
.opened-store { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border, #27272a); }
.opened-store:last-child { border-bottom: none; }
.opened-check { width: 20px; height: 20px; background: rgba(0,204,102,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #00cc66; }
.opened-store-name { font-size: 13px; color: var(--text-primary); }
.opened-store-time { font-size: 11px; color: var(--text-muted); }
</style>

<div class="checklist-hero">
    <h2>Store Opening Checklist</h2>
    <p><?= e($today) ?> &bull; Standardized opening procedure</p>
</div>

<div class="checklist-form">
    <?php if (!empty($openedToday)): ?>
        <div class="checklist-card opened-today">
            <h4>Already Opened Today</h4>
            <?php foreach ($openedToday as $ot): ?>
                <div class="opened-store">
                    <div class="opened-check">✓</div>
                    <div>
                        <div class="opened-store-name"><?= e($ot['store_id']) ?></div>
                        <div class="opened-store-time"><?= e(date('H:i', strtotime($ot['opened_at']))) ?></div>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>

    <form method="POST" action="/store/checklist/open/submit">
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
                Opening Checklist
            </h3>
            <div class="check-item">
                <input type="checkbox" name="checklist[lights]" id="c_lights">
                <label for="c_lights">Lights on & working</label>
            </div>
            <div class="check-item">
                <input type="checkbox" name="checklist[pos]" id="c_pos">
                <label for="c_pos">POS system operational</label>
            </div>
            <div class="check-item">
                <input type="checkbox" name="checklist[inventory]" id="c_inv">
                <label for="c_inv">Inventory checked</label>
            </div>
            <div class="check-item">
                <input type="checkbox" name="checklist[cash_drawer]" id="c_cash">
                <label for="c_cash">Cash drawer counted</label>
            </div>
            <div class="check-item">
                <input type="checkbox" name="checklist[cleaning]" id="c_clean">
                <label for="c_clean">Store cleanliness verified</label>
            </div>
            <div class="check-item">
                <input type="checkbox" name="checklist[temperature]" id="c_temp">
                <label for="c_temp">Temperature check completed</label>
            </div>
            <div class="check-item">
                <input type="checkbox" name="checklist[staffing]" id="c_staff">
                <label for="c_staff">Staff present & scheduled</label>
            </div>
            <div class="check-item">
                <input type="checkbox" name="checklist[supplies]" id="c_supplies">
                <label for="c_supplies">Supplies restocked</label>
            </div>
        </div>

        <div class="checklist-card">
            <div class="form-group">
                <label>Notes (optional)</label>
                <textarea name="notes" class="form-control" rows="3" placeholder="Any issues or observations..."></textarea>
            </div>
            <div class="check-item">
                <input type="checkbox" name="create_task" id="c_task" value="1">
                <label for="c_task">Log as task in system</label>
            </div>
        </div>

        <button type="submit" class="submit-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;margin-right:6px"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            Submit Opening Checklist
        </button>
    </form>
</div>
