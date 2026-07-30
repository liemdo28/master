<?php
/**
 * Tab: Reviewer Notes — Reviewer workspace: instructions, checklists, questions
 * Variables: $task, $reviewerNotes, $canAddReviewerNote, $pendingCount
 */
$currentUid = (int)($_SESSION['user_id'] ?? 0);

$noteTypeConfig = [
    'instruction' => ['icon' => 'bookmark',     'color' => '#fbbf24', 'bg' => 'rgba(251,191,36,.12)',  'label' => 'Instruction'],
    'checklist'   => ['icon' => 'check-square', 'color' => '#4ade80', 'bg' => 'rgba(74,222,128,.12)',  'label' => 'Checklist'],
    'question'    => ['icon' => 'help-circle',  'color' => '#a78bfa', 'bg' => 'rgba(167,139,250,.12)', 'label' => 'Question'],
    'description' => ['icon' => 'file-text',     'color' => '#60a5fa', 'bg' => 'rgba(96,165,250,.12)',  'label' => 'Description'],
    'general'     => ['icon' => 'message-circle','color' => '#34d399', 'bg' => 'rgba(52,211,153,.12)', 'label' => 'Note'],
];
?>

<style>
.rn-card{background:#0d1117;border:1px solid #21262d;border-radius:10px;padding:14px 16px;margin-bottom:12px}
.rn-card:last-child{margin-bottom:0}
.rn-card.pending{border-left:3px solid #fbbf24}
.rn-card.done{opacity:.7;border-left:3px solid #4ade80}
.rn-header{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}
.rn-badge{font-size:10px;padding:3px 8px;border-radius:20px;font-weight:700;display:inline-flex;align-items:center;gap:4px}
.rn-title{font-size:13px;font-weight:700;color:#e4e4e7;margin-bottom:6px}
.rn-body{font-size:12px;color:#c9d1d9;line-height:1.6}
.rn-checklist-item{display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #1c1c1f;font-size:12px;color:#c9d1d9}
.rn-checklist-item:last-child{border-bottom:none}
.rn-checklist-item.done{color:#4ade80;text-decoration:line-through}
.rn-meta{display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap}
.rn-avatar{width:20px;height:20px;border-radius:50%;background:rgba(96,165,250,.2);display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#60a5fa;text-transform:uppercase;flex-shrink:0}
.rn-time{font-size:11px;color:#484f58}
.rn-ack-badge{font-size:10px;padding:2px 7px;border-radius:10px;background:rgba(74,222,128,.15);color:#4ade80;font-weight:700}
.rn-actions{display:flex;gap:6px;margin-top:8px}

/* Add note form */
.add-note-card{background:#0d1117;border:1px solid #30363d;border-radius:10px;padding:16px;margin-top:12px}
.add-note-type{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}
.note-type-btn{padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid #30363d;background:transparent;color:#71717a;transition:all .15s}
.note-type-btn.active{color:#fff}
.note-type-btn[data-type="instruction"].active{background:rgba(251,191,36,.2);border-color:#fbbf24;color:#fbbf24}
.note-type-btn[data-type="checklist"].active{background:rgba(74,222,128,.2);border-color:#4ade80;color:#4ade80}
.note-type-btn[data-type="question"].active{background:rgba(167,139,250,.2);border-color:#a78bfa;color:#a78bfa}
.note-type-btn[data-type="description"].active{background:rgba(96,165,250,.2);border-color:#60a5fa;color:#60a5fa}
.note-type-btn[data-type="general"].active{background:rgba(52,211,153,.2);border-color:#34d399;color:#34d399}
.note-textarea{width:100%;background:#09090b;border:1px solid #21262d;color:#c9d1d9;padding:10px 12px;border-radius:8px;font-size:13px;resize:vertical;min-height:70px;outline:none;box-sizing:border-box;transition:border-color .15s}
.note-textarea:focus{border-color:#fbbf24}
.note-textarea::placeholder{color:#3f3f46}
.note-checklist-input{width:100%;background:#09090b;border:1px solid #21262d;color:#c9d1d9;padding:8px 10px;border-radius:6px;font-size:12px;box-sizing:border-box;margin-bottom:6px}
.note-checklist-input:focus{outline:none;border-color:#fbbf24}
.note-hint{font-size:11px;color:#3f3f46;margin-top:4px;margin-bottom:8px}
</style>

<?php
$creatorChecklist = json_decode($task['review_checklist'] ?? '[]', true) ?: [];
$requiredEvidence = json_decode($task['required_evidence'] ?? '[]', true) ?: [];
$requiredFiles = json_decode($task['required_files'] ?? '[]', true) ?: [];
?>

<?php if (!empty($task['review_instructions']) || !empty($creatorChecklist) || !empty($requiredEvidence) || !empty($requiredFiles)): ?>
<div style="background:rgba(96,165,250,.06);border:1px solid rgba(96,165,250,.2);border-radius:10px;padding:14px 16px;margin-bottom:14px">
    <div style="font-size:12px;font-weight:700;color:#60a5fa;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Creator-defined Review Specification</div>
    <?php if (!empty($task['review_instructions'])): ?>
    <div style="margin-bottom:10px">
        <div style="font-size:11px;color:#71717a;text-transform:uppercase;margin-bottom:4px">Review Instructions</div>
        <div style="font-size:13px;color:#c9d1d9;line-height:1.6"><?= nl2br(e($task['review_instructions'])) ?></div>
    </div>
    <?php endif; ?>
    <?php if (!empty($creatorChecklist)): ?>
    <div style="margin-bottom:10px">
        <div style="font-size:11px;color:#71717a;text-transform:uppercase;margin-bottom:6px">Review Checklist</div>
        <?php foreach ($creatorChecklist as $item): ?>
            <div class="rn-checklist-item"><span>☐</span><span><?= e($item['text'] ?? '') ?></span></div>
        <?php endforeach; ?>
    </div>
    <?php endif; ?>
    <?php if (!empty($requiredEvidence)): ?>
    <div style="margin-bottom:10px">
        <div style="font-size:11px;color:#71717a;text-transform:uppercase;margin-bottom:6px">Required Evidence</div>
        <?php foreach ($requiredEvidence as $evidence): ?>
            <div class="rn-checklist-item"><span>📎</span><span><?= e($evidence['text'] ?? $evidence) ?></span></div>
        <?php endforeach; ?>
    </div>
    <?php endif; ?>
</div>
<?php endif; ?>

<?php if (!empty($pendingCount)): ?>
<div style="background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.25);border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
    <span style="font-size:16px">🔔</span>
    <div style="font-size:12px;color:#fbbf24">
        <strong><?= (int)$pendingCount ?> pending reviewer instruction(s)</strong> — please acknowledge when completed.
    </div>
</div>
<?php endif; ?>

<!-- Reviewer Notes List -->
<?php if (empty($reviewerNotes)): ?>
<div style="text-align:center;padding:24px 0;color:#3f3f46">
    <div style="font-size:2rem;margin-bottom:8px">📋</div>
    <div style="font-size:13px">No reviewer notes yet.</div>
    <?php if (!empty($canAddReviewerNote)): ?>
    <div style="font-size:12px;margin-top:4px">Add instructions below to guide the assignee.</div>
    <?php endif; ?>
</div>
<?php else: ?>
<?php foreach ($reviewerNotes as $note):
    $cfg = $noteTypeConfig[$note['note_type']] ?? $noteTypeConfig['general'];
    $checklist = json_decode($note['checklist_items'] ?? '[]', true) ?: [];
    $isDone = !empty($note['is_completed']);
    $isAck = !empty($note['is_acknowledged']);
?>
<div class="rn-card <?= $isDone ? 'done' : 'pending' ?>">
    <div class="rn-header">
        <span class="rn-badge" style="background:<?= $cfg['bg'] ?>;color:<?= $cfg['color'] ?>">
            <?= tf_icon($cfg['icon'], 12) ?> <?= e($cfg['label']) ?>
        </span>
        <?php if ($isAck): ?>
        <span class="rn-ack-badge">✓ Acknowledged by <?= e($note['acknowledged_by_name'] ?? 'assignee') ?></span>
        <?php endif; ?>
        <span class="rn-time" style="margin-left:auto"><?= timeAgo($note['created_at']) ?></span>
    </div>

    <?php if (!empty($note['title'])): ?>
    <div class="rn-title"><?= e($note['title']) ?></div>
    <?php endif; ?>

    <?php if (!empty($note['content'])): ?>
    <div class="rn-body"><?= nl2br(e($note['content'])) ?></div>
    <?php endif; ?>

    <!-- Checklist -->
    <?php if (!empty($checklist)): ?>
    <div style="margin-top:10px">
        <?php foreach ($checklist as $i => $item):
            $done = !empty($item['done']);
        ?>
        <div class="rn-checklist-item <?= $done ? 'done' : '' ?>" id="rn-check-<?= (int)$note['id'] ?>-<?= $i ?>">
            <input type="checkbox" <?= $done ? 'checked' : '' ?>
                   style="accent-color:<?= $cfg['color'] ?>;width:14px;height:14px;flex-shrink:0;cursor:<?= $isDone ? 'default' : 'pointer' ?>"
                   onchange="toggleReviewerNoteChecklist(<?= (int)$note['id'] ?>, <?= $i ?>, this.checked)"
                   <?= $isDone ? 'disabled' : '' ?>>
            <span><?= e($item['text'] ?? '') ?></span>
        </div>
        <?php endforeach; ?>
    </div>
    <?php endif; ?>

    <div class="rn-meta">
        <span class="rn-avatar"><?= strtoupper(mb_substr($note['reviewer_name'] ?? 'R', 0, 1)) ?></span>
        <span style="font-size:11px;color:#6e7681"><?= e($note['reviewer_name'] ?? '') ?></span>
    </div>

    <?php if (!$isAck): ?>
    <div class="rn-actions">
        <?php if (!empty($canAcknowledgeNote)): ?>
        <button class="btn btn-sm" style="background:rgba(74,222,128,.15);border:1px solid rgba(74,222,128,.4);color:#4ade80;font-size:11px;padding:4px 10px;border-radius:6px;cursor:pointer"
                onclick="acknowledgeNote(<?= (int)$note['id'] ?>)">
            ✓ Acknowledge
        </button>
        <?php endif; ?>
        <?php if ((int)$note['user_id'] === $currentUid || canAdmin()): ?>
        <button class="btn btn-sm btn-ghost" style="font-size:11px;color:#484f58;cursor:pointer"
                onclick="deleteReviewerNote(<?= (int)$note['id'] ?>)">
            <?= tf_icon('trash-2', 12) ?>
        </button>
        <?php endif; ?>
    </div>
    <?php endif; ?>
</div>
<?php endforeach; ?>
<?php endif; ?>

<!-- Add Note Form -->
<?php if (!empty($canAddReviewerNote)): ?>
<div class="add-note-card">
    <div style="font-size:12px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">
        Add Reviewer Note
    </div>

    <div class="add-note-type">
        <button type="button" class="note-type-btn active" data-type="instruction" onclick="selectNoteType(this)">📋 Instruction</button>
        <button type="button" class="note-type-btn" data-type="checklist" onclick="selectNoteType(this)">☑️ Checklist</button>
        <button type="button" class="note-type-btn" data-type="question" onclick="selectNoteType(this)">❓ Question</button>
        <button type="button" class="note-type-btn" data-type="description" onclick="selectNoteType(this)">📄 Description</button>
        <button type="button" class="note-type-btn" data-type="general" onclick="selectNoteType(this)">💬 Note</button>
    </div>

    <form method="POST" action="<?= APP_URL ?>/tasks/<?= (int)$task['id'] ?>/reviewer-notes" onsubmit="return handleReviewerNoteSubmit()">
        <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
        <input type="hidden" name="note_type" id="selectedNoteType" value="instruction">
        <input type="hidden" name="title" id="noteTitle" value="">

        <input type="text" name="title_input" id="noteTitleInput"
               class="note-textarea" placeholder="Short title (optional)"
               style="margin-bottom:8px">

        <textarea name="content" id="noteContent" class="note-textarea"
                  placeholder="Describe what the assignee needs to do…"
                  rows="3" required></textarea>

        <div id="checklistSection" style="display:none;margin-top:8px">
            <textarea name="checklist" id="noteChecklist" class="note-checklist-input"
                      placeholder="Checklist items (one per line)…" rows="4"></textarea>
        </div>

        <div class="note-hint" id="noteHint">Type your instructions for the assignee.</div>

        <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
            <span style="font-size:11px;color:#3f3f46">@mention users to notify them</span>
            <button type="submit" class="btn btn-primary btn-sm" style="margin-left:auto">
                <?= tf_icon('plus', 14) ?> Add Note
            </button>
        </div>
    </form>
</div>
<?php endif; ?>

<script>
function selectNoteType(btn) {
    document.querySelectorAll('.note-type-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    var type = btn.dataset.type;
    document.getElementById('selectedNoteType').value = type;
    var hint = document.getElementById('noteHint');
    var checklist = document.getElementById('checklistSection');
    var contentPlaceholder = document.getElementById('noteContent');
    if (type === 'checklist') {
        checklist.style.display = 'block';
        hint.textContent = 'Enter checklist items below, one per line.';
        contentPlaceholder.placeholder = 'Checklist description (optional)…';
    } else if (type === 'question') {
        checklist.style.display = 'none';
        hint.textContent = 'Ask a specific question the assignee needs to answer.';
        contentPlaceholder.placeholder = 'What information do you need?…';
    } else if (type === 'description') {
        checklist.style.display = 'none';
        hint.textContent = 'Describe background or context for this task.';
        contentPlaceholder.placeholder = 'Description…';
    } else {
        checklist.style.display = 'none';
        hint.textContent = 'Instructions for the assignee.';
        contentPlaceholder.placeholder = 'What needs to be done?…';
    }
}

function handleReviewerNoteSubmit() {
    var title = document.getElementById('noteTitleInput').value.trim();
    document.getElementById('noteTitle').value = title;
    var content = document.getElementById('noteContent').value.trim();
    if (!content) {
        alert('Please enter note content.');
        return false;
    }
    return true;
}

function toggleReviewerNoteChecklist(noteId, itemIndex, done) {
    var fd = new FormData();
    fd.append('index', itemIndex);
    fd.append('done', done ? '1' : '0');
    fetch('<?= APP_URL ?>/tasks/<?= (int)$task['id'] ?>/reviewer-notes/' + noteId + '/checklist-item', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin'
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d.success) {
            var item = document.getElementById('rn-check-' + noteId + '-' + itemIndex);
            if (item) {
                if (done) item.classList.add('done');
                else item.classList.remove('done');
            }
        }
    })
    .catch(function() {});
}

function acknowledgeNote(noteId) {
    var fd = new FormData();
    fetch('<?= APP_URL ?>/tasks/<?= (int)$task['id'] ?>/reviewer-notes/' + noteId + '/acknowledge', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin'
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d.success) location.reload();
    })
    .catch(function() {});
}

function deleteReviewerNote(noteId) {
    if (!confirm('Delete this reviewer note?')) return;
    fetch('<?= APP_URL ?>/reviewer-notes/' + noteId, {
        method: 'DELETE',
        credentials: 'same-origin'
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d.success) location.reload();
    })
    .catch(function() {});
}
</script>
