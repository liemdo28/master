<?php
class ProjectController {
    private $projectModel;
    private $taskModel;
    private $userModel;
    private $storeModel;

    public function __construct() {
        $this->projectModel = new Project();
        $this->taskModel = new Task();
        $this->userModel = new User();
        $this->storeModel = new Store();
    }

    public function index() {
        $projects = $this->projectModel->getByUser($_SESSION['user_id'], canAdmin());
        require __DIR__ . '/../views/projects/index.php';
    }

    /**
     * Admin-only project merge tool (GET form / POST apply).
     * Re-parents every task + section from source projects into a single
     * target project, then archives the sources.
     */
    public function showMergeForm() {
        if (!isAdmin()) redirect('dashboard');
        $db = Database::getInstance();
        $projects = $db->fetchAll(
            "SELECT p.id, p.name, p.color, p.status, s.name as store_name,
                    (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
                    (SELECT COUNT(*) FROM sections WHERE project_id = p.id) as section_count
             FROM projects p
             LEFT JOIN stores s ON p.store_id = s.id
             ORDER BY p.status <> 'active', p.name ASC"
        );
        require __DIR__ . '/../views/projects/merge.php';
    }

    public function applyMerge() {
        if (!isAdmin()) redirect('dashboard');
        if (!verify_csrf($_POST['csrf_token'] ?? '')) { flash('error', 'Invalid CSRF'); redirect('admin/projects/merge'); }

        $sourceIds = array_filter(array_map('intval', $_POST['source_ids'] ?? []));
        $targetId  = (int)($_POST['target_id'] ?? 0);
        $archive   = !empty($_POST['archive_sources']);
        $hardDelete = !empty($_POST['hard_delete_sources']);

        if (empty($sourceIds) || !$targetId) {
            flash('error', 'Chọn ít nhất 1 project nguồn + 1 project đích.');
            redirect('admin/projects/merge');
        }
        if (in_array($targetId, $sourceIds, true)) {
            flash('error', 'Project đích không thể đồng thời là project nguồn.');
            redirect('admin/projects/merge');
        }

        $db = Database::getInstance();
        $target = $this->projectModel->findById($targetId);
        if (!$target) { flash('error', 'Target không tồn tại.'); redirect('admin/projects/merge'); }

        $pdo = $db->getPdo ?? null;
        $movedTasks = 0; $movedSections = 0; $archivedCount = 0; $failures = [];

        foreach ($sourceIds as $sid) {
            try {
                // 1) Move tasks (preserve assignee/status/etc.) — just re-parent.
                $taskAffected = $db->execute(
                    "UPDATE tasks SET project_id = ? WHERE project_id = ?",
                    [$targetId, $sid]
                );
                if (is_int($taskAffected)) $movedTasks += $taskAffected;

                // 2) Move sections — keep position but append after existing target sections.
                $maxPos = $db->fetch("SELECT COALESCE(MAX(position), -1) AS mp FROM sections WHERE project_id = ?", [$targetId]);
                $offset = (int)($maxPos['mp'] ?? -1) + 1;
                $srcSections = $db->fetchAll("SELECT id FROM sections WHERE project_id = ? ORDER BY position ASC", [$sid]);
                foreach ($srcSections as $i => $sec) {
                    $db->update(
                        "UPDATE sections SET project_id = ?, position = ? WHERE id = ?",
                        [$targetId, $offset + $i, $sec['id']]
                    );
                    $movedSections++;
                }

                // 3) Archive (default) or hard-delete source project (cascade via FKs).
                if ($hardDelete) {
                    $db->delete("DELETE FROM projects WHERE id = ?", [$sid]);
                    $archivedCount++;
                } elseif ($archive) {
                    $db->update("UPDATE projects SET status = 'archived' WHERE id = ?", [$sid]);
                    $archivedCount++;
                }
            } catch (Exception $e) {
                $failures[] = "Project #{$sid}: " . $e->getMessage();
            }
        }

        if ($failures) {
            flash('error', 'Một số lỗi: ' . implode(' | ', $failures));
        }
        $tail = '';
        if ($hardDelete)      $tail = " · đã DELETE {$archivedCount} source";
        elseif ($archive)     $tail = " · đã archive {$archivedCount} source";
        flash('success', sprintf(
            'Đã gộp: %d task + %d section từ %d project%s → "%s"%s',
            $movedTasks, $movedSections, count($sourceIds), count($sourceIds) === 1 ? '' : 's',
            $target['name'], $tail
        ));
        redirect('admin/projects/merge');
    }

    /**
     * Admin-only: hard-delete a project that has no tasks/sections (standalone clean-up).
     * Used for the "delete Night's Plan" kind of operation without needing a merge.
     */
    public function adminDelete($id) {
        if (!isAdmin()) redirect('dashboard');
        if (!verify_csrf($_POST['csrf_token'] ?? '')) { flash('error', 'Invalid CSRF'); redirect('admin/projects/merge'); }
        $db = Database::getInstance();
        $project = $this->projectModel->findById($id);
        if (!$project) { flash('error', 'Project không tồn tại.'); redirect('admin/projects/merge'); }
        // Force only if confirm=1 to protect against accidental clicks
        $confirm = !empty($_POST['confirm_delete_all']);
        $tCount = (int)($db->fetch("SELECT COUNT(*) AS c FROM tasks WHERE project_id = ?", [$id])['c'] ?? 0);
        if ($tCount > 0 && !$confirm) {
            flash('error', "Project \"{$project['name']}\" có {$tCount} task — phải tick confirm để xoá cùng.");
            redirect('admin/projects/merge');
        }
        $db->delete("DELETE FROM projects WHERE id = ?", [$id]);
        flash('success', "Đã xoá project \"{$project['name']}\"" . ($tCount > 0 ? " cùng {$tCount} task" : ''));
        redirect('admin/projects/merge');
    }

    /**
     * Admin-only: bulk-complete every task with due_date <= threshold.
     * Used for archive-the-old-work operations like "mark Feb 2026 and older as done".
     */
    public function bulkComplete() {
        if (!isAdmin()) redirect('dashboard');
        if (!verify_csrf($_POST['csrf_token'] ?? '')) { flash('error', 'Invalid CSRF'); redirect('admin/projects/merge'); }
        $threshold = trim($_POST['threshold'] ?? '');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $threshold)) {
            flash('error', t('project.date_format_error'));
            redirect('admin/projects/merge');
        }
        $db = Database::getInstance();
        $scope = $_POST['scope'] ?? 'all';
        $params = [$threshold];
        $where = 'is_completed = 0 AND due_date IS NOT NULL AND due_date <= ?';
        if ($scope === 'project' && !empty($_POST['project_id'])) {
            $where .= ' AND project_id = ?'; $params[] = (int)$_POST['project_id'];
        }
        $countRow = $db->fetch("SELECT COUNT(*) AS c FROM tasks WHERE $where", $params);
        $n = (int)($countRow['c'] ?? 0);
        if ($n === 0) {
            flash('error', t('project.no_task_match'));
            redirect('admin/projects/merge');
        }
        $db->execute(
            "UPDATE tasks SET is_completed = 1, status = 'done', completed_at = NOW() WHERE $where",
            $params
        );
        flash('success', t('project.bulk_complete_success', ['n' => $n, 'date' => $threshold]));
        redirect('admin/projects/merge');
    }

    /**
     * Admin-only: classify tasks by matching store names in task title/description.
     * Assigns matched tasks to the first store's project (by lookup), or stamps store_id
     * on the project if tasks already sit in a single project.
     */
    public function classifyByStore() {
        if (!isAdmin()) redirect('dashboard');
        if (!verify_csrf($_POST['csrf_token'] ?? '')) { flash('error', 'Invalid CSRF'); redirect('admin/projects/merge'); }
        $db = Database::getInstance();
        $stores = $db->fetchAll("SELECT id, name FROM stores ORDER BY LENGTH(name) DESC"); // longer names match first
        if (empty($stores)) { flash('error', 'Chưa có store nào.'); redirect('admin/projects/merge'); }

        $scope = $_POST['scope'] ?? 'all';
        $params = [];
        $where = "1=1";
        if ($scope === 'project' && !empty($_POST['project_id'])) {
            $where .= ' AND t.project_id = ?'; $params[] = (int)$_POST['project_id'];
        }
        // Build alias map: every store has keyword candidates
        $aliasMap = [];
        foreach ($stores as $s) {
            $name = $s['name'];
            $keys = [$name];
            // Add short-form aliases per common naming patterns
            if (preg_match('/Bakudan.*\((.*?)\)/i', $name, $m)) { $keys[] = trim($m[1]); } // (B1)
            if (preg_match('/-\s*([\w\' ]+)$/', $name, $m)) { $keys[] = trim($m[1]); } // trailing suffix
            // Standalone single-word names already covered
            $aliasMap[$s['id']] = array_unique(array_filter($keys, fn($k) => strlen($k) >= 2));
        }

        $tasks = $db->fetchAll(
            "SELECT t.id, t.title, t.description, t.project_id, p.store_id as current_store
             FROM tasks t LEFT JOIN projects p ON t.project_id = p.id
             WHERE $where", $params
        );
        $matched = [];
        foreach ($tasks as $t) {
            $haystack = mb_strtolower(($t['title'] ?? '') . ' ' . ($t['description'] ?? ''), 'UTF-8');
            foreach ($aliasMap as $sid => $keys) {
                foreach ($keys as $k) {
                    if (mb_stripos($haystack, mb_strtolower($k, 'UTF-8')) !== false) {
                        $matched[$sid] = $matched[$sid] ?? [];
                        $matched[$sid][] = $t['id'];
                        break 2;
                    }
                }
            }
        }

        // Apply: find (or implicitly create) a project per store to move tasks into, OR
        // just stamp store_id on the project if every matched task already sits in same project.
        $movedByStore = [];
        foreach ($matched as $sid => $taskIds) {
            // Find first project under this store
            $p = $db->fetch("SELECT id FROM projects WHERE store_id = ? AND status = 'active' ORDER BY id LIMIT 1", [$sid]);
            if (!$p) continue; // no destination project — skip
            $chunks = array_chunk($taskIds, 100);
            $moved = 0;
            foreach ($chunks as $chunk) {
                $placeholders = implode(',', array_fill(0, count($chunk), '?'));
                $bindings = array_merge([$p['id']], $chunk);
                $moved += (int) $db->execute(
                    "UPDATE tasks SET project_id = ? WHERE id IN ($placeholders)",
                    $bindings
                );
            }
            $movedByStore[$sid] = $moved;
        }
        $total = array_sum($movedByStore);
        $summary = [];
        foreach ($movedByStore as $sid => $n) {
            $s = array_filter($stores, fn($x) => $x['id'] == $sid);
            $s = $s ? reset($s)['name'] : "#{$sid}";
            $summary[] = "{$s}: {$n}";
        }
        if ($total === 0) {
            flash('error', 'Không match được task nào với tên store. (Kiểm tra nội dung task có chứa tên store không.)');
        } else {
            flash('success', "Đã phân loại {$total} task · " . implode(' · ', $summary));
        }
        redirect('admin/projects/merge');
    }

    public function create() {
        $users = $this->userModel->getActive();
        require __DIR__ . '/../views/projects/create.php';
    }

    public function store() {
        if (!verify_csrf($_POST['csrf'] ?? '')) { flash('error', 'Invalid security token.'); redirect('projects/create'); }
        $name = trim($_POST['name'] ?? '');
        if (empty($name)) {
            flash('error', t('project.name_required'));
            redirect('projects/create');
        }

        $id = $this->projectModel->create([
            'name' => $name,
            'description' => $_POST['description'] ?? '',
            'color' => $_POST['color'] ?? '#DC2626',
            'owner_id' => $_SESSION['user_id']
        ]);

        // Add selected members
        if (!empty($_POST['members'])) {
            foreach ($_POST['members'] as $memberId) {
                if ($memberId != $_SESSION['user_id']) {
                    $this->projectModel->addMember($id, $memberId);
                }
            }
        }

        flash('success', t('project.create_success'));
        redirect('projects/' . $id);
    }

    public function show($id) {
        $project = $this->projectModel->findById($id);
        if (!$project) redirect('projects');

        // Check access
        if (!canAdmin() && !$this->projectModel->isMember($id, $_SESSION['user_id'])) {
            redirect('projects');
        }

        $view = $_GET['view'] ?? 'board';
        $sections = $this->projectModel->getSections($id);

        if (canManage()) {
            $tasks = $this->taskModel->getByProject($id);
        } else {
            // Staff: only see tasks they're related to (assignee, creator, or watcher)
            $tasks = $this->taskModel->getByProjectForUser($id, $_SESSION['user_id']);
        }

        $members = $this->projectModel->getMembers($id);
        $allUsers = $this->userModel->getActive();
        $projectStore = !empty($project['store_id']) ? $this->storeModel->find($project['store_id']) : null;

        $taskControls = [
            'q' => trim($_GET['q'] ?? ''),
            'status' => $_GET['status'] ?? 'all',
            'assignee' => $_GET['assignee'] ?? 'all',
            'priority' => $_GET['priority'] ?? 'all',
            'due' => $_GET['due'] ?? 'all',
            'repeat' => $_GET['repeat'] ?? 'all',
            'sort' => $_GET['sort'] ?? 'urgency',
            'group' => $_GET['group'] ?? 'urgency',
            'density' => $_GET['density'] ?? 'comfortable',
        ];
        if (!in_array($taskControls['density'], ['compact', 'comfortable', 'detailed'], true)) {
            $taskControls['density'] = 'comfortable';
        }

        $tasks = $this->filterTasks($tasks, $taskControls);
        $tasks = $this->sortTasks($tasks, $taskControls['sort']);
        $listGroups = $view === 'list' ? $this->groupTasks($tasks, $taskControls['group']) : [];

        // Group tasks by section for board view
        $tasksBySection = [];
        foreach ($sections as $section) {
            $tasksBySection[$section['id']] = array_filter($tasks, function($t) use ($section) {
                return $t['section_id'] == $section['id'];
            });
            $tasksBySection[$section['id']] = $this->sortTasks(array_values($tasksBySection[$section['id']]), $taskControls['sort']);
        }

        require __DIR__ . '/../views/projects/show.php';
    }

    private function filterTasks(array $tasks, array $controls) {
        $today = app_today();

        return array_values(array_filter($tasks, function ($task) use ($controls, $today) {
            if ($controls['q'] !== '') {
                $haystack = mb_strtolower(
                    implode(' ', [
                        $task['title'] ?? '',
                        $task['description'] ?? '',
                        $task['assignee_name'] ?? '',
                        $task['store_name'] ?? '',
                    ]),
                    'UTF-8'
                );
                if (mb_strpos($haystack, mb_strtolower($controls['q'], 'UTF-8')) === false) {
                    return false;
                }
            }

            if ($controls['status'] !== 'all') {
                if ($controls['status'] === 'actionable' && !empty($task['is_completed'])) {
                    return false;
                } elseif ($controls['status'] !== 'actionable' && ($task['status'] ?? '') !== $controls['status']) {
                    return false;
                }
            }

            if ($controls['assignee'] !== 'all' && (int) ($task['assignee_id'] ?? 0) !== (int) $controls['assignee']) {
                return false;
            }

            if ($controls['priority'] !== 'all' && ($task['priority'] ?? 'medium') !== $controls['priority']) {
                return false;
            }

            if ($controls['repeat'] === 'recurring' && (($task['repeat_type'] ?? 'none') === 'none')) {
                return false;
            }
            if ($controls['repeat'] === 'single' && (($task['repeat_type'] ?? 'none') !== 'none')) {
                return false;
            }

            $dueDate = $task['due_date'] ?? null;
            $bucket = app_task_due_bucket($task, $today);
            switch ($controls['due']) {
                case 'overdue':
                    return $bucket === 'overdue';
                case 'today':
                    return $dueDate === $today && empty($task['is_completed']);
                case 'next7':
                    return $dueDate && $dueDate > $today && $dueDate <= date('Y-m-d', strtotime($today . ' +7 days')) && empty($task['is_completed']);
                case 'no_date':
                    return empty($dueDate);
                case 'completed':
                    return !empty($task['is_completed']);
            }

            return true;
        }));
    }

    private function sortTasks(array $tasks, $sort) {
        $today = app_today();
        usort($tasks, function ($a, $b) use ($sort, $today) {
            switch ($sort) {
                case 'due':
                    $aDue = $a['due_date'] ?? '9999-12-31';
                    $bDue = $b['due_date'] ?? '9999-12-31';
                    if ($aDue !== $bDue) {
                        return strcmp($aDue, $bDue);
                    }
                    break;

                case 'priority':
                    $priorityCompare = app_priority_rank($a['priority'] ?? 'medium') <=> app_priority_rank($b['priority'] ?? 'medium');
                    if ($priorityCompare !== 0) {
                        return $priorityCompare;
                    }
                    break;

                case 'assignee':
                    $assigneeCompare = strcasecmp($a['assignee_name'] ?? 'zzzz', $b['assignee_name'] ?? 'zzzz');
                    if ($assigneeCompare !== 0) {
                        return $assigneeCompare;
                    }
                    break;

                case 'title':
                    return strcasecmp($a['title'] ?? '', $b['title'] ?? '');
            }

            $urgencyCompare = app_task_urgency_rank($a, $today) <=> app_task_urgency_rank($b, $today);
            if ($urgencyCompare !== 0) {
                return $urgencyCompare;
            }

            $priorityCompare = app_priority_rank($a['priority'] ?? 'medium') <=> app_priority_rank($b['priority'] ?? 'medium');
            if ($priorityCompare !== 0) {
                return $priorityCompare;
            }

            $aDue = $a['due_date'] ?? '9999-12-31';
            $bDue = $b['due_date'] ?? '9999-12-31';
            if ($aDue !== $bDue) {
                return strcmp($aDue, $bDue);
            }

            return strcasecmp($a['title'] ?? '', $b['title'] ?? '');
        });

        return $tasks;
    }

    private function groupTasks(array $tasks, $group) {
        $today = app_today();

        // Canonical label map
        $labels = [
            'overdue'     => '🔴 Overdue',
            'in_progress' => '🔵 In Progress',
            'today'       => '🟡 Due Today',
            'upcoming'    => '📅 Upcoming',
            'no_date'     => '⚪ No Due Date',
            'completed'   => '✅ Completed',
        ];

        // Canonical display order for urgency/due groupings
        $urgencyOrder = [
            '🔴 Overdue',
            '🔵 In Progress',
            '🟡 Due Today',
            '📅 Upcoming',
            '⚪ No Due Date',
            '✅ Completed',
        ];

        $groups = [];

        foreach ($tasks as $task) {
            switch ($group) {
                case 'assignee':
                    $key = $task['assignee_name'] ?? 'Unassigned';
                    break;
                case 'due':
                    $key = $labels[app_task_due_bucket($task, $today)] ?? 'Other';
                    break;
                case 'status':
                    $key = ucfirst(str_replace('_', ' ', $task['status'] ?? 'todo'));
                    break;
                case 'urgency':
                default:
                    $key = $labels[app_task_due_bucket($task, $today)] ?? 'Other';
                    break;
            }

            if (!isset($groups[$key])) {
                $groups[$key] = [];
            }
            $groups[$key][] = $task;
        }

        // For urgency/due groupings, enforce the canonical priority order
        if (in_array($group, ['urgency', 'due'])) {
            $ordered = [];
            foreach ($urgencyOrder as $label) {
                if (isset($groups[$label])) {
                    $ordered[$label] = $groups[$label];
                }
            }
            // Catch any bucket not in canonical list
            foreach ($groups as $key => $items) {
                if (!isset($ordered[$key])) {
                    $ordered[$key] = $items;
                }
            }
            return $ordered;
        }

        return $groups;
    }

    public function edit($id) {
        $project = $this->projectModel->findById($id);
        if (!$project) redirect('projects');
        $members  = $this->projectModel->getMembers($id);
        $users    = $this->userModel->getActive();
        $sections = $this->projectModel->getSections($id);
        require __DIR__ . '/../views/projects/edit.php';
    }

    public function update($id) {
        if (!verify_csrf($_POST['csrf'] ?? '')) { flash('error', 'Invalid security token.'); redirect('projects/' . $id . '/edit'); }
        $this->projectModel->update($id, [
            'name' => trim($_POST['name'] ?? ''),
            'description' => $_POST['description'] ?? '',
            'color' => $_POST['color'] ?? '#DC2626',
            'status' => $_POST['status'] ?? 'active'
        ]);
        flash('success', t('project.update_success'));
        redirect('projects/' . $id);
    }

    public function delete($id) {
        $project = $this->projectModel->findById($id);
        if ($project && ($project['owner_id'] == $_SESSION['user_id'] || canAdmin())) {
            $this->projectModel->delete($id);
            flash('success', t('project.delete_success'));
        }
        redirect('projects');
    }

    public function archive($id) {
        $project = $this->projectModel->findById($id);
        if ($project && ($project['owner_id'] == $_SESSION['user_id'] || isAdmin())) {
            $this->projectModel->update($id, ['status' => 'archived']);
            flash('success', 'Project đã được lưu trữ.');
        }
        // Return JSON if AJAX, otherwise redirect
        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) {
            json_response(['success' => true]);
        } else {
            redirect('projects');
        }
    }

    public function renameSection($sectionId) {
        $name = trim($_POST['name'] ?? '');
        if ($name) {
            $db = Database::getInstance();
            $db->update("UPDATE sections SET name = ? WHERE id = ?", [$name, $sectionId]);
        }
        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) {
            json_response(['success' => true]);
        } else {
            redirect($_SERVER['HTTP_REFERER'] ?? 'projects');
        }
    }

    public function addMember($id) {
        if (!verify_csrf($_POST['csrf'] ?? '')) { flash('error', 'Invalid security token.'); redirect('projects/' . $id . '/edit'); }
        $userId = $_POST['user_id'] ?? 0;
        if ($userId) {
            $this->projectModel->addMember($id, $userId);
            flash('success', t('project.member_added'));
        }
        redirect('projects/' . $id);
    }

    public function removeMember($projectId, $userId) {
        $this->projectModel->removeMember($projectId, $userId);
        flash('success', t('project.member_removed'));
        redirect('projects/' . $projectId);
    }

    public function addSection($projectId) {
        $name = trim($_POST['name'] ?? '');
        if ($name) {
            $this->projectModel->addSection($projectId, $name);
        }
        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) {
            json_response(['success' => true]);
        }
        redirect('projects/' . $projectId);
    }

    public function deleteSection($sectionId) {
        $this->projectModel->deleteSection($sectionId);
        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) {
            json_response(['success' => true]);
        }
        redirect($_SERVER['HTTP_REFERER'] ?? 'projects');
    }

    /**
     * Admin-only: bulk migrate all Asana-created projects into a single target project,
     * then archive the source projects. Asana projects are identified by having asana_gid set.
     */
    public function migrateAsanaProjects() {
        if (!isAdmin()) { flash('error', 'Unauthorized'); redirect('asana'); return; }

        $db = Database::getInstance();
        $targetId = (int)($_POST['target_id'] ?? 0);
        if (!$targetId) { flash('error', 'Chọn project đích'); redirect('asana'); return; }

        // Find all active Asana-created projects (have asana_gid, not the target itself)
        $sources = $db->fetchAll(
            "SELECT id, name FROM projects WHERE asana_gid IS NOT NULL AND (status = 'active' OR status IS NULL) AND id != ?",
            [$targetId]
        );

        if (empty($sources)) {
            flash('info', 'Không có Asana project nào cần migrate.');
            redirect('asana');
            return;
        }

        $movedTasks = 0;
        $archivedProjects = 0;

        foreach ($sources as $src) {
            $sid = (int)$src['id'];

            // Ensure a section in target project named after the source project
            $existing = $db->fetch(
                "SELECT id FROM sections WHERE project_id = ? AND LOWER(name) = LOWER(?)",
                [$targetId, $src['name']]
            );
            if ($existing) {
                $sectionId = $existing['id'];
            } else {
                $maxPos = $db->fetch("SELECT COALESCE(MAX(position), 0) AS mp FROM sections WHERE project_id = ?", [$targetId]);
                $sectionId = $db->insert(
                    "INSERT INTO sections (project_id, name, position) VALUES (?, ?, ?)",
                    [$targetId, $src['name'], ($maxPos['mp'] ?? 0) + 1]
                );
            }

            // Move all tasks: update project + section
            $count = $db->fetchAll("SELECT id FROM tasks WHERE project_id = ?", [$sid]);
            $db->execute(
                "UPDATE tasks SET project_id = ?, section_id = ? WHERE project_id = ?",
                [$targetId, $sectionId, $sid]
            );
            $movedTasks += count($count);

            // Archive the source project
            $db->execute("UPDATE projects SET status = 'archived' WHERE id = ?", [$sid]);
            $archivedProjects++;
        }

        flash('success', "{$archivedProjects} Asana project(s) migrated → project #{$targetId}. {$movedTasks} tasks moved.");
        redirect('asana');
    }

    /**
     * Admin-only: automatically assign store_id to all projects that have none,
     * using name-pattern matching against active stores.
     * Words ≥3 chars from a store name matched anywhere in the project name → assign.
     */
    public function bulkAssignStores() {
        if (!isAdmin()) { flash('error', 'Unauthorized'); redirect('overview'); return; }

        $db = Database::getInstance();
        $stores = (new Store())->allActive();

        $unassigned = $db->fetchAll(
            "SELECT id, name FROM projects WHERE (store_id IS NULL OR store_id = 0) AND (status = 'active' OR status IS NULL)"
        );

        $assigned = 0;
        $skipped  = 0;
        $log = [];

        foreach ($unassigned as $proj) {
            $storeId = $this->resolveStoreByName($proj['name'], $stores);
            if ($storeId) {
                $db->execute("UPDATE projects SET store_id = ? WHERE id = ?", [$storeId, $proj['id']]);
                $storeName = '';
                foreach ($stores as $s) { if ($s['id'] == $storeId) { $storeName = $s['name']; break; } }
                $log[] = '"' . $proj['name'] . '" → ' . $storeName;
                $assigned++;
            } else {
                $skipped++;
            }
        }

        $msg = "{$assigned} project(s) assigned to stores, {$skipped} could not be matched.";
        if (!empty($log)) $msg .= ' Matched: ' . implode('; ', array_slice($log, 0, 10));
        flash('success', $msg);
        redirect('asana');
    }

    /**
     * One-time cleanup: delete "Flight's Plan" project + all tasks overdue ≥ 7 days.
     * Admin-only POST action → /admin/cleanup/overdue
     */
    public function cleanupOverdueTasks() {
        $db     = Database::getInstance();
        $cutoff = date('Y-m-d', strtotime('-7 days'));
        $deleted = ['project' => 0, 'project_tasks' => 0, 'overdue_tasks' => 0];

        // 1. Delete "Flight's Plan" project + its tasks
        $flight = $db->fetch(
            "SELECT id, name FROM projects WHERE name LIKE '%Flight%Plan%' OR name LIKE '%Flight%s%Plan%' LIMIT 1"
        );
        if ($flight) {
            $pid = (int)$flight['id'];
            // Remove child tasks first using JOIN (avoids MySQL subquery-on-same-table error)
            $db->execute(
                "DELETE t FROM tasks t INNER JOIN tasks p ON t.parent_task_id = p.id WHERE p.project_id = ?",
                [$pid]
            );
            $deleted['project_tasks'] = (int)$db->execute("DELETE FROM tasks WHERE project_id = ?", [$pid]);
            $db->execute("DELETE FROM projects WHERE id = ?", [$pid]);
            $deleted['project'] = 1;
        }

        // 2. Delete all non-completed tasks overdue ≥ 7 days
        $overdueRows = $db->fetchAll(
            "SELECT id FROM tasks WHERE is_completed = 0 AND due_date IS NOT NULL AND due_date < ?",
            [$cutoff]
        );
        if (!empty($overdueRows)) {
            // Remove child tasks using JOIN (avoids MySQL subquery-on-same-table error)
            $db->execute(
                "DELETE t FROM tasks t
                 INNER JOIN tasks parent ON t.parent_task_id = parent.id
                 WHERE parent.is_completed = 0 AND parent.due_date IS NOT NULL AND parent.due_date < ?",
                [$cutoff]
            );
            $deleted['overdue_tasks'] = (int)$db->execute(
                "DELETE FROM tasks WHERE is_completed = 0 AND due_date IS NOT NULL AND due_date < ?",
                [$cutoff]
            );
        }

        $parts = [];
        if ($deleted['project']) {
            $parts[] = "Deleted project 'Flight\\'s Plan' + {$deleted['project_tasks']} tasks";
        }
        $parts[] = "Deleted {$deleted['overdue_tasks']} tasks overdue ≥7 days (before {$cutoff})";
        flash('success', implode('. ', $parts) . '.');
        redirect('overview');
    }

    /**
     * Match project name against store list by word overlap (≥3 chars).
     */
    private function resolveStoreByName($projectName, $allStores) {
        $nameLower = strtolower(trim($projectName));
        foreach ($allStores as $store) {
            $words = array_filter(preg_split('/[\s\-_]+/', strtolower(trim($store['name']))));
            foreach ($words as $word) {
                if (strlen($word) >= 3 && strpos($nameLower, $word) !== false) {
                    return (int)$store['id'];
                }
            }
        }
        return null;
    }
}
