<?php
/**
 * AdminTaskAuditController
 * CEO/Admin tool for:
 * 1. Finding duplicate tasks
 * 2. Viewing/merging/archiving duplicates
 * 3. All Tasks CEO view (by store, member, category)
 * 4. Workflow queue management (submitted/checking/accepted/rejected)
 */
class AdminTaskAuditController {
    private $taskModel;

    public function __construct() {
        $this->taskModel = new Task();
        if (!canAdmin()) {
            flash("error", "Admin access required.");
            redirect("dashboard");
        }
    }

    // DUPLICATE AUDIT
    /**
     * GET /admin/tasks/duplicates
     * Show duplicate task report.
     */
    public function duplicates() {
        $duplicates = $this->taskModel->findDuplicates();
        $totalDupGroups = count($duplicates);
        $totalDupTasks = array_sum(array_column($duplicates, "dup_count"));

        $db = Database::getInstance();
        $recentAudits = $db->fetchAll(
            "SELECT da.*, t.title as task_title, u.name as audited_by_name"
            ." FROM task_duplicate_audit da"
            ." JOIN tasks t ON da.task_id = t.id"
            ." LEFT JOIN users u ON da.audited_by = u.id"
            ." ORDER BY da.created_at DESC LIMIT 50"
        );

        $notifications = new Notification();
        require __DIR__ . "/../views/admin/task_audit/duplicates.php";
    }

    /**
     * GET /admin/tasks/duplicates/group?task_id=X
     * Show a specific duplicate group.
     */
    public function duplicateGroup() {
        $taskId = (int)($_GET["task_id"] ?? 0);
        $group = $this->taskModel->getDuplicateGroup($taskId);
        if (!$group) {
            flash("error", "Task not found.");
            redirect("admin/tasks/duplicates");
        }
        require __DIR__ . "/../views/admin/task_audit/duplicate_group.php";
    }

    /**
     * POST /admin/tasks/duplicates/archive
     * Archive a duplicate task (soft delete).
     */
    public function archiveDuplicate() {
        $this->verifyCsrfOrExit($_POST["csrf"] ?? "");
        $taskId = (int)($_POST["task_id"] ?? 0);
        if (!$taskId) redirect("admin/tasks/duplicates");

        $ok = $this->taskModel->archive($taskId, (int)$_SESSION["user_id"]);
        if ($ok) {
            flash("success", "Task archived successfully.");
        } else {
            flash("error", "Failed to archive task.");
        }
        redirect("admin/tasks/duplicates");
    }

    /**
     * POST /admin/tasks/duplicates/merge
     * Keep one as canonical, archive others.
     */
    public function mergeDuplicates() {
        $this->verifyCsrfOrExit($_POST["csrf"] ?? "");
        $canonicalId = (int)($_POST["canonical_id"] ?? 0);
        $archiveIds = array_filter(array_map("intval", $_POST["archive_ids"] ?? []));
        if (!$canonicalId || empty($archiveIds)) {
            flash("error", "Must specify canonical and archive IDs.");
            redirect("admin/tasks/duplicates");
        }

        $count = 0;
        foreach ($archiveIds as $archiveId) {
            if ($archiveId === $canonicalId) continue;
            if ($this->taskModel->archive($archiveId, (int)$_SESSION["user_id"])) {
                $count++;
            }
        }

        flash("success", "Archived " . $count . " duplicate(s). Canonical task kept.");
        redirect("admin/tasks/duplicates");
    }

    // CEO: ALL TASKS VIEW

    /**
     * GET /admin/tasks/all
     * CEO all-member/all-time task view with filters.
     */
    public function allTasks() {
        $db = Database::getInstance();

        // Filters
        $memberId  = isset($_GET["member"]) ? (int)$_GET["member"] : null;
        $storeId   = isset($_GET["store"])  ? (int)$_GET["store"]  : null;
        $category  = $_GET["category"] ?? null;
        $filter    = $_GET["filter"]   ?? null;
        $startDate = $_GET["start"]    ?? null;
        $endDate   = $_GET["end"]      ?? null;

        // Get data
        $tasks = $this->taskModel->getAllTasksForCeo(
            $memberId, $storeId, $category, $filter, $startDate, $endDate, 500
        );

        // Member list for dropdown
        $members = $db->fetchAll(
            "SELECT id, name FROM users WHERE is_active = 1 ORDER BY name"
        );

        // Store list
        $stores = $db->fetchAll(
            "SELECT id, name, color FROM stores WHERE is_active = 1 ORDER BY name"
        );

        // Stats
        $stats = [
            "total"       => count($tasks),
            "overdue"     => count(array_filter($tasks, fn($t) => !empty($t["due_date"]) && $t["due_date"] < app_today() && empty($t["is_completed"]))),
            "completed"   => count(array_filter($tasks, fn($t) => !empty($t["is_completed"]))),
            "open"        => count(array_filter($tasks, fn($t) => empty($t["is_completed"]))),
            "by_category" => [],
        ];
        foreach ($tasks as $t) {
            $cat = $t["task_category"] ?? "store_operation";
            if (!isset($stats["by_category"][$cat])) $stats["by_category"][$cat] = 0;
            $stats["by_category"][$cat]++;
        }

        $categories = ["payroll","tax","sale_receipt","bill","payment","store_operation","admin","other"];
        $filters = ["overdue","today","this_week","completed","open"];

        $notifications = new Notification();
        require __DIR__ . "/../views/admin/task_audit/all_tasks.php";
    }

