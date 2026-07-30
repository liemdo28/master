<?php
class AsanaController {
    private $projectModel;
    private $taskModel;
    private $userModel;
    private $db;

    public function __construct() {
        $this->projectModel = new Project();
        $this->taskModel = new Task();
        $this->userModel = new User();
        $this->db = Database::getInstance();
    }

    public function index() {
        $userId = $_SESSION['user_id'];
        $projects = $this->projectModel->getByUser($userId);
        $notifications = new Notification();
        $unreadCount = $notifications->getUnreadCount($userId);

        // Get current Asana settings (handle table not existing yet)
        try {
            $asanaSettings = $this->db->fetch("SELECT * FROM asana_settings ORDER BY id DESC LIMIT 1");
        } catch (\Exception $e) {
            $asanaSettings = null;
        }

        // Active projects for target mapping
        $activeProjects = $this->db->fetchAll(
            "SELECT id, name FROM projects WHERE status = 'active' OR status IS NULL ORDER BY name ASC"
        );

        require __DIR__ . '/../views/admin/asana_import.php';
    }

    public function fetchWorkspaces() {
        header('Content-Type: application/json');
        $token = trim($_POST['token'] ?? '');
        if (!$token) {
            echo json_encode(['error' => 'Token is required']);
            return;
        }

        $result = $this->asanaGet('/workspaces', $token);
        if (isset($result['error'])) {
            echo json_encode(['error' => $result['error']]);
            return;
        }

        echo json_encode(['data' => $result['data'] ?? []]);
    }

    public function saveSettings() {
        header('Content-Type: application/json');
        $token = trim($_POST['token'] ?? '');
        $workspaceId = trim($_POST['workspace_id'] ?? '');
        $workspaceName = trim($_POST['workspace_name'] ?? '');
        $syncMode = ($_POST['sync_mode'] ?? '') === 'my_tasks' ? 'my_tasks' : 'project';
        if (!$token || (!$workspaceId && $syncMode !== 'my_tasks')) {
            echo json_encode(['error' => 'Token and workspace are required']);
            return;
        }

        // Verify token works
        $result = $syncMode === 'my_tasks'
            ? $this->asanaGet('/users/me?opt_fields=gid,name,email,workspaces.gid,workspaces.name', $token)
            : $this->asanaGet('/workspaces', $token);
        if (isset($result['error'])) {
            echo json_encode(['error' => $result['error']]);
            return;
        }

        $userId = $_SESSION['user_id'];
        $targetProjectId = !empty($_POST['sync_target_project_id']) ? (int)$_POST['sync_target_project_id'] : null;

        // Ensure table exists
        $this->ensureTable();

        $existing = $this->db->fetch("SELECT id FROM asana_settings ORDER BY id DESC LIMIT 1");
        if ($existing) {
            $this->db->update(
                "UPDATE asana_settings
                 SET token = ?, workspace_id = ?, workspace_name = ?, sync_target_project_id = ?, sync_mode = ?, sync_enabled = 1, created_by = ?
                 WHERE id = ?",
                [$token, $workspaceId, $workspaceName, $targetProjectId, $syncMode, $userId, $existing['id']]
            );
        } else {
            $this->db->insert(
                "INSERT INTO asana_settings (token, workspace_id, workspace_name, sync_target_project_id, sync_mode, sync_enabled, created_by) VALUES (?, ?, ?, ?, ?, 1, ?)",
                [$token, $workspaceId, $workspaceName, $targetProjectId, $syncMode, $userId]
            );
        }

        echo json_encode(['success' => true]);
    }

    public function updateTargetProject() {
        header('Content-Type: application/json');
        if (!isAdmin()) { echo json_encode(['error' => 'Unauthorized']); return; }

        $targetProjectId = !empty($_POST['sync_target_project_id']) ? (int)$_POST['sync_target_project_id'] : null;
        $this->ensureTable();
        $this->db->update(
            "UPDATE asana_settings SET sync_target_project_id = ? ORDER BY id DESC LIMIT 1",
            [$targetProjectId]
        );
        echo json_encode(['success' => true]);
    }

