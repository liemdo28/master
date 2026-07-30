<?php
// Release Timeline — visual timeline from audit log
// Must be included from a view that has $release available
$timeline = $timeline ?? [];
?>
<?php if (!empty($timeline)): ?>
<div class="rt-timeline">
    <?php foreach ($timeline as $i => $event): ?>
    <div class="rt-event">
        <div class="rt-dot" style="background:<?= e($event['color']) ?>;box-shadow:0 0 8px <?= e($event['color']) ?>40">
            <?= e($event['icon']) ?>
        </div>
        <?php if ($i < count($timeline) - 1): ?>
        <div class="rt-line" style="background:linear-gradient(to bottom,<?= e($event['color']) ?>60,<?= e($timeline[$i+1]['color']) ?>40)"></div>
        <?php endif; ?>
        <div class="rt-content">
            <div class="rt-label" style="color:<?= e($event['color']) ?>"><?= e($event['label']) ?></div>
            <div class="rt-meta">
                <span class="rt-user"><?= e($event['user']) ?></span>
                <span class="rt-time"><?= date('M j, Y g:i A', strtotime($event['time'])) ?></span>
            </div>
            <?php if (!empty($event['reason'])): ?>
            <div class="rt-reason">"<?= e($event['reason']) ?>"</div>
            <?php endif; ?>
        </div>
    </div>
    <?php endforeach; ?>
</div>
<?php else: ?>
<p style="color:#71717a;font-size:13px;text-align:center;padding:20px">No activity recorded yet.</p>
<?php endif; ?>
