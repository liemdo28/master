<?php
/**
 * Approval Workflow Panel — included in views/tasks/detail.php
 * Variables expected: $task, $approvalHistory, $taskModel
 */
if (empty($task['approval_required'])) return;

$uid         = (int)($_SESSION['user_id'] ?? 0);
$status      = $task['status'] ?? '';
$isAdmin     = canAdmin();
$isAssignee  = $uid === (int)($task['assignee_id'] ?? 0);
$isReviewer  = $uid === (int)($task['reviewer_id'] ?? 0);
$isApprover  = $uid === (int)($task['approver_id'] ?? 0);

// Load reviewer/approver names
$db          = Database::getInstance();
$reviewerUser = !empty($task['reviewer_id']) ? $db->fetch("SELECT id, name FROM users WHERE id = ?", [$task['reviewer_id']]) : null;
$approverUser = !empty($task['approver_id']) ? $db->fetch("SELECT id, name FROM users WHERE id = ?", [$task['approver_id']]) : null;

$stageInfo = $taskModel->getApprovalStageInfo($task);

// Status display config
$statusConfig = [
    'in_progress'         => ['color'=>'#60a5fa', 'bg'=>'rgba(96,165,250,.12)', 'icon'=>'▶', 'label'=>'In Progress'],
    'pending_review'      => ['color'=>'#fbbf24', 'bg'=>'rgba(251,191,36,.12)',  'icon'=>'👁', 'label'=>'Pending Review'],
    'review_rejected'     => ['color'=>'#f87171', 'bg'=>'rgba(248,113,113,.12)', 'icon'=>'✕', 'label'=>'Review Rejected'],
    'pending_acceptance'  => ['color'=>'#a78bfa', 'bg'=>'rgba(167,139,250,.12)', 'icon'=>'⏳', 'label'=>'Pending Acceptance'],
    'acceptance_rejected' => ['color'=>'#f87171', 'bg'=>'rgba(248,113,113,.12)', 'icon'=>'✕', 'label'=>'Acceptance Rejected'],
    'accepted'            => ['color'=>'#4ade80', 'bg'=>'rgba(74,222,128,.12)',  'icon'=>'✓', 'label'=>'Accepted'],
    'done'                => ['color'=>'#4ade80', 'bg'=>'rgba(74,222,128,.12)',  'icon'=>'✓', 'label'=>'Done'],
];
$sc = $statusConfig[$status] ?? ['color'=>'#71717a','bg'=>'rgba(113,113,122,.1)','icon'=>'●','label'=>ucfirst($status)];