    public function disconnect() {
        header('Content-Type: application/json');
        $this->db->delete("DELETE FROM asana_settings");
        echo json_encode(['success' => true]);
    }

    public function executeImport() {
        header('Content-Type: application/json');

        // Get settings from DB
        $settings = $this->db->fetch("SELECT * FROM asana_settings ORDER BY id DESC LIMIT 1");
        if (!$settings) {
            echo json_encode(['error' => 'Asana not connected. Please connect first.']);
            return;
        }

        $targetProjectId = !empty($settings['sync_target_project_id']) ? (int)$settings['sync_target_project_id'] : null;
        if (($settings['sync_mode'] ?? '') === 'my_tasks') {
            $result = $this->syncMyTasksFromAsana($settings['token'], $settings['workspace_id'] ?: null);
        } else {
            $result = $this->syncFromAsana($settings['token'], $settings['workspace_id'], $_SESSION['user_id'], $targetProjectId);
        }

        // Update last_sync_at
        $this->db->update("UPDATE asana_settings SET last_sync_at = NOW() WHERE id = ?", [$settings['id']]);

        echo json_encode($result);
    }

    /**
     * Called by cron - no session needed
     */
    public static function cronSync() {
        $db = Database::getInstance();
        $envToken = trim((string)(getenv('ASANA_ACCESS_TOKEN') ?: ($_ENV['ASANA_ACCESS_TOKEN'] ?? '')));
        $envWorkspaceId = trim((string)(getenv('ASANA_WORKSPACE_GID') ?: ($_ENV['ASANA_WORKSPACE_GID'] ?? '')));
        $envSyncMode = strtolower(trim((string)(getenv('ASANA_SYNC_MODE') ?: ($_ENV['ASANA_SYNC_MODE'] ?? ''))));
        try {
            $settings = $db->fetch("SELECT * FROM asana_settings WHERE sync_enabled = 1 ORDER BY id DESC LIMIT 1");
        } catch (\Exception $e) {
            $settings = null;
        }
        if (!$settings && !$envToken) return;

        $controller = new self();
        $settingsSyncMode = strtolower(trim((string)($settings['sync_mode'] ?? '')));
        if ($envToken || $envSyncMode === 'my_tasks' || $settingsSyncMode === 'my_tasks') {
            $token = $envToken ?: $settings['token'];
            $workspaceId = $envWorkspaceId ?: ($settings['workspace_id'] ?? '');
            $result = $controller->syncMyTasksFromAsana($token, $workspaceId ?: null);
        } else {
            $targetProjectId = !empty($settings['sync_target_project_id']) ? (int)$settings['sync_target_project_id'] : null;
            $result = $controller->syncFromAsana($settings['token'], $settings['workspace_id'], $settings['created_by'], $targetProjectId);
        }

        if (!empty($settings['id'])) {
            $db->update("UPDATE asana_settings SET last_sync_at = NOW() WHERE id = ?", [$settings['id']]);
        }

        echo "Asana sync: {$result['created_projects']} new projects, {$result['updated_projects']} updated, {$result['created_tasks']} new tasks, {$result['updated_tasks']} updated\n";
    }

