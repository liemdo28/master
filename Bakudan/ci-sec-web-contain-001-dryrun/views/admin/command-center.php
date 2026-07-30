<?php
/**
 * Phase 8 — Module 1: Operational Command Center
 * Mission Control for the entire company
 */
$pageTitle = 'Command Center';
?>

<style>
.p8-command-center {
    max-width: 1600px;
    margin: 0 auto;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* Executive Health Banner */
.p8-health-banner {
    padding: 24px 32px;
    border-radius: 16px;
    margin-bottom: 32px;
    display: flex;
    align-items: center;
    gap: 24px;
}

.p8-health-banner.healthy {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
}

.p8-health-banner.warning {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
}

.p8-health-banner.critical {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    animation: pulse-critical 2s infinite;
}

@keyframes pulse-critical {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
    50% { box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); }
}

.p8-health-score {
    font-size: 64px;
    font-weight: 700;
    line-height: 1;
}

.p8-health-label {
    font-size: 20px;
    opacity: 0.9;
    margin-top: 4px;
}

.p8-health-message {
    font-size: 18px;
    margin-left: auto;
}

/* Module Grid */
.p8-modules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 32px;
}

.p8-module-card {
    background: white;
    border-radius: 12px;
    padding: 20px;
    border: 1px solid #e5e7eb;
    transition: all 0.2s;
}

.p8-module-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.1);
}

.p8-module-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    margin-bottom: 12px;
}

