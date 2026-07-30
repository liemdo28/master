<?php
/**
 * Phase 8 — Module 10: Executive War Room
 * Crisis command center for major incidents
 */
$pageTitle = 'War Room';
?>

<style>
.war-room {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
}

.war-header {
    background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
    color: white;
    padding: 32px;
    border-radius: 16px;
    margin-bottom: 32px;
}

.war-header h1 { margin: 0 0 8px; font-size: 32px; }
.war-header p { margin: 0; opacity: 0.9; }

.war-grid {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 24px;
}

.war-card {
    background: white;
    border-radius: 12px;
    padding: 24px;
    border: 1px solid #e5e7eb;
}

.war-card h2 {
    font-size: 18px;
    margin: 0 0 20px;
    padding-bottom: 12px;
    border-bottom: 2px solid #e5e7eb;
}

.session-item {
    padding: 16px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    margin-bottom: 12px;
    cursor: pointer;
    transition: all 0.2s;
}

.session-item:hover { border-color: #dc2626; background: #fef2f2; }
.session-item.active { border-color: #dc2626; background: #fef2f2; border-left: 4px solid #dc2626; }

.session-status {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
}

.session-status.active { background: #fee2e2; color: #dc2626; }
.session-status.monitoring { background: #fef3c7; color: #d97706; }
.session-status.resolved { background: #d1fae5; color: #059669; }

.critical-data {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
}

.critical-stat {
    text-align: center;
    padding: 20px;
    background: #fef2f2;
    border-radius: 8px;
}

.critical-stat .number {
    font-size: 36px;
    font-weight: 700;
    color: #dc2626;
}

.critical-stat .label {
    font-size: 12px;
    color: #6b7280;
    text-transform: uppercase;
}

.btn-create {
    width: 100%;
    padding: 16px;
    background: #dc2626;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-create:hover { background: #b91c1c; }
</style>

<div class="war-room">
    <div class="war-header">
        <h1>🚨 Executive War Room</h1>
        <p>Crisis command center for major incidents, payroll failures, compliance issues, and multi-store outages.</p>
    </div>

    <div class="critical-data" style="margin-bottom: 32px;">
        <div class="critical-stat">
            <div class="number"><?= $criticalData['critical_predictions'] ?? 0 ?></div>
            <div class="label">Critical Predictions</div>
        </div>
        <div class="critical-stat">
            <div class="number"><?= $criticalData['overdue_tasks'] ?? 0 ?></div>
            <div class="label">Overdue Tasks</div>
        </div>
        <div class="critical-stat">
            <div class="number"><?= $criticalData['overdue_bills'] ?? 0 ?></div>
            <div class="label">Overdue Bills</div>
        </div>
        <div class="critical-stat">
            <div class="number"><?= $criticalData['today_incidents'] ?? 0 ?></div>
            <div class="label">Today's Incidents</div>
        </div>
    </div>

    <div class="war-grid">
        <div>
            <div class="war-card">
                <h2>Active Sessions (<?= count($activeSessions) ?>)</h2>
                
                <?php if (empty($activeSessions)): ?>
                <div style="text-align: center; padding: 40px; color: #6b7280;">
                    <div style="font-size: 48px; margin-bottom: 16px;">🎯</div>
                    <p>No active war room sessions. System is stable.</p>
                </div>
                <?php else: ?>
                <?php foreach ($activeSessions as $session): ?>
                <a href="/ceo/war-room/<?= $session['id'] ?>" class="session-item">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <strong><?= htmlspecialchars($session['title']) ?></strong>
                            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
                                <?= $session['category'] ?> • Started <?= timeAgo($session['started_at']) ?>
                            </div>
                        </div>
                        <span class="session-status <?= $session['status'] ?>"><?= ucfirst($session['status']) ?></span>
                    </div>
                </a>
                <?php endforeach; ?>
                <?php endif; ?>
            </div>

            <div class="war-card" style="margin-top: 24px;">
                <h2>Recent Sessions</h2>
                <?php foreach (array_slice($allSessions, 0, 5) as $session): ?>
                <a href="/ceo/war-room/<?= $session['id'] ?>" class="session-item" style="opacity: 0.8;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <strong><?= htmlspecialchars($session['title']) ?></strong>
                            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
                                <?= timeAgo($session['started_at']) ?>
                            </div>
                        </div>
                        <span class="session-status <?= $session['status'] ?>"><?= ucfirst($session['status']) ?></span>
                    </div>
                </a>
                <?php endforeach; ?>
            </div>
        </div>

        <div>
            <div class="war-card">
                <h2>Create War Room</h2>
                <form action="/ceo/war-room" method="POST">
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 4px;">Title</label>
                        <input type="text" name="title" placeholder="e.g., Store A Critical Incident" required
                            style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 4px;">Severity</label>
                        <select name="severity" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                            <option value="critical">Critical</option>
                            <option value="high">High</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 4px;">Category</label>
                        <select name="category" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                            <option value="incident">Incident</option>
                            <option value="payroll_failure">Payroll Failure</option>
                            <option value="compliance">Compliance</option>
                            <option value="outage">Multi-Store Outage</option>
                            <option value="escalation">Franchise Escalation</option>
                        </select>
                    </div>
                    <button type="submit" class="btn-create">🚨 Activate War Room</button>
                </form>
            </div>

            <div class="war-card" style="margin-top: 24px;">
                <h2>Quick Actions</h2>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <a href="/admin/command-center/predictions" style="padding: 12px; background: #fef2f2; border-radius: 8px; text-decoration: none; color: #dc2626; font-weight: 500;">
                        View Critical Predictions
                    </a>
                    <a href="/admin/command-center" style="padding: 12px; background: #f3f4f6; border-radius: 8px; text-decoration: none; color: #374151; font-weight: 500;">
                        Go to Command Center
                    </a>
                </div>
            </div>
        </div>
    </div>
</div>