    public function syncMyTasksFromAsana($token, $workspaceId = null) {
        $this->ensureTable();

        $me = $this->asanaGet('/users/me?opt_fields=gid,name,email,workspaces.gid,workspaces.name', $token);
        if (isset($me['error'])) {
            return $this->emptySyncResult($me['error']);
        }

        $asanaUser = $me['data'] ?? [];
        $workspaceIds = $workspaceId
            ? [$workspaceId]
            : array_values(array_filter(array_map(fn($w) => $w['gid'] ?? null, $asanaUser['workspaces'] ?? [])));
        if (!$workspaceIds) {
            return $this->emptySyncResult('Asana workspace not found for token user');
        }

        $syncUserId = $this->resolveDashboardUserId($asanaUser);
        if (!$syncUserId) {
            return $this->emptySyncResult('Dashboard CEO user not found for Asana user');
        }

        $projectId = $this->ensureAsanaMyTasksProject($syncUserId, $asanaUser);
        $sectionId = $this->ensureSection($projectId, 'Asana My Tasks');

        $createdTasks = 0;
        $updatedTasks = 0;
        $skippedTasks = 0;
        $errors = [];
        $completedSince = rawurlencode(trim((string)(getenv('ASANA_COMPLETED_SINCE') ?: ($_ENV['ASANA_COMPLETED_SINCE'] ?? '1970-01-01T00:00:00.000Z'))));
        $fields = implode(',', [
            'gid',
            'name',
            'notes',
            'html_notes',
            'permalink_url',
            'created_at',
            'modified_at',
            'completed',
            'completed_at',
            'due_on',
            'due_at',
            'start_on',
            'start_at',
            'assignee.gid',
            'assignee.name',
            'assignee.email',
            'assignee_status',
            'approval_status',
            'resource_subtype',
            'memberships.project.gid',
            'memberships.project.name',
            'memberships.section.gid',
            'memberships.section.name',
            'tags.gid',
            'tags.name',
            'custom_fields.gid',
            'custom_fields.name',
            'custom_fields.display_value',
            'custom_fields.text_value',
            'custom_fields.number_value',
            'custom_fields.enum_value.name',
        ]);

        foreach ($workspaceIds as $currentWorkspaceId) {
            $offset = null;
            do {
                $url = "/tasks?workspace={$currentWorkspaceId}&assignee=me&completed_since={$completedSince}&limit=100&opt_fields=" . rawurlencode($fields);
                if ($offset) $url .= '&offset=' . rawurlencode($offset);

                $result = $this->asanaGet($url, $token);
                if (isset($result['error'])) {
                    $errors[] = "Workspace {$currentWorkspaceId}: " . $result['error'];
                    break;
                }

                foreach (($result['data'] ?? []) as $task) {
                    if (empty(trim($task['name'] ?? ''))) {
                        $skippedTasks++;
                        continue;
                    }

                    $existing = $this->db->fetch("SELECT id FROM tasks WHERE asana_gid = ?", [$task['gid']]);
                    $taskData = $this->mapAsanaTaskToLocal($task, $projectId, $sectionId, $syncUserId);

                    if ($existing) {
                        $this->taskModel->update((int)$existing['id'], $taskData);
                        $this->persistAsanaTaskMirror((int)$existing['id'], $task);
                        $updatedTasks++;
                    } else {
                        $taskId = $this->taskModel->create($taskData);
                        $this->db->update("UPDATE tasks SET asana_gid = ? WHERE id = ?", [$task['gid'], $taskId]);
                        $this->persistAsanaTaskMirror((int)$taskId, $task);
                        $createdTasks++;
                    }
                }

                $offset = $result['next_page']['offset'] ?? null;
            } while ($offset);
        }

        $this->db->insert(
            "INSERT INTO asana_sync_runs (sync_type, asana_user_gid, asana_user_name, workspace_gid, dashboard_user_id, status, created_tasks, updated_tasks, skipped_tasks, error_message, finished_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
            [
                'my_tasks',
                $asanaUser['gid'] ?? null,
                $asanaUser['name'] ?? '',
                implode(',', $workspaceIds),
                $syncUserId,
                empty($errors) ? 'success' : 'partial',
                $createdTasks,
                $updatedTasks,
                $skippedTasks,
                $errors ? implode('; ', $errors) : null,
            ]
        );

        return [
            'success' => empty($errors),
            'created_projects' => 0,
            'updated_projects' => 1,
            'created_tasks' => $createdTasks,
            'updated_tasks' => $updatedTasks,
            'skipped' => $skippedTasks,
            'errors' => $errors,
            'mode' => 'my_tasks',
        ];
    }