.p8-module-icon.healthy { background: #d1fae5; color: #059669; }
.p8-module-icon.warning { background: #fef3c7; color: #d97706; }
.p8-module-icon.critical { background: #fee2e2; color: #dc2626; }

.p8-module-name {
    font-size: 14px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 4px;
}

.p8-module-score {
    font-size: 32px;
    font-weight: 700;
    color: #1f2937;
}

.p8-module-score span { font-size: 14px; color: #6b7280; font-weight: 400; }

/* Section Headers */
.p8-section {
    margin-bottom: 40px;
}

.p8-section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.p8-section-title {
    font-size: 20px;
    font-weight: 600;
    color: #1f2937;
}

/* Prediction Cards */
.p8-predictions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 16px;
}

.p8-prediction-card {
    background: white;
    border-radius: 12px;
    padding: 20px;
    border: 1px solid #e5e7eb;
    position: relative;
}

.p8-prediction-card.critical { border-left: 4px solid #dc2626; }
.p8-prediction-card.high { border-left: 4px solid #f59e0b; }
.p8-prediction-card.medium { border-left: 4px solid #3b82f6; }
.p8-prediction-card.low { border-left: 4px solid #6b7280; }

.p8-prediction-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
}

.p8-prediction-type {
    font-size: 12px;
    text-transform: uppercase;
    color: #6b7280;
    letter-spacing: 0.05em;
}

.p8-prediction-probability {
    font-size: 24px;
    font-weight: 700;
}

.p8-prediction-probability.critical { color: #dc2626; }
.p8-prediction-probability.high { color: #f59e0b; }
.p8-prediction-probability.medium { color: #3b82f6; }

.p8-prediction-description {
    color: #4b5563;
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 12px;
}

.p8-prediction-actions {
    display: flex;
    gap: 8px;
}

/* Recommendation Cards */
.p8-recommendation-card {
    background: white;
    border-radius: 12px;
    padding: 20px;
    border: 1px solid #e5e7eb;
    margin-bottom: 12px;
}

.p8-recommendation-priority {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
}

.p8-recommendation-priority.urgent { background: #fee2e2; color: #dc2626; }
.p8-recommendation-priority.high { background: #fef3c7; color: #d97706; }
.p8-recommendation-priority.medium { background: #dbeafe; color: #2563eb; }
.p8-recommendation-priority.low { background: #f3f4f6; color: #6b7280; }

/* Store Scores */
.p8-scores-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
}

.p8-score-card {
    background: white;
    border-radius: 12px;
    padding: 20px;
    border: 1px solid #e5e7eb;
}

.p8-score-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.p8-score-name {
    font-weight: 600;
    color: #1f2937;
}

.p8-score-trend {
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 4px;
}

.p8-score-trend.improving { background: #d1fae5; color: #059669; }
.p8-score-trend.stable { background: #f3f4f6; color: #6b7280; }
.p8-score-trend.declining { background: #fee2e2; color: #dc2626; }

.p8-score-value {
    font-size: 48px;
    font-weight: 700;
    margin-bottom: 12px;
}

.p8-score-value.excellent { color: #059669; }
.p8-score-value.good { color: #3b82f6; }
.p8-score-value.warning { color: #f59e0b; }
.p8-score-value.critical { color: #dc2626; }

.p8-score-bar {
    height: 8px;
    background: #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
}

.p8-score-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s;
}

.p8-score-bar-fill.excellent { background: #10b981; }
.p8-score-bar-fill.good { background: #3b82f6; }
.p8-score-bar-fill.warning { background: #f59e0b; }
.p8-score-bar-fill.critical { background: #ef4444; }

/* Buttons */
.p8-btn {
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
}

.p8-btn-primary { background: #3b82f6; color: white; }
.p8-btn-primary:hover { background: #2563eb; }
.p8-btn-success { background: #10b981; color: white; }
.p8-btn-success:hover { background: #059669; }
.p8-btn-danger { background: #ef4444; color: white; }
.p8-btn-danger:hover { background: #dc2626; }
.p8-btn-secondary { background: #f3f4f6; color: #374151; }
.p8-btn-secondary:hover { background: #e5e7eb; }

/* Navigation Tabs */
.p8-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
    border-bottom: 2px solid #e5e7eb;
    padding-bottom: 8px;
}

.p8-tab {
    padding: 8px 20px;
    border-radius: 8px 8px 0 0;
    font-size: 14px;
    font-weight: 500;
    color: #6b7280;
    text-decoration: none;
    transition: all 0.2s;
}

.p8-tab:hover { color: #374151; background: #f3f4f6; }
.p8-tab.active { color: #3b82f6; border-bottom: 2px solid #3b82f6; margin-bottom: -10px; }

/* Empty State */
.p8-empty {
    text-align: center;
    padding: 60px 20px;
    color: #6b7280;
}

.p8-empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
}

/* Responsive */
@media (max-width: 768px) {
    .p8-health-banner { flex-direction: column; text-align: center; }
    .p8-health-message { margin-left: 0; }
    .p8-modules-grid { grid-template-columns: repeat(2, 1fr); }
    .p8-predictions-grid { grid-template-columns: 1fr; }
}
</style>

<div class="p8-command-center">
    <!-- Navigation Tabs -->
    <div class="p8-tabs">
        <a href="/admin/command-center" class="p8-tab active">Overview</a>
        <a href="/admin/command-center/predictions" class="p8-tab">Predictions</a>
        <a href="/admin/command-center/recommendations" class="p8-tab">Recommendations</a>
        <a href="/admin/command-center/workflows" class="p8-tab">Workflows</a>
        <a href="/admin/command-center/scores" class="p8-tab">Scores</a>
        <a href="/admin/command-center/memory" class="p8-tab">Memory</a>
        <a href="/admin/command-center/ai-decisions" class="p8-tab">AI Decisions</a>
        <a href="/ceo/war-room" class="p8-tab" style="color: #dc2626;">War Room</a>
    </div>

    <!-- Executive Health Banner -->
    <div class="p8-health-banner <?= $overallHealth['health'] ?>">
        <div>
            <div class="p8-health-score"><?= $overallHealth['score'] ?>%</div>
            <div class="p8-health-label">Overall Health</div>
        </div>
        <div class="p8-health-message">
            <?= htmlspecialchars($overallHealth['message']) ?>
            <?php if ($overallHealth['critical_predictions'] > 0): ?>
                <br><strong><?= $overallHealth['critical_predictions'] ?> critical predictions require immediate action</strong>
            <?php endif; ?>
        </div>
    </div>

    <!-- Module Status Grid -->
    <div class="p8-section">
        <div class="p8-section-header">
            <h2 class="p8-section-title">Module Status</h2>
            <span style="color: #6b7280; font-size: 14px;">Last updated: <?= date('H:i:s') ?></span>
        </div>
        <div class="p8-modules-grid">
            <?php foreach ($moduleStatus as $module => $data): ?>
            <div class="p8-module-card">
                <div class="p8-module-icon <?= $data['status'] ?>">
                    <?= match($module) {
                        'stores' => '🏪',
                        'incidents' => '🚨',
                        'payroll' => '💰',
                        'compliance' => '✅',
                        'audits' => '📋',
                        'releases' => '🚀',
                        'training' => '📚',
                        'staffing' => '👥',
                        default => '📊'
                    } ?>
                </div>
                <div class="p8-module-name"><?= ucfirst($module) ?></div>
                <div class="p8-module-score">
                    <?= $data['score'] ?><span>/100</span>
                </div>
                <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
                    <?php
                    $details = $data['details'] ?? [];
                    if (!empty($details['overdue'])) echo $details['overdue'] . ' overdue';
                    elseif (!empty($details['total'])) echo $details['total'] . ' total';
                    elseif (!empty($details['pending'])) echo $details['pending'] . ' pending';
                    elseif (!empty($details['today'])) echo $details['today'] . ' today';
                    elseif (!empty($details['status'])) echo $details['status'];
                    else echo ucfirst($data['status']);
                    ?>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
    </div>

    <!-- Predictions Section -->
    <div class="p8-section">
        <div class="p8-section-header">
            <h2 class="p8-section-title">Active Predictions (<?= count($predictions) ?>)</h2>
            <div>
                <button class="p8-btn p8-btn-secondary" onclick="refreshPredictions()">Refresh</button>
                <a href="/admin/command-center/predictions" class="p8-btn p8-btn-primary">View All</a>
            </div>
        </div>
        <?php if (empty($predictions)): ?>
        <div class="p8-empty">
            <div class="p8-empty-icon">🎯</div>
            <p>No active predictions. System is operating normally.</p>
        </div>
        <?php else: ?>
        <div class="p8-predictions-grid">
            <?php foreach (array_slice($predictions, 0, 6) as $p): ?>
            <div class="p8-prediction-card <?= $p['severity'] ?>">
                <div class="p8-prediction-header">
                    <div>
                        <div class="p8-prediction-type"><?= str_replace('_', ' ', $p['prediction_type']) ?></div>
                        <div style="font-size: 12px; color: #6b7280;">Horizon: <?= $p['horizon_hours'] ?>h</div>
                    </div>
                    <div class="p8-prediction-probability <?= $p['severity'] ?>">
                        <?= round($p['probability']) ?>%
                    </div>
                </div>
                <div class="p8-prediction-description"><?= htmlspecialchars($p['description']) ?></div>
                <div class="p8-prediction-actions">
                    <button class="p8-btn p8-btn-secondary" onclick="acknowledgePrediction(<?= $p['id'] ?>)">Acknowledge</button>
                    <button class="p8-btn p8-btn-success" onclick="markPrevented(<?= $p['id'] ?>)">Prevented</button>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
        <?php endif; ?>
    </div>

    <!-- Recommendations Section -->
    <div class="p8-section">
        <div class="p8-section-header">
            <h2 class="p8-section-title">Recommended Actions (<?= count($recommendations) ?>)</h2>
            <a href="/admin/command-center/recommendations" class="p8-btn p8-btn-primary">View All</a>
        </div>
        <?php if (empty($recommendations)): ?>
        <div class="p8-empty">
            <div class="p8-empty-icon">✨</div>
            <p>No pending recommendations. Great job!</p>
        </div>
        <?php else: ?>
        <?php foreach (array_slice($recommendations, 0, 5) as $rec): ?>
        <div class="p8-recommendation-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <div>
                    <span class="p8-recommendation-priority <?= $rec['priority'] ?>"><?= $rec['priority'] ?></span>
                    <h3 style="margin: 8px 0; font-size: 16px;"><?= htmlspecialchars($rec['title']) ?></h3>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="p8-btn p8-btn-success" onclick="acceptRecommendation(<?= $rec['id'] ?>)">Accept</button>
                    <button class="p8-btn p8-btn-secondary" onclick="rejectRecommendation(<?= $rec['id'] ?>)">Dismiss</button>
                </div>
            </div>
            <p style="color: #4b5563; font-size: 14px; margin-bottom: 12px;"><?= htmlspecialchars($rec['description']) ?></p>
            <div style="font-size: 12px; color: #6b7280;">
                Expected impact: <?= $rec['expected_impact']['health_improvement'] ?? '?' ?>% improvement
            </div>
        </div>
        <?php endforeach; ?>
        <?php endif; ?>
    </div>

    <!-- Store Scores -->
    <div class="p8-section">
        <div class="p8-section-header">
            <h2 class="p8-section-title">Store Scores</h2>
            <a href="/admin/command-center/scores" class="p8-btn p8-btn-primary">View All</a>
        </div>
        <div class="p8-scores-grid">
            <?php foreach ($storeScores as $storeId => $data): 
                $score = $data['score']['score'] ?? 0;
                $scoreClass = $score >= 80 ? 'excellent' : ($score >= 60 ? 'good' : ($score >= 40 ? 'warning' : 'critical'));
                $trend = $data['score']['trend'] ?? 'stable';
            ?>
            <div class="p8-score-card">
                <div class="p8-score-header">
                    <div class="p8-score-name"><?= htmlspecialchars($data['name']) ?></div>
                    <span class="p8-score-trend <?= $trend ?>"><?= ucfirst($trend) ?></span>
                </div>
                <div class="p8-score-value <?= $scoreClass ?>"><?= round($score) ?></div>
                <div class="p8-score-bar">
                    <div class="p8-score-bar-fill <?= $scoreClass ?>" style="width: <?= $score ?>%"></div>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
    </div>

    <!-- Corrective Actions -->
    <?php if (!empty($correctiveActions)): ?>
    <div class="p8-section">
        <div class="p8-section-header">
            <h2 class="p8-section-title">Pending Corrective Actions (<?= count($correctiveActions) ?>)</h2>
        </div>
        <div class="p8-recommendation-card">
            <?php foreach ($correctiveActions as $ca): ?>
            <div style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong><?= htmlspecialchars($ca['title']) ?></strong>
                        <div style="font-size: 12px; color: #6b7280;"><?= $ca['trigger_type'] ?> • <?= timeAgo($ca['proposed_at']) ?></div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="p8-btn p8-btn-success">Approve</button>
                        <button class="p8-btn p8-btn-danger">Reject</button>
                    </div>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
    </div>
    <?php endif; ?>
</div>

<script>
function acknowledgePrediction(id) {
    fetch('/admin/command-center/predictions/' + id + '/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }).then(() => location.reload());
}

function markPrevented(id) {
    fetch('/admin/command-center/predictions/' + id + '/prevent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }).then(() => location.reload());
}

function acceptRecommendation(id) {
    fetch('/admin/command-center/recommendations/' + id + '/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }).then(() => location.reload());
}

function rejectRecommendation(id) {
    fetch('/admin/command-center/recommendations/' + id + '/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }).then(() => location.reload());
}

function refreshPredictions() {
    fetch('/admin/command-center/predictions/run', { method: 'POST' })
        .then(r => r.json())
        .then(() => location.reload());
}

// Auto-refresh every 30 seconds
setInterval(() => {
    fetch('/admin/command-center/api/summary')
        .then(r => r.json())
        .then(data => {
            // Update health banner
            const banner = document.querySelector('.p8-health-banner');
            if (banner) {
                banner.className = 'p8-health-banner ' + data.overall_health.health;
                banner.querySelector('.p8-health-score').textContent = data.overall_health.score + '%';
            }
        });
}, 30000);
</script>

