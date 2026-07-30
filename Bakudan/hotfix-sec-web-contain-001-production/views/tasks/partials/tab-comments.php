<?php
/**
 * Tab: Comments — Rich comment thread with @mentions
 * Variables: $taskComments, $task, $canEditTask, $projectMembers
 */
$currentUid = (int)($_SESSION['user_id'] ?? 0);

$commentTypeIcons = [
    'comment'     => ['icon' => 'hash',      'color' => '#60a5fa', 'bg' => 'rgba(96,165,250,.12)', 'label' => 'Comment'],
    'instruction' => ['icon' => 'bookmark', 'color' => '#fbbf24', 'bg' => 'rgba(251,191,36,.12)', 'label' => 'Instruction'],
    'question'    => ['icon' => 'help-circle','color' => '#a78bfa','bg' => 'rgba(167,139,250,.12)','label' => 'Question'],
    'checklist'   => ['icon' => 'check-square','color' => '#4ade80','bg' => 'rgba(74,222,128,.12)','label' => 'Checklist'],
    'note'        => ['icon' => 'file-text','color' => '#34d399','bg' => 'rgba(52,211,153,.12)','label' => 'Note'],
];
?>

<style>
.comment-thread{margin-bottom:16px}
.comment-thread:last-child{margin-bottom:0}
.comment-header{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.comment-avatar{width:32px;height:32px;border-radius:50%;background:rgba(96,165,250,.2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#60a5fa;flex-shrink:0;text-transform:uppercase}
.comment-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.comment-author{font-size:13px;font-weight:700;color:#e4e4e7}
.comment-role{font-size:10px;padding:2px 6px;border-radius:4px;font-weight:700;text-transform:uppercase;background:rgba(255,255,255,.06);color:#71717a}
.comment-type-badge{font-size:10px;padding:2px 7px;border-radius:4px;font-weight:700}
.comment-time{font-size:11px;color:#52525b;margin-left:auto}
.comment-body{font-size:13px;color:#c9d1d9;line-height:1.6;padding:8px 12px;background:rgba(255,255,255,.03);border-radius:8px;border:1px solid rgba(255,255,255,.06);margin-bottom:6px}
.comment-body .mention-chip{background:rgba(52,211,153,.15);color:#34d399;padding:1px 6px;border-radius:10px;font-size:11px;font-weight:700}
.comment-actions{display:flex;gap:8px;padding-left:4px}
.comment-action-btn{font-size:11px;color:#52525b;cursor:pointer;background:none;border:none;padding:2px 4px;border-radius:4px;transition:color .1s}
.comment-action-btn:hover{color:#71717a;background:rgba(255,255,255,.05)}
.comment-edited{font-size:10px;color:#3f3f46;margin-left:4px;font-style:italic}

/* Replies */
.comment-replies{margin-left:28px;border-left:2px solid rgba(255,255,255,.06);padding-left:12px;margin-top:6px}
.reply-item{display:flex;align-items:flex-start;gap:8px;margin-bottom:6px}
.reply-avatar{width:24px;height:24px;border-radius:50%;background:rgba(167,139,250,.2);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#a78bfa;flex-shrink:0;text-transform:uppercase}
.reply-body{font-size:12px;color:#c9d1d9;line-height:1.5;flex:1}
.reply-input-wrap{display:flex;gap:6px;margin-top:8px;margin-left:28px}
.reply-input-wrap input{flex:1;background:#0d1117;border:1px solid #21262d;color:#c9d1d9;padding:6px 10px;border-radius:6px;font-size:12px}
.reply-input-wrap input:focus{outline:none;border-color:#3b82f6}

/* Comment form */
.comment-form-wrapper{margin-top:16px;padding-top:16px;border-top:1px solid #21262d}
.comment-type-selector{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}
.type-chip{padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid #30363d;background:transparent;color:#71717a;transition:all .15s}
.type-chip.active{color:#fff}
.type-chip[data-type="comment"].active{background:rgba(96,165,250,.2);border-color:#60a5fa;color:#60a5fa}
.type-chip[data-type="instruction"].active{background:rgba(251,191,36,.2);border-color:#fbbf24;color:#fbbf24}
.type-chip[data-type="question"].active{background:rgba(167,139,250,.2);border-color:#a78bfa;color:#a78bfa}
.type-chip[data-type="checklist"].active{background:rgba(74,222,128,.2);border-color:#4ade80;color:#4ade80}
.type-chip[data-type="note"].active{background:rgba(52,211,153,.2);border-color:#34d399;color:#34d399}

.comment-textarea{width:100%;background:#0d1117;border:1px solid #30363d;color:#c9d1d9;padding:10px 12px;border-radius:8px;font-size:13px;resize:vertical;min-height:80px;outline:none;box-sizing:border-box;transition:border-color .15s}
.comment-textarea:focus{border-color:#3b82f6}
.comment-textarea::placeholder{color:#3f3f46}

.comment-form-footer{display:flex;justify-content:space-between;align-items:center;margin-top:8px}
.mention-hint{font-size:11px;color:#3f3f46}

/* Mention autocomplete */
.mention-dropdown{position:absolute;background:#18181b;border:1px solid #30363d;border-radius:8px;max-height:200px;overflow-y:auto;z-index:100;min-width:200px;box-shadow:0 8px 24px rgba(0,0,0,.4);display:none}
.mention-dropdown.show{display:block}
.mention-item{display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;border-bottom:1px solid #21262d}
.mention-item:last-child{border-bottom:none}
.mention-item:hover{background:rgba(59,130,246,.1)}
.mention-item-avatar{width:24px;height:24px;border-radius:50%;background:rgba(96,165,250,.2);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#60a5fa;flex-shrink:0}
.mention-item-name{font-size:12px;font-weight:600;color:#e4e4e7}
.mention-item-role{font-size:10px;color:#52525b}

.comment-form-wrap{position:relative}
</style>

<!-- Comment Threads -->
<div id="commentList">
    <?php if (empty($taskComments)): ?>
    <div style="text-align:center;padding:24px 0;color:#3f3f46">
        <div style="font-size:2rem;margin-bottom:8px">💬</div>
        <div style="font-size:13px">No comments yet. Be the first to comment.</div>
    </div>
    <?php else: ?>
        <?php foreach ($taskComments as $comment):
            $ct = $commentTypeIcons[$comment['comment_type']] ?? $commentTypeIcons['comment'];
            $isOwner = (int)$comment['user_id'] === $currentUid;
            $replies = !empty($comment['replies']) ? $comment['replies'] : [];
        ?>
        <div class="comment-thread" id="comment-<?= (int)$comment['id'] ?>">
            <div class="comment-header">
                <div class="comment-avatar" style="background:<?= $ct['bg'] ?>;color:<?= $ct['color'] ?>">
                    <?= strtoupper(mb_substr($comment['user_name'], 0, 1)) ?>
                </div>
                <div class="comment-meta">
                    <span class="comment-author"><?= e($comment['user_name']) ?></span>
                    <?php if (!empty($comment['user_role'])): ?>
                    <span class="comment-role"><?= e(ucfirst($comment['user_role'])) ?></span>
                    <?php endif; ?>
                    <span class="comment-type-badge" style="background:<?= $ct['bg'] ?>;color:<?= $ct['color'] ?>">
                        <?= tf_icon($ct['icon'], 11) ?> <?= e($ct['label']) ?>
                    </span>
                    <span class="comment-time"><?= timeAgo($comment['created_at']) ?></span>
                    <?php if ($comment['is_edited']): ?>
                    <span class="comment-edited">(edited)</span>
                    <?php endif; ?>
                </div>
            </div>

            <div class="comment-body">
                <?= $comment['content_html'] ?? nl2br(e($comment['content'])) ?>
            </div>

            <div class="comment-actions">
                <?php if ($canEditTask): ?>
                <button class="comment-action-btn" onclick="showReplyForm(<?= (int)$comment['id'] ?>)"><?= tf_icon('corner-down-right', 12) ?> Reply</button>
                <?php endif; ?>
                <?php if ($isOwner || canAdmin()): ?>
                <button class="comment-action-btn" onclick="deleteComment(<?= (int)$comment['id'] ?>)"><?= tf_icon('trash-2', 12) ?></button>
                <?php endif; ?>
            </div>

            <!-- Reply form -->
            <?php if ($canEditTask): ?>
            <div id="replyForm-<?= (int)$comment['id'] ?>" class="reply-input-wrap" style="display:none">
                <input type="text" id="replyInput-<?= (int)$comment['id'] ?>" placeholder="Write a reply…" onkeydown="if(event.key==='Enter')submitReply(<?= (int)$comment['id'] ?>)">
                <button class="btn btn-primary btn-sm" onclick="submitReply(<?= (int)$comment['id'] ?>)">Send</button>
            </div>
            <?php endif; ?>

            <!-- Replies -->
            <?php if (!empty($replies)): ?>
            <div class="comment-replies">
                <?php foreach ($replies as $reply):
                    $ct2 = $commentTypeIcons[$reply['comment_type']] ?? $commentTypeIcons['comment'];
                ?>
                <div class="reply-item">
                    <div class="reply-avatar"><?= strtoupper(mb_substr($reply['user_name'], 0, 1)) ?></div>
                    <div class="reply-body">
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
                            <span style="font-size:12px;font-weight:700;color:#c9d1d9"><?= e($reply['user_name']) ?></span>
                            <span style="font-size:10px;color:#3f3f46"><?= timeAgo($reply['created_at']) ?></span>
                        </div>
                        <?= $reply['content_html'] ?? nl2br(e($reply['content'])) ?>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>
        </div>
        <?php endforeach; ?>
    <?php endif; ?>
</div>

<!-- Comment Input Form -->
<div class="comment-form-wrapper">
    <div style="font-size:12px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">
        Add Comment
    </div>

    <div class="comment-type-selector">
        <button type="button" class="type-chip active" data-type="comment" onclick="selectCommentType(this)">💬 Comment</button>
        <button type="button" class="type-chip" data-type="instruction" onclick="selectCommentType(this)">📋 Instruction</button>
        <button type="button" class="type-chip" data-type="question" onclick="selectCommentType(this)">❓ Question</button>
        <button type="button" class="type-chip" data-type="checklist" onclick="selectCommentType(this)">☑️ Checklist</button>
        <button type="button" class="type-chip" data-type="note" onclick="selectCommentType(this)">📝 Note</button>
    </div>

    <form id="commentForm" method="POST" action="<?= APP_URL ?>/tasks/<?= (int)$task['id'] ?>/task-comments" onsubmit="return handleCommentSubmit(event)">
        <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
        <input type="hidden" name="comment_type" id="selectedCommentType" value="comment">
        <input type="hidden" name="parent_id" id="parentCommentId" value="">

        <div class="comment-form-wrap">
            <textarea
                name="content"
                id="commentContent"
                class="comment-textarea"
                placeholder="Write a comment… Use @username or @Full Name to mention someone"
                rows="3"
                oninput="handleCommentInput(this)"
                onkeydown="if(event.key==='@')showMentionDropdown(event)"
            ></textarea>

            <div id="mentionDropdown" class="mention-dropdown"></div>
        </div>

        <div class="comment-form-footer">
            <span class="mention-hint">Type @ to mention someone</span>
            <button type="submit" class="btn btn-primary btn-sm" id="commentSubmitBtn">
                <?= tf_icon('send', 14) ?> Post Comment
            </button>
        </div>
    </form>
</div>

<script>
// ── Comment type selector ──────────────────────────────────────────────────
function selectCommentType(btn) {
    document.querySelectorAll('.type-chip').forEach(function(c) { c.classList.remove('active'); });
    btn.classList.add('active');
    document.getElementById('selectedCommentType').value = btn.dataset.type;
}

// ── Reply form ────────────────────────────────────────────────────────────
function showReplyForm(commentId) {
    var el = document.getElementById('replyForm-' + commentId);
    if (el) {
        el.style.display = el.style.display === 'none' ? 'flex' : 'none';
        var inp = document.getElementById('replyInput-' + commentId);
        if (inp) inp.focus();
    }
}

function submitReply(commentId) {
    var inp = document.getElementById('replyInput-' + commentId);
    if (!inp || !inp.value.trim()) return;
    var fd = new FormData();
    fd.append('csrf', document.querySelector('[name=csrf]') ? document.querySelector('[name=csrf]').value : '');
    fd.append('content', inp.value.trim());
    fd.append('parent_id', commentId);
    fd.append('comment_type', 'comment');
    fetch('<?= APP_URL ?>/tasks/<?= (int)$task['id'] ?>/task-comments', {
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

// ── Delete comment ─────────────────────────────────────────────────────────
function deleteComment(id) {
    if (!confirm('Delete this comment?')) return;
    fetch('<?= APP_URL ?>/task-comments/' + id, {
        method: 'DELETE',
        credentials: 'same-origin'
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d.success) location.reload();
    })
    .catch(function() {});
}

// ── Mention autocomplete ──────────────────────────────────────────────────
var mentionSearchTimeout = null;
var mentionDropdownVisible = false;

function handleCommentInput(textarea) {
    var val = textarea.value;
    var pos = textarea.selectionStart;
    var textBefore = val.substring(0, pos);
    var atIndex = textBefore.lastIndexOf('@');
    if (atIndex === -1) {
        hideMentionDropdown();
        return;
    }
    var query = textBefore.substring(atIndex + 1);
    // If there's a space after @, close dropdown
    if (query.indexOf(' ') !== -1) {
        hideMentionDropdown();
        return;
    }
    clearTimeout(mentionSearchTimeout);
    mentionSearchTimeout = setTimeout(function() {
        searchMentionUsers(query, textarea);
    }, 200);
}

function searchMentionUsers(query, textarea) {
    if (!query || query.length < 1) {
        hideMentionDropdown();
        return;
    }
    fetch('<?= APP_URL ?>/api/users/mention-search?q=' + encodeURIComponent(query), {credentials: 'same-origin'})
        .then(function(r) { return r.json(); })
        .then(function(d) {
            renderMentionDropdown(d.users || [], textarea);
        })
        .catch(function() {});
}

function renderMentionDropdown(users, textarea) {
    var dd = document.getElementById('mentionDropdown');
    if (!users.length) {
        dd.classList.remove('show');
        return;
    }
    var html = '';
    users.forEach(function(u) {
        html += '<div class="mention-item" onclick="insertMention(\'' + u.name.replace(/'/g, "\\'") + '\', ' + u.id + ')">';
        html += '<div class="mention-item-avatar">' + u.name.charAt(0).toUpperCase() + '</div>';
        html += '<div><div class="mention-item-name">' + u.name + '</div>';
        html += '<div class="mention-item-role">' + (u.role || '') + '</div></div></div>';
    });
    dd.innerHTML = html;
    dd.classList.add('show');
    mentionDropdownVisible = true;
    // Position below textarea
    var rect = textarea.getBoundingClientRect();
    dd.style.left = rect.left + 'px';
    dd.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    dd.style.width = Math.min(rect.width, 300) + 'px';
}

function insertMention(name, userId) {
    var textarea = document.getElementById('commentContent');
    var val = textarea.value;
    var pos = textarea.selectionStart;
    var textBefore = val.substring(0, pos);
    var atIndex = textBefore.lastIndexOf('@');
    var newVal = val.substring(0, atIndex) + '@' + name + ' ' + val.substring(pos);
    textarea.value = newVal;
    textarea.focus();
    var newPos = atIndex + name.length + 2;
    textarea.setSelectionRange(newPos, newPos);
    hideMentionDropdown();
}

function hideMentionDropdown() {
    document.getElementById('mentionDropdown').classList.remove('show');
    mentionDropdownVisible = false;
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('.comment-form-wrap')) {
        hideMentionDropdown();
    }
});

// ── Form submit ────────────────────────────────────────────────────────────
function handleCommentSubmit(e) {
    var content = document.getElementById('commentContent').value.trim();
    if (!content) {
        e.preventDefault();
        return false;
    }
    return true;
}
</script>