    private function syncFromAsana($token, $workspaceId, $userId, $targetProjectId = null) {
        // Build email→user_id map
        $allUsers = $this->userModel->getAll();
        $emailMap = [];
        foreach ($allUsers as $u) {
            $emailMap[strtolower($u['email'])] = $u['id'];
        }

        // Load all stores for name-pattern store resolution
        $allStores = (new Store())->allActive();

        $colorMap = [
            'dark-pink' => '#EA4E9D', 'dark-green' => '#058527', 'dark-blue' => '#4186E0',
            'dark-red' => '#E8384F', 'dark-teal' => '#27AA90', 'dark-brown' => '#8D6E63',
            'dark-orange' => '#FD9A00', 'dark-warm-gray' => '#8DA3A6', 'dark-purple' => '#7C58CB',
            'light-pink' => '#EA4E9D', 'light-green' => '#62D26F', 'light-blue' => '#4186E0',
            'light-red' => '#E8384F', 'light-teal' => '#37C5AB', 'light-yellow' => '#EEC300',
            'light-orange' => '#FD9A00', 'light-warm-gray' => '#8DA3A6', 'light-purple' => '#AA62E3',
            'none' => '#DC2626',
        ];

        $statusMap = [
            'to do' => 'todo', 'todo' => 'todo', 'backlog' => 'todo',
            'in progress' => 'in_progress', 'doing' => 'in_progress', 'wip' => 'in_progress',
            'review' => 'review', 'testing' => 'review', 'qa' => 'review',
            'done' => 'done', 'complete' => 'done', 'completed' => 'done',
        ];

        // Fetch all projects from Asana
        $projectsResult = $this->asanaGet("/workspaces/{$workspaceId}/projects?opt_fields=name,color,notes,archived&limit=100", $token);
        if (isset($projectsResult['error'])) {
            return ['error' => $projectsResult['error']];
        }

        $asanaProjects = array_filter($projectsResult['data'] ?? [], fn($p) => empty($p['archived']));

        $createdProjects = 0;
        $updatedProjects = 0;
        $createdTasks = 0;
        $updatedTasks = 0;
        $skippedTasks = 0;
        $errors = [];

        foreach ($asanaProjects as $ap) {
            $asanaGid = $ap['gid'];
            $color = $colorMap[$ap['color'] ?? 'none'] ?? '#DC2626';

            if ($targetProjectId) {
                // ── TARGET MODE: Asana project → section inside target project ──
                $localProjectId = $targetProjectId;
                $sectionId = $this->ensureSection($localProjectId, $ap['name']);

                // Build a minimal sectionMap for status inference (only this new section)
                $allSections = $this->projectModel->getSections($localProjectId);
                $sectionMap = [];
                foreach ($allSections as $ds) {
                    $sectionMap[strtolower($ds['name'])] = $ds['id'];
                }

                // Each Asana task's membership section maps into the same target section
                // (inner Asana sections are ignored in target mode - all tasks go under the Asana project's section)
                $asanaSectionMap = null; // signals target mode in task loop

                $createdProjects++; // count as "processed"
            } else {
                // ── STANDALONE MODE: Asana project → new/existing local project ──
                $existingProject = $this->db->fetch("SELECT id FROM projects WHERE asana_gid = ?", [$asanaGid]);
                $resolvedStoreId = $this->resolveStoreId($ap['name'], $allStores);

                if ($existingProject) {
                    $localProjectId = $existingProject['id'];
                    $updateData = ['name' => $ap['name'], 'description' => $ap['notes'] ?? '', 'color' => $color];
                    if ($resolvedStoreId) $updateData['store_id'] = $resolvedStoreId;
                    $this->projectModel->update($localProjectId, $updateData);
                    $updatedProjects++;
                } else {
                    $localProjectId = $this->projectModel->create([
                        'name' => $ap['name'],
                        'description' => $ap['notes'] ?? '',
                        'color' => $color,
                        'owner_id' => $userId,
                        'store_id' => $resolvedStoreId,
                    ]);
                    $this->db->update("UPDATE projects SET asana_gid = ? WHERE id = ?", [$asanaGid, $localProjectId]);
                    $createdProjects++;
                }

                // Build section map from local project
                $defaultSections = $this->projectModel->getSections($localProjectId);
                $sectionMap = [];
                foreach ($defaultSections as $ds) {
                    $sectionMap[strtolower($ds['name'])] = $ds['id'];
                }

                // Fetch Asana sections and map them
                $sectionsResult = $this->asanaGet("/projects/{$asanaGid}/sections?opt_fields=name", $token);
                $asanaSections = $sectionsResult['data'] ?? [];
                $asanaSectionMap = [];

                foreach ($asanaSections as $as) {
                    $sectionName = $as['name'];
                    $key = strtolower($sectionName);

                    if ($key === '(no section)' || $key === 'untitled section' || $key === '') {
                        $asanaSectionMap[$as['gid']] = $sectionMap['to do'] ?? reset($sectionMap);
                        continue;
                    }

                    if (isset($sectionMap[$key])) {
                        $asanaSectionMap[$as['gid']] = $sectionMap[$key];
                    } else {
                        $newSectionId = $this->projectModel->addSection($localProjectId, $sectionName);
                        $sectionMap[$key] = $newSectionId;
                        $asanaSectionMap[$as['gid']] = $newSectionId;
                    }
                }

                $sectionId = null; // will be determined per task
            }

            // Fetch tasks
            $offset = null;
            do {
                $url = "/projects/{$asanaGid}/tasks?opt_fields=name,notes,due_on,start_on,completed,completed_at,assignee.email,memberships.section.gid,modified_at&modified_since=2026-05-01T00:00:00.000Z&limit=100";
                if ($offset) $url .= "&offset={$offset}";

                $tasksResult = $this->asanaGet($url, $token);
                if (isset($tasksResult['error'])) {
                    $errors[] = "Project '{$ap['name']}': " . $tasksResult['error'];
                    break;
                }

                $asanaTasks = $tasksResult['data'] ?? [];
                $offset = $tasksResult['next_page']['offset'] ?? null;

                foreach ($asanaTasks as $at) {
                    $taskGid = $at['gid'];

                    if (empty(trim($at['name'] ?? ''))) {
                        $skippedTasks++;
                        continue;
                    }

                    // Determine section for this task
                    if ($targetProjectId) {
                        // Target mode: all tasks from this Asana project go into its dedicated section
                        $taskSectionId = $sectionId;
                    } else {
                        // Standalone mode: map via Asana membership
                        $taskSectionId = null;
                        if (!empty($at['memberships'])) {
                            foreach ($at['memberships'] as $mem) {
                                if (!empty($mem['section']['gid']) && isset($asanaSectionMap[$mem['section']['gid']])) {
                                    $taskSectionId = $asanaSectionMap[$mem['section']['gid']];
                                    break;
                                }
                            }
                        }
                        if (!$taskSectionId) {
                            $taskSectionId = $sectionMap['to do'] ?? reset($sectionMap) ?: null;
                        }
                    }

                    // Status from section name
                    $status = 'todo';
                    foreach ($sectionMap as $sName => $sId) {
                        if ($sId === $taskSectionId && isset($statusMap[$sName])) {
                            $status = $statusMap[$sName];
                            break;
                        }
                    }

                    // Assignee
                    $assigneeId = null;
                    if (!empty($at['assignee']['email'])) {
                        $assigneeId = $emailMap[strtolower($at['assignee']['email'])] ?? null;
                    }

                    $isCompleted = !empty($at['completed']) ? 1 : 0;
                    if ($isCompleted) $status = 'done';

                    // Check if task already exists
                    $existingTask = $this->db->fetch("SELECT id FROM tasks WHERE asana_gid = ?", [$taskGid]);

                    if ($existingTask) {
                        $updateData = [
                            'title' => $at['name'],
                            'description' => $at['notes'] ?? '',
                            'assignee_id' => $assigneeId,
                            'status' => $status,
                            'due_date' => $at['due_on'] ?? null,
                            'start_date' => $at['start_on'] ?? null,
                            'section_id' => $taskSectionId,
                            'is_completed' => $isCompleted,
                        ];
                        // In target mode, also update project_id to target
                        if ($targetProjectId) {
                            $updateData['project_id'] = $localProjectId;
                        }
                        $this->taskModel->update($existingTask['id'], $updateData);
                        if ($isCompleted) {
                            $completedAt = $at['completed_at'] ?? date('Y-m-d H:i:s');
                            $this->db->update("UPDATE tasks SET completed_at = ? WHERE id = ?", [$completedAt, $existingTask['id']]);
                        }
                        $updatedTasks++;
                    } else {
                        $taskId = $this->taskModel->create([
                            'project_id' => $localProjectId,
                            'section_id' => $taskSectionId,
                            'title' => $at['name'],
                            'description' => $at['notes'] ?? '',
                            'assignee_id' => $assigneeId,
                            'priority' => 'medium',
                            'status' => $status,
                            'due_date' => $at['due_on'] ?? null,
                            'start_date' => $at['start_on'] ?? null,
                            'created_by' => $userId,
                        ]);
                        $this->db->update("UPDATE tasks SET asana_gid = ? WHERE id = ?", [$taskGid, $taskId]);

                        if ($isCompleted && $taskId) {
                            $completedAt = $at['completed_at'] ?? date('Y-m-d H:i:s');
                            $this->db->update("UPDATE tasks SET is_completed = 1, completed_at = ? WHERE id = ?", [$completedAt, $taskId]);
                        }
                        $createdTasks++;
                    }
                }
            } while ($offset);
        }

        return [
            'success' => true,
            'created_projects' => $createdProjects,
            'updated_projects' => $updatedProjects,
            'created_tasks' => $createdTasks,
            'updated_tasks' => $updatedTasks,
            'skipped' => $skippedTasks,
            'errors' => $errors,
            'mode' => $targetProjectId ? 'target' : 'standalone',
        ];
    }

