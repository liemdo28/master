<?php
/**
 * Admin Incidents - Show/Detail Page
 */
$pageTitle = 'Incident #' . $incident['id'];
$severityColors = [
    'critical' => 'bg-red-100 text-red-800 border-red-200',
    'high' => 'bg-orange-100 text-orange-800 border-orange-200',
    'medium' => 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'low' => 'bg-green-100 text-green-800 border-green-200'
];
$statusColors = [
    'open' => 'bg-gray-100 text-gray-800 border-gray-200',
    'acknowledged' => 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'investigating' => 'bg-blue-100 text-blue-800 border-blue-200',
    'resolved' => 'bg-green-100 text-green-800 border-green-200',
    'closed' => 'bg-purple-100 text-purple-800 border-purple-200',
    'cancelled' => 'bg-red-100 text-red-800 border-red-200'
];
?>

<div class="p-6">
    <!-- Breadcrumb -->
    <div class="mb-4">
        <a href="/admin/incidents" class="text-blue-600 hover:text-blue-800">&larr; Back to Incidents</a>
    </div>

    <!-- Header -->
    <div class="bg-white rounded-lg shadow mb-6 p-6">
        <div class="flex justify-between items-start">
            <div>
                <div class="flex items-center gap-3 mb-2">
                    <h1 class="text-2xl font-bold text-gray-900"><?= htmlspecialchars($incident['title']) ?></h1>
                    <span class="px-3 py-1 text-sm font-semibold rounded-full border <?= $severityColors[$incident['severity']] ?? '' ?>">
                        <?= ucfirst($incident['severity']) ?>
                    </span>
                    <span class="px-3 py-1 text-sm font-semibold rounded-full border <?= $statusColors[$incident['status']] ?? '' ?>">
                        <?= ucfirst($incident['status']) ?>
                    </span>
                </div>
                <div class="text-sm text-gray-500">
                    Incident #<?= $incident['id'] ?> &bull; 
                    Created <?= date('M d, Y \a\t H:i', strtotime($incident['created_at'])) ?>
                    <?php if ($incident['store_name']): ?>
                        &bull; Store: <?= htmlspecialchars($incident['store_name']) ?>
                    <?php endif; ?>
                </div>
            </div>
            <div class="flex gap-2">
                <?php if ($incident['status'] === 'open'): ?>
                    <a href="/admin/incidents/<?= $incident['id'] ?>/acknowledge" 
                       class="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600">
                        Acknowledge
                    </a>
                <?php elseif ($incident['status'] === 'acknowledged'): ?>
                    <a href="/admin/incidents/<?= $incident['id'] ?>/investigate" 
                       class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                        Start Investigation
                    </a>
                <?php elseif ($incident['status'] === 'investigating'): ?>
                    <button onclick="showResolveModal()" 
                            class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
                        Resolve
                    </button>
                <?php elseif ($incident['status'] === 'resolved'): ?>
                    <a href="/admin/incidents/<?= $incident['id'] ?>/close" 
                       class="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600">
                        Close Incident
                    </a>
                <?php endif; ?>
                <?php if (!in_array($incident['status'], ['closed', 'cancelled'])): ?>
                    <button onclick="showEscalateModal()" 
                            class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
                        Escalate
                    </button>
                <?php endif; ?>
            </div>
        </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Main Content -->
        <div class="lg:col-span-2 space-y-6">
            <!-- Description -->
            <div class="bg-white rounded-lg shadow p-6">
                <h2 class="text-lg font-semibold text-gray-900 mb-4">Description</h2>
                <div class="prose max-w-none text-gray-700">
                    <?= nl2br(htmlspecialchars($incident['description'] ?? 'No description provided')) ?>
                </div>
            </div>

            <!-- Resolution Details -->
            <?php if ($incident['status'] === 'resolved' || $incident['status'] === 'closed'): ?>
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-lg font-semibold text-gray-900 mb-4">Resolution</h2>
                    <?php if ($incident['root_cause']): ?>
                        <div class="mb-4">
                            <div class="text-sm font-medium text-gray-500 mb-1">Root Cause</div>
                            <div class="text-gray-700"><?= nl2br(htmlspecialchars($incident['root_cause'])) ?></div>
                        </div>
                    <?php endif; ?>
                    <?php if ($incident['corrective_action']): ?>
                        <div class="mb-4">
                            <div class="text-sm font-medium text-gray-500 mb-1">Corrective Action</div>
                            <div class="text-gray-700"><?= nl2br(htmlspecialchars($incident['corrective_action'])) ?></div>
                        </div>
                    <?php endif; ?>
                    <?php if ($incident['resolved_at']): ?>
                        <div class="text-sm text-gray-500">
                            Resolved on <?= date('M d, Y \a\t H:i', strtotime($incident['resolved_at'])) ?>
                        </div>
                    <?php endif; ?>
                </div>
            <?php endif; ?>

            <!-- Timeline -->
            <div class="bg-white rounded-lg shadow p-6">
                <h2 class="text-lg font-semibold text-gray-900 mb-4">Activity Timeline</h2>
                
                <!-- Add Comment Form -->
                <?php if (!in_array($incident['status'], ['closed', 'cancelled'])): ?>
                    <form action="/admin/incidents/<?= $incident['id'] ?>/comment" method="POST" class="mb-6">
                        <div class="flex gap-2">
                            <textarea name="comment" placeholder="Add a comment..." rows="2" 
                                      class="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"></textarea>
                            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                Post
                            </button>
                        </div>
                    </form>
                <?php endif; ?>

                <!-- Timeline Events -->
                <div class="space-y-4">
                    <?php foreach ($timeline as $event): ?>
                        <div class="flex gap-3">
                            <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                <?php
                                $actionIcons = [
                                    'created' => '📝',
                                    'status_change' => '🔄',
                                    'assigned' => '👤',
                                    'escalated' => '⬆️',
                                    'resolved' => '✅',
                                    'closed' => '🔒',
                                    'cancelled' => '❌',
                                    'comment' => '💬'
                                ];
                                echo $actionIcons[$event['action']] ?? '📌';
                                ?>
                            </div>
                            <div class="flex-1">
                                <div class="flex items-center gap-2">
                                    <span class="font-medium text-gray-900">
                                        <?= htmlspecialchars($event['user_name'] ?? 'System') ?>
                                    </span>
                                    <span class="text-sm text-gray-500">
                                        <?= date('M d, Y \a\t H:i', strtotime($event['created_at'])) ?>
                                    </span>
                                </div>
                                <div class="text-gray-700 mt-1"><?= htmlspecialchars($event['description']) ?></div>
                                <?php if ($event['metadata']): ?>
                                    <?php $meta = json_decode($event['metadata'], true); ?>
                                    <?php if ($meta && isset($meta['previous_status'], $meta['new_status'])): ?>
                                        <div class="text-sm text-gray-500 mt-1">
                                            <?= ucfirst($meta['previous_status']) ?> → <?= ucfirst($meta['new_status']) ?>
                                        </div>
                                    <?php endif; ?>
                                <?php endif; ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>

        <!-- Sidebar -->
        <div class="space-y-6">
            <!-- Details -->
            <div class="bg-white rounded-lg shadow p-6">
                <h2 class="text-lg font-semibold text-gray-900 mb-4">Details</h2>
                
                <div class="space-y-4">
                    <div>
                        <div class="text-sm font-medium text-gray-500">Reported By</div>
                        <div class="text-gray-900"><?= htmlspecialchars($incident['reported_by_name'] ?? 'Unknown') ?></div>
                    </div>
                    
                    <div>
                        <div class="text-sm font-medium text-gray-500">Assigned To</div>
                        <div>
                            <?php if ($incident['assigned_to']): ?>
                                <span class="text-gray-900"><?= htmlspecialchars($incident['assigned_to_name'] ?? 'Unknown') ?></span>
                                <?php if (!in_array($incident['status'], ['closed', 'cancelled'])): ?>
                                    <form action="/admin/incidents/<?= $incident['id'] ?>/assign" method="POST" class="mt-1">
                                        <select name="assign_to" class="w-full text-sm border rounded px-2 py-1">
                                            <option value="">Reassign...</option>
                                            <?php foreach ($users as $user): ?>
                                                <option value="<?= $user['id'] ?>"><?= htmlspecialchars($user['name']) ?></option>
                                            <?php endforeach; ?>
                                        </select>
                                    </form>
                                <?php endif; ?>
                            <?php else: ?>
                                <span class="text-gray-500">Unassigned</span>
                            <?php endif; ?>
                        </div>
                    </div>

                    <?php if ($incident['category']): ?>
                        <div>
                            <div class="text-sm font-medium text-gray-500">Category</div>
                            <div class="text-gray-900"><?= htmlspecialchars($incident['category']) ?></div>
                        </div>
                    <?php endif; ?>

                    <?php if ($incident['impact']): ?>
                        <div>
                            <div class="text-sm font-medium text-gray-500">Impact</div>
                            <div class="text-gray-900"><?= htmlspecialchars($incident['impact']) ?></div>
                        </div>
                    <?php endif; ?>

                    <div>
                        <div class="text-sm font-medium text-gray-500">Escalation Level</div>
                        <div class="text-gray-900"><?= $incident['escalation_level'] ?: 'None' ?></div>
                    </div>

                    <?php if ($incident['resolved_at']): ?>
                        <div>
                            <div class="text-sm font-medium text-gray-500">Resolution Time</div>
                            <?php
                            $created = new DateTime($incident['created_at']);
                            $resolved = new DateTime($incident['resolved_at']);
                            $diff = $created->diff($resolved);
                            ?>
                            <div class="text-gray-900">
                                <?= $diff->days ?>d <?= $diff->h ?>h <?= $diff->i ?>m
                            </div>
                        </div>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Attachments -->
            <div class="bg-white rounded-lg shadow p-6">
                <h2 class="text-lg font-semibold text-gray-900 mb-4">Attachments</h2>
                
                <?php if (!empty($attachments)): ?>
                    <div class="space-y-2 mb-4">
                        <?php foreach ($attachments as $attachment): ?>
                            <a href="<?= htmlspecialchars($attachment['filepath']) ?>" 
                               class="flex items-center gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100"
                               target="_blank">
                                📎 <?= htmlspecialchars($attachment['filename']) ?>
                            </a>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>

                <form action="/admin/incidents/<?= $incident['id'] ?>/update" method="POST" enctype="multipart/form-data">
                    <input type="file" name="attachments[]" multiple class="w-full text-sm border rounded p-2 mb-2">
                    <button type="submit" class="w-full px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm">
                        Upload
                    </button>
                </form>
            </div>

            <!-- Edit Form -->
            <div class="bg-white rounded-lg shadow p-6">
                <h2 class="text-lg font-semibold text-gray-900 mb-4">Edit Incident</h2>
                <form action="/admin/incidents/<?= $incident['id'] ?>/update" method="POST">
                    <div class="space-y-3">
                        <div>
                            <label class="text-sm font-medium text-gray-700">Severity</label>
                            <select name="severity" class="w-full mt-1 px-3 py-2 border rounded-lg">
                                <option value="low" <?= $incident['severity'] === 'low' ? 'selected' : '' ?>>Low</option>
                                <option value="medium" <?= $incident['severity'] === 'medium' ? 'selected' : '' ?>>Medium</option>
                                <option value="high" <?= $incident['severity'] === 'high' ? 'selected' : '' ?>>High</option>
                                <option value="critical" <?= $incident['severity'] === 'critical' ? 'selected' : '' ?>>Critical</option>
                            </select>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-700">Store</label>
                            <select name="store_id" class="w-full mt-1 px-3 py-2 border rounded-lg">
                                <option value="">No Store</option>
                                <?php foreach ($stores as $store): ?>
                                    <option value="<?= $store['id'] ?>" <?= $incident['store_id'] == $store['id'] ? 'selected' : '' ?>>
                                        <?= htmlspecialchars($store['name']) ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <button type="submit" class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            Update
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>

