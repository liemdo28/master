<?php $pageTitle = 'Organizational Memory';  ?>
<div style="max-width: 1200px; margin: 0 auto; padding: 20px;">
    <h1 style="font-size: 28px; margin-bottom: 24px;">🧠 Organizational Memory</h1>
    <a href="/admin/command-center" class="btn">← Back</a>
    
    <form style="margin: 24px 0;">
        <input type="text" name="q" placeholder="Search memories..." value="<?= htmlspecialchars($_GET['q'] ?? '') ?>" style="width: 300px; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;">
        <button type="submit" class="btn-primary">Search</button>
    </form>

    <?php if (empty($memories)): ?>
    <p style="color: #6b7280;">No memories found.</p>
    <?php else: ?>
    <?php foreach ($memories as $m): ?>
    <div class="mem-card">
        <div style="display: flex; justify-content: space-between;">
            <strong><?= htmlspecialchars($m['title']) ?></strong>
            <span style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px; font-size: 12px;"><?= $m['memory_type'] ?></span>
        </div>
        <p style="color: #4b5563; margin: 8px 0;"><?= nl2br(htmlspecialchars(substr($m['content'], 0, 300))) ?></p>
        <div style="font-size: 12px; color: #9ca3af;"><?= timeAgo($m['created_at']) ?></div>
    </div>
    <?php endforeach; ?>
    <?php endif; ?>
</div>
<style>
.mem-card { background: white; border-radius: 8px; padding: 16px; border: 1px solid #e5e7eb; margin-bottom: 12px; }
.btn { background: #f3f4f6; color: #374151; padding: 8px 16px; border-radius: 6px; text-decoration: none; }
.btn-primary { background: #3b82f6; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; }
</style>