    /**
     * Match a project name to a store by checking if any word from the store name
     * (≥3 chars) appears in the project name. Returns store_id or null.
     */
    private function resolveStoreId($projectName, $allStores) {
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

    /**
     * Ensure a section with the given name exists in the target project.
     * Returns the section id (reuses existing or creates new).
     */
    private function ensureSection($projectId, $name) {
        $existing = $this->db->fetch(
            "SELECT id FROM sections WHERE project_id = ? AND LOWER(name) = LOWER(?)",
            [$projectId, $name]
        );
        if ($existing) return $existing['id'];

        $maxPos = $this->db->fetch(
            "SELECT COALESCE(MAX(position), 0) AS mp FROM sections WHERE project_id = ?",
            [$projectId]
        );
        $position = ($maxPos['mp'] ?? 0) + 1;

        return $this->db->insert(
            "INSERT INTO sections (project_id, name, position) VALUES (?, ?, ?)",
            [$projectId, $name, $position]
        );
    }

    private function ensureTable() {
        $this->db->query(
            "CREATE TABLE IF NOT EXISTS asana_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                token TEXT NOT NULL,
                workspace_id VARCHAR(50) NOT NULL,
                workspace_name VARCHAR(200) DEFAULT '',
                sync_target_project_id INT NULL DEFAULT NULL,
                sync_mode VARCHAR(30) NOT NULL DEFAULT 'project',
                last_sync_at TIMESTAMP NULL DEFAULT NULL,
                sync_enabled TINYINT(1) DEFAULT 1,
                created_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )", []
        );
        // Ensure asana_gid columns exist
        try { $this->db->query("ALTER TABLE projects ADD COLUMN asana_gid VARCHAR(50) NULL DEFAULT NULL", []); } catch (\Exception $e) {}
        try { $this->db->query("ALTER TABLE tasks ADD COLUMN asana_gid VARCHAR(50) NULL DEFAULT NULL", []); } catch (\Exception $e) {}
        // Ensure sync_target_project_id column exists (for existing installs)
        try { $this->db->query("ALTER TABLE asana_settings ADD COLUMN sync_target_project_id INT NULL DEFAULT NULL", []); } catch (\Exception $e) {}
        try { $this->db->query("ALTER TABLE asana_settings ADD COLUMN sync_mode VARCHAR(30) NOT NULL DEFAULT 'project'", []); } catch (\Exception $e) {}
        try { $this->db->query("ALTER TABLE tasks ADD COLUMN asana_permalink_url VARCHAR(500) NULL DEFAULT NULL", []); } catch (\Exception $e) {}
        try { $this->db->query("ALTER TABLE tasks ADD COLUMN asana_modified_at DATETIME NULL DEFAULT NULL", []); } catch (\Exception $e) {}
        try { $this->db->query("ALTER TABLE tasks ADD COLUMN asana_raw_json LONGTEXT NULL DEFAULT NULL", []); } catch (\Exception $e) {}
        try { $this->db->query("ALTER TABLE tasks ADD UNIQUE INDEX idx_task_asana_gid (asana_gid)", []); } catch (\Exception $e) {}
        try { $this->db->query("ALTER TABLE projects ADD UNIQUE INDEX idx_asana_gid (asana_gid)", []); } catch (\Exception $e) {}
        $this->db->query(
            "CREATE TABLE IF NOT EXISTS asana_sync_runs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sync_type VARCHAR(30) NOT NULL DEFAULT 'project',
                asana_user_gid VARCHAR(50) NULL DEFAULT NULL,
                asana_user_name VARCHAR(200) NULL DEFAULT NULL,
                workspace_gid VARCHAR(50) NULL DEFAULT NULL,
                dashboard_user_id INT NULL DEFAULT NULL,
                status VARCHAR(30) NOT NULL DEFAULT 'success',
                created_tasks INT NOT NULL DEFAULT 0,
                updated_tasks INT NOT NULL DEFAULT 0,
                skipped_tasks INT NOT NULL DEFAULT 0,
                error_message TEXT NULL DEFAULT NULL,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                finished_at TIMESTAMP NULL DEFAULT NULL,
                INDEX idx_asana_sync_runs_started (started_at),
                INDEX idx_asana_sync_runs_user (dashboard_user_id)
            )", []
        );
    }

    private function emptySyncResult($error) {
        return [
            'success' => false,
            'created_projects' => 0,
            'updated_projects' => 0,
            'created_tasks' => 0,
            'updated_tasks' => 0,
            'skipped' => 0,
            'errors' => [$error],
            'mode' => 'my_tasks',
        ];
    }

    private function resolveDashboardUserId(array $asanaUser): ?int {
        $email = strtolower(trim((string)(getenv('ASANA_DASHBOARD_USER_EMAIL') ?: ($_ENV['ASANA_DASHBOARD_USER_EMAIL'] ?? ($asanaUser['email'] ?? '')))));
        if ($email !== '') {
            $user = $this->db->fetch("SELECT id FROM users WHERE LOWER(email) = ? AND is_active = 1 LIMIT 1", [$email]);
            if ($user) return (int)$user['id'];
        }

        $name = trim((string)(getenv('ASANA_DASHBOARD_USER_NAME') ?: ($_ENV['ASANA_DASHBOARD_USER_NAME'] ?? ($asanaUser['name'] ?? 'Hoang Le'))));
        if ($name !== '') {
            $user = $this->db->fetch("SELECT id FROM users WHERE LOWER(name) = LOWER(?) AND role IN ('ceo','admin') AND is_active = 1 LIMIT 1", [$name]);
            if ($user) return (int)$user['id'];
        }

        $user = $this->db->fetch("SELECT id FROM users WHERE role = 'ceo' AND is_active = 1 ORDER BY id ASC LIMIT 1");
        if ($user) return (int)$user['id'];

        $user = $this->db->fetch("SELECT id FROM users WHERE role = 'admin' AND is_active = 1 ORDER BY id ASC LIMIT 1");
        return $user ? (int)$user['id'] : null;
    }

    private function ensureAsanaMyTasksProject(int $userId, array $asanaUser): int {
        $asanaProjectGid = 'asana-my-tasks-' . ($asanaUser['gid'] ?? 'me');
        $existing = $this->db->fetch("SELECT id FROM projects WHERE asana_gid = ? LIMIT 1", [$asanaProjectGid]);
        if ($existing) return (int)$existing['id'];

        $projectId = $this->projectModel->create([
            'name' => 'Asana My Tasks - ' . ($asanaUser['name'] ?? 'CEO'),
            'description' => 'Auto-synced 1:1 from Asana My Tasks.',
            'color' => '#796EFF',
            'owner_id' => $userId,
            'store_id' => null,
        ]);
        $this->db->update("UPDATE projects SET asana_gid = ? WHERE id = ?", [$asanaProjectGid, $projectId]);
        return (int)$projectId;
    }

    private function mapAsanaTaskToLocal(array $task, int $projectId, int $sectionId, int $userId): array {
        $isCompleted = !empty($task['completed']) ? 1 : 0;
        return [
            'project_id' => $projectId,
            'section_id' => $sectionId,
            'title' => $task['name'],
            'description' => $task['notes'] ?? '',
            'notes' => $task['html_notes'] ?? null,
            'assignee_id' => $userId,
            'priority' => $this->inferPriorityFromAsana($task),
            'status' => $isCompleted ? 'done' : 'todo',
            'due_date' => $task['due_on'] ?? null,
            'start_date' => $task['start_on'] ?? null,
            'created_by' => $userId,
            'accepted_at' => date('Y-m-d H:i:s'),
            'visibility' => 'private',
            'private_by_user_id' => $userId,
            'is_completed' => $isCompleted,
        ];
    }

    private function inferPriorityFromAsana(array $task): string {
        foreach (($task['custom_fields'] ?? []) as $field) {
            $name = strtolower((string)($field['name'] ?? ''));
            $value = strtolower((string)($field['display_value'] ?? $field['text_value'] ?? ($field['enum_value']['name'] ?? '')));
            if (str_contains($name, 'priority') || str_contains($name, 'ưu tiên')) {
                if (str_contains($value, 'urgent') || str_contains($value, 'critical') || str_contains($value, 'khẩn')) return 'urgent';
                if (str_contains($value, 'high') || str_contains($value, 'cao')) return 'high';
                if (str_contains($value, 'low') || str_contains($value, 'thấp')) return 'low';
            }
        }
        return 'medium';
    }

    private function persistAsanaTaskMirror(int $taskId, array $task): void {
        $completedAt = !empty($task['completed_at']) ? $this->normalizeAsanaDateTime($task['completed_at']) : null;
        $modifiedAt = !empty($task['modified_at']) ? $this->normalizeAsanaDateTime($task['modified_at']) : null;
        $this->db->update(
            "UPDATE tasks
             SET completed_at = ?, asana_permalink_url = ?, asana_modified_at = ?, asana_raw_json = ?
             WHERE id = ?",
            [
                $completedAt,
                $task['permalink_url'] ?? null,
                $modifiedAt,
                json_encode($task, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                $taskId,
            ]
        );
    }

    private function normalizeAsanaDateTime($value): ?string {
        if (!$value) return null;
        try {
            return (new DateTime((string)$value))->format('Y-m-d H:i:s');
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function asanaGet($endpoint, $token) {
        $url = 'https://app.asana.com/api/1.0' . $endpoint;
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => "Authorization: Bearer {$token}\r\nAccept: application/json\r\n",
                'timeout' => 30,
                'ignore_errors' => true,
            ],
            'ssl' => [
                'verify_peer' => true,
                'verify_peer_name' => true,
            ],
        ]);

        $response = @file_get_contents($url, false, $context);
        if ($response === false) {
            return ['error' => 'Failed to connect to Asana API'];
        }

        $data = json_decode($response, true);
        if (isset($data['errors'])) {
            return ['error' => $data['errors'][0]['message'] ?? 'Asana API error'];
        }

        return $data;
    }
}