    // STORE TASK GROUPING

    /**
     * GET /admin/tasks/by-store
     * All tasks grouped by store for CEO dashboard.
     */
    public function byStore() {
        $storeId  = isset($_GET["store"]) ? (int)$_GET["store"] : null;
        $category = $_GET["category"] ?? null;
        $filter   = $_GET["filter"] ?? null;
        $startDate = $_GET["start"] ?? null;
        $endDate   = $_GET["end"] ?? null;

        $grouped = $this->taskModel->getAllByStore(
            null, $storeId, $category, $filter, $startDate, $endDate, true, 500
        );

        // Store summaries
        $db = Database::getInstance();
        $stores = $db->fetchAll("SELECT id, name, color FROM stores WHERE is_active = 1 ORDER BY name");
        $storeSummaries = [];
        foreach ($grouped as $sid => $group) {
            $tasks = $group["tasks"];
            $storeSummaries[$sid] = [
                "total"     => count($tasks),
                "overdue"   => count(array_filter($tasks, fn($t) => !empty($t["due_date"]) && $t["due_date"] < app_today() && empty($t["is_completed"]))),
                "completed" => count(array_filter($tasks, fn($t) => !empty($t["is_completed"]))),
                "open"      => count(array_filter($tasks, fn($t) => empty($t["is_completed"]))),
                "submitted" => count(array_filter($tasks, fn($t) => !empty($t["submitted_at"]) && empty($t["checked_at"]))),
                "accepted"  => count(array_filter($tasks, fn($t) => !empty($t["accepted_workflow_at"]))),
            ];
        }

        $notifications = new Notification();
        require __DIR__ . "/../views/admin/task_audit/by_store.php";
    }

    // WORKFLOW QUEUE

    /**
     * GET /admin/tasks/workflow
     * View tasks in workflow stages.
     */
    public function workflow() {
        $db = Database::getInstance();
        $stage = $_GET["stage"] ?? "submitted";
        $storeId = isset($_GET["store"]) ? (int)$_GET["store"] : null;

        $stages = ["submitted","checking","accepted","rejected"];
        if (!in_array($stage, $stages)) $stage = "submitted";

        $tasks = $this->taskModel->getByWorkflowStage($stage, $storeId, 100);

        $stores = $db->fetchAll("SELECT id, name, color FROM stores WHERE is_active = 1 ORDER BY name");
        $notifications = new Notification();
        $pageTitle = 'Task Workflow Queue';
        $currentPage = 'admin';
        ob_start();
        require __DIR__ . "/../views/admin/task_audit/workflow.php";
        $content = ob_get_clean();
        require __DIR__ . "/../views/layouts/main.php";
    }

    /**
     * POST /admin/tasks/workflow/check
     */
    public function workflowCheck() {
        $this->verifyCsrfOrExit($_POST["csrf"] ?? "");
        $taskId = (int)($_POST["task_id"] ?? 0);
        $note = trim($_POST["note"] ?? "");
        if (!$taskId) redirect("admin/tasks/workflow");

        $ok = $this->taskModel->markChecked($taskId, (int)$_SESSION["user_id"], $note ?: null);
        flash($ok ? "success" : "error", $ok ? "Marked as checked." : "Failed.");
        redirect("admin/tasks/workflow?stage=checking");
    }

    /**
     * POST /admin/tasks/workflow/accept
     */
    public function workflowAccept() {
        $this->verifyCsrfOrExit($_POST["csrf"] ?? "");
        $taskId = (int)($_POST["task_id"] ?? 0);
        $note = trim($_POST["note"] ?? "");
        if (!$taskId) redirect("admin/tasks/workflow");

        $ok = $this->taskModel->acceptWorkflow($taskId, (int)$_SESSION["user_id"], $note ?: null);
        flash($ok ? "success" : "error", $ok ? "Task accepted and completed." : "Failed.");
        redirect("admin/tasks/workflow?stage=accepted");
    }

    /**
     * POST /admin/tasks/workflow/reject
     */
    public function workflowReject() {
        $this->verifyCsrfOrExit($_POST["csrf"] ?? "");
        $taskId = (int)($_POST["task_id"] ?? 0);
        $reason = trim($_POST["reason"] ?? "No reason provided");
        if (!$taskId) redirect("admin/tasks/workflow");

        $ok = $this->taskModel->rejectWorkflow($taskId, (int)$_SESSION["user_id"], $reason);
        flash($ok ? "success" : "error", $ok ? "Task rejected." : "Failed.");
        redirect("admin/tasks/workflow?stage=rejected");
    }

    /**
     * POST /admin/tasks/workflow/reopen
     */
    public function workflowReopen() {
        $this->verifyCsrfOrExit($_POST["csrf"] ?? "");
        $taskId = (int)($_POST["task_id"] ?? 0);
        if (!$taskId) redirect("admin/tasks/workflow");

        $ok = $this->taskModel->reopenWorkflow($taskId, (int)$_SESSION["user_id"]);
        flash($ok ? "success" : "error", $ok ? "Task reopened." : "Failed.");
        redirect("admin/tasks/workflow");
    }

    // HELPER
    private function verifyCsrfOrExit($token) {
        if (!verify_csrf($token)) {
            flash("error", "Invalid security token.");
            redirect("admin/tasks");
        }
    }
}