// Action history event labels
$actionLabels = [
    'submitted'           => ['icon'=>'📤','label'=>'Submitted for Review', 'color'=>'#60a5fa'],
    'review_approved'     => ['icon'=>'✅','label'=>'Review Approved',      'color'=>'#4ade80'],
    'review_rejected'     => ['icon'=>'❌','label'=>'Review Rejected',      'color'=>'#f87171'],
    'acceptance_approved' => ['icon'=>'🎉','label'=>'Task Accepted',        'color'=>'#4ade80'],
    'acceptance_rejected' => ['icon'=>'❌','label'=>'Acceptance Rejected',   'color'=>'#f87171'],
    'marked_done'         => ['icon'=>'✅','label'=>'Marked Done',          'color'=>'#4ade80'],
    'reopened'            => ['icon'=>'🔄','label'=>'Reopened',             'color'=>'#71717a'],
    'started'             => ['icon'=>'▶', 'label'=>'Started',              'color'=>'#60a5fa'],
    'override'            => ['icon'=>'⚡','label'=>'Admin Override',       'color'=>'#fbbf24'],
];
?>
<style>
.approval-panel{background:#18181b;border:1px solid #27272a;border-radius:12px;margin-top:20px;overflow:hidden}
.approval-panel-header{padding:14px 18px;border-bottom:1px solid #27272a;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}
.approval-panel-title{font-size:13px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:.06em;display:flex;align-items:center;gap:8px}
.approval-chain{display:flex;align-items:center;gap:0;padding:18px;flex-wrap:wrap;gap:8px}
.chain-step{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:120px;flex:1}
.chain-step-icon{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid}
.chain-step-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
.chain-step-name{font-size:12px;font-weight:600;color:#e4e4e7;text-align:center}
.chain-step-role{font-size:10px;color:#52525b}
.chain-arrow{font-size:18px;color:#3f3f46;flex-shrink:0;align-self:center;margin-bottom:28px}
.chain-step.active .chain-step-icon{box-shadow:0 0 0 3px currentColor}
.chain-step.done .chain-step-icon{opacity:.5}

.stage-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700}

.approval-actions{padding:16px 18px;border-top:1px solid #27272a;display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap}
.action-form{display:flex;flex-direction:column;gap:8px;flex:1;min-width:200px}
.action-form textarea{background:#1c1c1f;border:1px solid #27272a;color:#e4e4e7;border-radius:8px;padding:8px 10px;font-size:12px;resize:vertical;min-height:56px;outline:none}
.action-form textarea:focus{border-color:#3b82f6}
.action-form textarea::placeholder{color:#3f3f46}
.btn-approve{background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.4);color:#4ade80;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px}
.btn-approve:hover{background:rgba(34,197,94,.25)}
.btn-reject-review{background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.35);color:#fbbf24;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px}
.btn-reject-review:hover{background:rgba(251,191,36,.2)}
.btn-reject{background:rgba(248,113,113,.12);border:1px solid rgba(248,113,113,.35);color:#f87171;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px}
.btn-reject:hover{background:rgba(248,113,113,.2)}
.btn-submit{background:#1d4ed8;border:1px solid #2563eb;color:#fff;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px}
.btn-submit:hover{background:#2563eb}

.rejection-box{background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.25);border-radius:8px;padding:12px 14px;margin:0 18px 16px}
.rejection-box-label{font-size:11px;font-weight:700;color:#f87171;text-transform:uppercase;margin-bottom:4px}
.rejection-box-text{font-size:13px;color:#fca5a5}

.approval-timeline{padding:14px 18px;border-top:1px solid #27272a}
.timeline-title{font-size:11px;font-weight:700;color:#52525b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px}
.timeline-entry{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid #1c1c1f;align-items:flex-start}
.timeline-entry:last-child{border-bottom:none}
.timeline-dot{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;background:#27272a}
.timeline-body{flex:1;min-width:0}
.timeline-action{font-size:12px;font-weight:600;color:#e4e4e7}
.timeline-meta{font-size:11px;color:#52525b;margin-top:1px}
.timeline-comment{font-size:11px;color:#a1a1aa;margin-top:4px;padding:4px 8px;background:#1c1c1f;border-radius:4px;border-left:2px solid #27272a}
.timeline-override{font-size:10px;color:#fbbf24;font-weight:700;margin-left:4px}
</style>

<div class="approval-panel">
    <div class="approval-panel-header">
        <div class="approval-panel-title">
            🔐 Approval Workflow
        </div>
        <span class="stage-badge" style="background:<?= $sc['bg'] ?>;color:<?= $sc['color'] ?>;border:1px solid <?= $sc['color'] ?>30">
            <?= $sc['icon'] ?> <?= $sc['label'] ?>
        </span>
    </div>

    <!-- 3-Step Chain Visualization -->
    <div class="approval-chain">
        <?php
        // Step 1: Assignee
        $s1Active = in_array($status, ['in_progress','review_rejected','acceptance_rejected','todo']);
        $s1Done   = !in_array($status, ['in_progress','review_rejected','acceptance_rejected','todo','pending_review']) || $status === 'pending_review';
        $s1Color  = $s1Done ? '#4ade80' : ($s1Active ? '#60a5fa' : '#3f3f46');
        ?>
        <div class="chain-step <?= $s1Done ? 'done' : ($s1Active ? 'active' : '') ?>" style="color:<?= $s1Color ?>">
            <div class="chain-step-icon" style="background:<?= $s1Color ?>18;border-color:<?= $s1Color ?>">
                <?= $s1Done ? '✓' : '✏️' ?>
            </div>
            <div class="chain-step-label" style="color:<?= $s1Color ?>">Assignee</div>
            <div class="chain-step-name"><?= e($task['assignee_name'] ?? '—') ?></div>
            <div class="chain-step-role">Do & Submit</div>
        </div>
        <div class="chain-arrow">→</div>

        <?php
        // Step 2: Reviewer
        $s2Active = $status === 'pending_review';
        $s2Done   = in_array($status, ['pending_acceptance','acceptance_rejected','accepted','done']);
        $s2Color  = $s2Done ? '#4ade80' : ($s2Active ? '#fbbf24' : '#3f3f46');
        ?>
        <div class="chain-step <?= $s2Done ? 'done' : ($s2Active ? 'active' : '') ?>" style="color:<?= $s2Color ?>">
            <div class="chain-step-icon" style="background:<?= $s2Color ?>18;border-color:<?= $s2Color ?>">
                <?= $s2Done ? '✓' : '👁' ?>
            </div>
            <div class="chain-step-label" style="color:<?= $s2Color ?>">Reviewer</div>
            <div class="chain-step-name"><?= e($reviewerUser['name'] ?? '—') ?></div>
            <div class="chain-step-role">Review & Approve</div>
        </div>
        <div class="chain-arrow">→</div>

        <?php
        // Step 3: Approver
        $s3Active = $status === 'pending_acceptance';
        $s3Done   = in_array($status, ['accepted','done']);
        $s3Color  = $s3Done ? '#4ade80' : ($s3Active ? '#a78bfa' : '#3f3f46');
        ?>
        <div class="chain-step <?= $s3Done ? 'done' : ($s3Active ? 'active' : '') ?>" style="color:<?= $s3Color ?>">
            <div class="chain-step-icon" style="background:<?= $s3Color ?>18;border-color:<?= $s3Color ?>">
                <?= $s3Done ? '✓' : '🎯' ?>
            </div>
            <div class="chain-step-label" style="color:<?= $s3Color ?>">Approver</div>
            <div class="chain-step-name"><?= e($approverUser['name'] ?? '—') ?></div>
            <div class="chain-step-role">Final Acceptance</div>
        </div>
    </div>

    <!-- Rejection reason banner -->
    <?php if (in_array($status, ['review_rejected','acceptance_rejected']) && !empty($task['rejection_reason'])): ?>
    <div class="rejection-box">
        <div class="rejection-box-label">❌ Rejection Reason</div>
        <div class="rejection-box-text"><?= e($task['rejection_reason']) ?></div>
    </div>
    <?php endif; ?>

    <!-- Action Buttons based on current user's role in this task -->
    <?php

    // ── Assignee: can submit when in_progress / rejected ──────────────────────
    $canSubmit = ($isAssignee || $isAdmin)
        && !$task['is_completed']
        && in_array($status, ['in_progress','todo','review_rejected','acceptance_rejected']);

    // ── Reviewer: can approve/reject when pending_review ──────────────────────
    $canReview = ($isReviewer || $isAdmin)
        && $status === 'pending_review';

    // ── Approver: can accept/reject when pending_acceptance ───────────────────
    $canAccept = ($isApprover || $isAdmin)
        && $status === 'pending_acceptance';

    // ── Admin: can reopen any approval-stage task ──────────────────────────────
    $canReopen = $isAdmin
        && in_array($status, ['pending_review','review_rejected','pending_acceptance','acceptance_rejected']);

    if ($canSubmit || $canReview || $canAccept || $canReopen):
    ?>
    <div class="approval-actions">

        <?php if ($canSubmit): ?>
        <form method="POST" action="<?= APP_URL ?>/tasks/<?= $task['id'] ?>/submit" class="action-form">
            <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
            <textarea name="note" placeholder="Optional note for reviewer…"></textarea>
            <button type="submit" class="btn-submit" onclick="return confirm('Submit this task for review?')">
                📤 Submit for Review
            </button>
        </form>
        <?php endif; ?>

        <?php if ($canReview): ?>
        <form method="POST" action="<?= APP_URL ?>/tasks/<?= $task['id'] ?>/review-approve" class="action-form">
            <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
            <textarea name="note" placeholder="Review note (optional)…"></textarea>
            <button type="submit" class="btn-approve" onclick="return confirm('Approve this review and send for final acceptance?')">
                ✅ Approve Review
            </button>
        </form>
        <form method="POST" action="<?= APP_URL ?>/tasks/<?= $task['id'] ?>/review-reject" class="action-form">
            <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
            <textarea name="reason" placeholder="Rejection reason (required)…" required></textarea>
            <button type="submit" class="btn-reject-review">
                ❌ Reject Review
            </button>
        </form>
        <?php endif; ?>

        <?php if ($canAccept): ?>
        <form method="POST" action="<?= APP_URL ?>/tasks/<?= $task['id'] ?>/accept" class="action-form">
            <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
            <textarea name="note" placeholder="Acceptance note (optional)…"></textarea>
            <button type="submit" class="btn-approve" onclick="return confirm('Accept this task and mark it DONE?')">
                🎉 Accept Task → Done
            </button>
        </form>
        <form method="POST" action="<?= APP_URL ?>/tasks/<?= $task['id'] ?>/accept-reject" class="action-form">
            <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
            <textarea name="reason" placeholder="Rejection reason (required)…" required></textarea>
            <button type="submit" class="btn-reject">
                ❌ Reject Acceptance
            </button>
        </form>
        <?php endif; ?>

        <?php if ($canReopen): ?>
        <form method="POST" action="<?= APP_URL ?>/tasks/<?= $task['id'] ?>/reopen-approval" class="action-form" style="min-width:auto">
            <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
            <button type="submit" class="btn-reject-review" style="font-size:11px" onclick="return confirm('Reopen this task? This will clear all approval progress.')">
                ⚡ Admin: Reopen
            </button>
        </form>
        <?php endif; ?>

    </div>
    <?php endif; ?>

    <!-- Waiting state message (for users with no action at this stage) -->
    <?php if (!$canSubmit && !$canReview && !$canAccept && !$task['is_completed'] && in_array($status, ['pending_review','pending_acceptance'])): ?>
    <div style="padding:12px 18px;border-top:1px solid #27272a;font-size:12px;color:#71717a">
        <?php if ($status === 'pending_review'): ?>
        ⏳ Waiting for <strong style="color:#fbbf24"><?= e($reviewerUser['name'] ?? 'reviewer') ?></strong> to review
        <?php else: ?>
        ⏳ Waiting for <strong style="color:#a78bfa"><?= e($approverUser['name'] ?? 'approver') ?></strong> to accept
        <?php endif; ?>
    </div>
    <?php endif; ?>

    <!-- Final done state -->
    <?php if ($status === 'done' && !empty($task['final_done_at'])): ?>
    <div style="padding:12px 18px;border-top:1px solid #27272a;font-size:12px;color:#4ade80">
        ✅ <strong>Final Done:</strong> <?= date('M j, Y g:ia', strtotime($task['final_done_at'])) ?>
    </div>
    <?php endif; ?>

    <!-- Approval Timeline -->
    <?php if (!empty($approvalHistory)): ?>
    <div class="approval-timeline">
        <div class="timeline-title">Approval History</div>
        <?php foreach ($approvalHistory as $event):
            $al = $actionLabels[$event['action_type']] ?? ['icon'=>'●','label'=>$event['action_type'],'color'=>'#71717a'];
        ?>
        <div class="timeline-entry">
            <div class="timeline-dot" style="background:<?= $al['color'] ?>15">
                <?= $al['icon'] ?>
            </div>
            <div class="timeline-body">
                <div class="timeline-action" style="color:<?= $al['color'] ?>">
                    <?= $al['label'] ?>
                    <?php if ($event['is_override']): ?><span class="timeline-override">⚡ OVERRIDE</span><?php endif; ?>
                </div>
                <div class="timeline-meta">
                    by <?= e($event['actor_name'] ?? 'Unknown') ?>
                    · <?= date('M j, Y g:ia', strtotime($event['created_at'])) ?>
                    <?php if ($event['from_status'] && $event['to_status']): ?>
                    · <span style="color:#3f3f46"><?= e($event['from_status']) ?> → <?= e($event['to_status']) ?></span>
                    <?php endif; ?>
                </div>
                <?php if ($event['comment']): ?>
                <div class="timeline-comment"><?= e($event['comment']) ?></div>
                <?php endif; ?>
            </div>
        </div>
        <?php endforeach; ?>
    </div>
    <?php endif; ?>
</div>
