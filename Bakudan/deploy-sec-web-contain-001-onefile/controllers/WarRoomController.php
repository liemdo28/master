<?php
/**
 * Phase 8 — Module 10: Executive War Room Controller
 * 
 * /ceo/war-room — Crisis command for major incidents
 */
require_once __DIR__ . '/../config/phase8.php';
require_once __DIR__ . '/../models/CrossModuleAutomation.php';
require_once __DIR__ . '/../models/NotificationHub.php';

class WarRoomController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * GET /ceo/war-room — War Room Dashboard
     */
    public function index(): void
    {
        if (!isAdmin()) {
            header('Location: /dashboard');
            exit;
        }

        $activeSessions = $this->getActiveSessions();
        $allSessions = $this->getAllSessions(20);

        // Get critical data
        $criticalData = $this->getCriticalData();

        $pageTitle = 'War Room';
        $currentPage = 'ceo-war-room';
        ob_start();
        require __DIR__ . '/../views/ceo/war-room.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * POST /ceo/war-room — Create new war room session
     */
    public function create(): void
    {
        if (!isAdmin()) json_response(['error' => 'Unauthorized'], 403);

        $title = $_POST['title'] ?? 'Emergency Session';
        $severity = $_POST['severity'] ?? 'critical';
        $category = $_POST['category'] ?? 'incident';
        $storeId = !empty($_POST['store_id']) ? (int)$_POST['store_id'] : null;
        $participants = json_decode($_POST['participants'] ?? '[]', true);

        $stmt = $this->db->prepare("
            INSERT INTO war_room_sessions (title, severity, category, status, initiated_by, store_id, participants, timeline)
            VALUES (?, ?, ?, 'active', ?, ?, ?, '[]')
        ");
        $stmt->execute([$title, $severity, $category, $_SESSION['user_id'] ?? 0, $storeId, json_encode($participants)]);

        $sessionId = (int)$this->db->lastInsertId();

        // Add creation event to timeline
        $this->addTimelineEvent($sessionId, 'session_created', "War room '{$title}' initiated");

        // Alert participants
        $hub = new NotificationHub();
        foreach ($participants as $userId) {
            $hub->send($userId, 'dashboard', 'war_room', 'critical',
                "War Room Activated: {$title}",
                "You have been added to an active war room session.",
                "/ceo/war-room/{$sessionId}"
            );
        }

        json_response(['success' => true, 'id' => $sessionId]);
    }

    /**
     * GET /ceo/war-room/{id} — War room session detail
     */
    public function view(int $id): void
    {
        if (!isAdmin()) json_response(['error' => 'Unauthorized'], 403);

        $session = $this->getSession($id);
        if (!$session) {
            header('Location: /ceo/war-room');
            exit;
        }

        // Get related data
        $timeline = json_decode($session['timeline'], true) ?: [];
        $actionItems = json_decode($session['action_items'], true) ?: [];

        $pageTitle = 'War Room — ' . e($session['title'] ?? 'Session');
        $currentPage = 'ceo-war-room';
        ob_start();
        require __DIR__ . '/../views/ceo/war-room-view.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * POST /ceo/war-room/{id}/timeline — Add timeline event
     */
    public function addTimeline(int $id): void
    {
        if (!isAdmin()) json_response(['error' => 'Unauthorized'], 403);

        $event = $_POST['event'] ?? '';
        $description = $_POST['description'] ?? '';

        $this->addTimelineEvent($id, $event, $description);

        json_response(['success' => true]);
    }

    /**
     * POST /ceo/war-room/{id}/action — Add action item
     */
    public function addAction(int $id): void
    {
        if (!isAdmin()) json_response(['error' => 'Unauthorized'], 403);

        $action = $_POST['action'] ?? '';
        $assignedTo = (int)($_POST['assigned_to'] ?? 0);
        $dueDate = $_POST['due_date'] ?? null;

        $stmt = $this->db->prepare("SELECT action_items FROM war_room_sessions WHERE id = ?");
        $stmt->execute([$id]);
        $session = $stmt->fetch(PDO::FETCH_ASSOC);

        $items = json_decode($session['action_items'] ?? '[]', true) ?: [];
        $items[] = [
            'id' => count($items) + 1,
            'action' => $action,
            'assigned_to' => $assignedTo,
            'due_date' => $dueDate,
            'status' => 'pending',
            'created_at' => date('Y-m-d H:i:s'),
        ];

        $stmt = $this->db->prepare("UPDATE war_room_sessions SET action_items = ? WHERE id = ?");
        $stmt->execute([json_encode($items), $id]);

        $this->addTimelineEvent($id, 'action_added', "Action added: {$action}");

        json_response(['success' => true]);
    }

    /**
     * POST /ceo/war-room/{id}/resolve — Resolve session
     */
    public function resolve(int $id): void
    {
        if (!isAdmin()) json_response(['error' => 'Unauthorized'], 403);

        $resolution = $_POST['resolution'] ?? '';

        $stmt = $this->db->prepare("UPDATE war_room_sessions SET status = 'resolved', resolution = ?, resolved_at = NOW() WHERE id = ?");
        $stmt->execute([$resolution, $id]);

        $this->addTimelineEvent($id, 'session_resolved', "War room resolved: {$resolution}");

        json_response(['success' => true]);
    }

    /**
     * POST /ceo/war-room/{id}/status — Update session status
     */
    public function updateStatus(int $id): void
    {
        if (!isAdmin()) json_response(['error' => 'Unauthorized'], 403);

        $status = $_POST['status'] ?? 'monitoring';
        $stmt = $this->db->prepare("UPDATE war_room_sessions SET status = ? WHERE id = ?");
        $stmt->execute([$status, $id]);

        $this->addTimelineEvent($id, 'status_changed', "Status changed to: {$status}");

        json_response(['success' => true]);
    }

    // ─── PRIVATE ──────────────────────────────────────────────────

    private function getActiveSessions(): array
    {
        if (!$this->db->tableExists('war_room_sessions')) return [];
        return $this->db->fetchAll("SELECT * FROM war_room_sessions WHERE status IN ('active','monitoring') ORDER BY started_at DESC");
    }

    private function getAllSessions(int $limit = 20): array
    {
        if (!$this->db->tableExists('war_room_sessions')) return [];
        return $this->db->fetchAll("SELECT * FROM war_room_sessions ORDER BY started_at DESC LIMIT " . (int)$limit);
    }

    private function getSession(int $id): ?array
    {
        if (!$this->db->tableExists('war_room_sessions')) return null;
        $session = $this->db->fetch("SELECT * FROM war_room_sessions WHERE id = ?", [$id]);
        return $session ?: null;
    }

    private function getCriticalData(): array
    {
        $data = ['critical_predictions' => 0, 'overdue_tasks' => 0, 'overdue_bills' => 0, 'today_incidents' => 0];

        if ($this->db->tableExists('predictions')) {
            $row = $this->db->fetch("SELECT COUNT(*) as c FROM predictions WHERE status = 'active' AND severity IN ('critical','high')");
            $data['critical_predictions'] = (int)($row['c'] ?? 0);
        }
        if ($this->db->tableExists('tasks')) {
            $row = $this->db->fetch("SELECT COUNT(*) as c FROM tasks WHERE status NOT IN ('done','cancelled') AND due_date < CURDATE()");
            $data['overdue_tasks'] = (int)($row['c'] ?? 0);
        }
        if ($this->db->tableExists('bills')) {
            $row = $this->db->fetch("SELECT COUNT(*) as c FROM bills WHERE status = 'pending' AND due_date < CURDATE()");
            $data['overdue_bills'] = (int)($row['c'] ?? 0);
        }
        if ($this->db->tableExists('automation_events')) {
            $row = $this->db->fetch("SELECT COUNT(*) as c FROM automation_events WHERE source_module = 'incidents' AND created_at >= CURDATE()");
            $data['today_incidents'] = (int)($row['c'] ?? 0);
        }

        return $data;
    }

    private function addTimelineEvent(int $sessionId, string $event, string $description): void
    {
        $stmt = $this->db->prepare("SELECT timeline FROM war_room_sessions WHERE id = ?");
        $stmt->execute([$sessionId]);
        $timeline = json_decode($stmt->fetchColumn() ?: '[]', true) ?: [];

        $timeline[] = [
            'timestamp' => date('Y-m-d H:i:s'),
            'event' => $event,
            'description' => $description,
            'user_id' => $_SESSION['user_id'] ?? 0,
        ];

        $stmt = $this->db->prepare("UPDATE war_room_sessions SET timeline = ? WHERE id = ?");
        $stmt->execute([json_encode($timeline), $sessionId]);
    }
}
