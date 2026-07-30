<?php $pageTitle = 'Simulations';  ?>
<div style="max-width: 1200px; margin: 0 auto; padding: 20px;">
    <h1 style="font-size: 28px; margin-bottom: 24px;">🔬 Digital Operations Twin</h1>
    <a href="/admin/command-center" class="btn">← Back</a>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 24px;">
        <div class="card">
            <h2>Run Simulation</h2>
            <form action="/admin/command-center/simulate" method="POST">
                <div style="margin-bottom: 16px;">
                    <label>Store</label>
                    <select name="store_id" required style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;">
                        <?php foreach ($stores as $s): ?>
                        <option value="<?= $s['id'] ?>"><?= htmlspecialchars($s['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div style="margin-bottom: 16px;">
                    <label>Scenario</label>
                    <select name="scenario_type" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;">
                        <option value="manager_loss">Manager Loss</option>
                        <option value="demand_increase">Demand Increase</option>
                        <option value="store_closure">Store Closure</option>
                    </select>
                </div>
                <button type="submit" class="btn-primary">Run Simulation</button>
            </form>
        </div>
        
        <div class="card">
            <h2>Simulation History</h2>
            <?php if (empty($history)): ?>
            <p style="color: #6b7280;">No simulations run yet.</p>
            <?php else: ?>
            <?php foreach ($history as $h): ?>
            <div style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                <strong><?= htmlspecialchars($h['scenario_type']) ?></strong>
                <div style="font-size: 12px; color: #6b7280;"><?= timeAgo($h['created_at']) ?></div>
            </div>
            <?php endforeach; ?>
            <?php endif; ?>
        </div>
    </div>
</div>
<style>
.card { background: white; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb; }
.btn { background: #f3f4f6; color: #374151; padding: 8px 16px; border-radius: 6px; text-decoration: none; }
.btn-primary { background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; }
label { display: block; font-weight: 500; margin-bottom: 4px; }
</style>