<!-- Resolve Modal -->
<div id="resolveModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Resolve Incident</h3>
        <form action="/admin/incidents/<?= $incident['id'] ?>/resolve" method="POST">
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700">Root Cause</label>
                    <textarea name="root_cause" rows="3" class="w-full mt-1 px-3 py-2 border rounded-lg"></textarea>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Corrective Action</label>
                    <textarea name="corrective_action" rows="3" class="w-full mt-1 px-3 py-2 border rounded-lg"></textarea>
                </div>
            </div>
            <div class="flex justify-end gap-2 mt-6">
                <button type="button" onclick="hideResolveModal()" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                    Cancel
                </button>
                <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    Resolve
                </button>
            </div>
        </form>
    </div>
</div>

<!-- Escalate Modal -->
<div id="escalateModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Escalate Incident</h3>
        <form action="/admin/incidents/<?= $incident['id'] ?>/escalate" method="POST">
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700">Escalation Level</label>
                    <select name="level" class="w-full mt-1 px-3 py-2 border rounded-lg">
                        <option value="1">Level 1 - Manager</option>
                        <option value="2">Level 2 - Director</option>
                        <option value="3">Level 3 - Executive</option>
                        <option value="4">Level 4 - CEO</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Reason</label>
                    <textarea name="reason" rows="3" class="w-full mt-1 px-3 py-2 border rounded-lg"></textarea>
                </div>
            </div>
            <div class="flex justify-end gap-2 mt-6">
                <button type="button" onclick="hideEscalateModal()" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                    Cancel
                </button>
                <button type="submit" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                    Escalate
                </button>
            </div>
        </form>
    </div>
</div>

<script>
function showResolveModal() {
    document.getElementById('resolveModal').classList.remove('hidden');
}
function hideResolveModal() {
    document.getElementById('resolveModal').classList.add('hidden');
}
function showEscalateModal() {
    document.getElementById('escalateModal').classList.remove('hidden');
}
function hideEscalateModal() {
    document.getElementById('escalateModal').classList.add('hidden');
}
</script>
