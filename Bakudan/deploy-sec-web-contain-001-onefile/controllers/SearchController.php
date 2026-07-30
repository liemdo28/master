<?php
/**
 * Phase 11.5 — Module 1: Global Search
 * /search — Full-page search across all entities
 */

class SearchController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * GET /search?q=...&type=all
     */
    public function index(): void
    {
        $q = trim($_GET['q'] ?? '');
        $type = $_GET['type'] ?? 'all';
        $results = [];

        if (strlen($q) >= 2) {
            try { $results = $this->search($q, $type); } catch (\Throwable $e) { error_log('[Search] ' . $e->getMessage()); }
            try { UsageTracker::log('search', ['query' => $q, 'type' => $type, 'results' => count($results)]); } catch (\Throwable $e) {}
        }

        $pageTitle = 'Search';
        $currentPage = 'search';
        $searchQuery = $q;
        $searchType = $type;
        $searchResults = $results;

        ob_start();
        include __DIR__ . '/../views/search/index.php';
        $content = ob_get_clean();
        include __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * GET /api/search?q=...&type=all — JSON endpoint for live search
     */
    public function apiSearch(): void
    {
        header('Content-Type: application/json');
        $q = trim($_GET['q'] ?? '');
        $type = $_GET['type'] ?? 'all';

        if (strlen($q) < 2) {
            echo json_encode(['results' => [], 'total' => 0]);
            return;
        }

        $results = $this->search($q, $type);
        echo json_encode(['results' => $results, 'total' => count($results)]);
    }

    private function search(string $q, string $type): array
    {
        $results = [];
        $like = '%' . $q . '%';
        $userId = $_SESSION['user_id'] ?? 0;
        $isAdmin = canAdmin() || canManage();

        // Tasks
        if ($type === 'all' || $type === 'tasks') {
            $tasks = $this->db->fetchAll(
                "SELECT id, title, status, due_date, priority
                 FROM tasks
                 WHERE (title LIKE ? OR description LIKE ?)
                 " . (!$isAdmin ? "AND (assignee_id = ? OR creator_id = ?)" : "") . "
                 ORDER BY created_at DESC LIMIT 20",
                $isAdmin ? [$like, $like] : [$like, $like, $userId, $userId]
            );
            foreach ($tasks as $t) {
                $results[] = [
                    'type' => 'task',
                    'id' => $t['id'],
                    'title' => $t['title'],
                    'subtitle' => ucfirst($t['status']) . ($t['due_date'] ? ' · Due ' . date('M j', strtotime($t['due_date'])) : ''),
                    'url' => '/tasks/' . $t['id'],
                    'priority' => $t['priority'] ?? 'medium',
                ];
            }
        }

        // Employees/Users
        if ($type === 'all' || $type === 'employees') {
            if ($isAdmin) {
                $users = $this->db->fetchAll(
                    "SELECT id, name, email, role FROM users WHERE (name LIKE ? OR email LIKE ?) ORDER BY name LIMIT 20",
                    [$like, $like]
                );
                foreach ($users as $u) {
                    $results[] = [
                        'type' => 'employee',
                        'id' => $u['id'],
                        'title' => $u['name'],
                        'subtitle' => $u['email'] . ' · ' . ucfirst($u['role']),
                        'url' => '/team/member/' . $u['id'],
                    ];
                }
            }
        }

        // Stores
        if ($type === 'all' || $type === 'stores') {
            if ($isAdmin) {
                $stores = $this->db->fetchAll(
                    "SELECT id, name, location, status FROM stores WHERE (name LIKE ? OR location LIKE ?) ORDER BY name LIMIT 20",
                    [$like, $like]
                );
                foreach ($stores as $s) {
                    $results[] = [
                        'type' => 'store',
                        'id' => $s['id'],
                        'title' => $s['name'],
                        'subtitle' => ($s['location'] ?? '') . ' · ' . ucfirst($s['status'] ?? 'active'),
                        'url' => '/overview/store/' . $s['id'],
                    ];
                }
            }
        }

        // Incidents
        if ($type === 'all' || $type === 'incidents') {
            if ($isAdmin && $this->db->tableExists('incidents')) {
                $incidents = $this->db->fetchAll(
                    "SELECT id, title, severity, status, created_at FROM incidents WHERE (title LIKE ? OR description LIKE ?) ORDER BY created_at DESC LIMIT 20",
                    [$like, $like]
                );
                foreach ($incidents as $i) {
                    $results[] = [
                        'type' => 'incident',
                        'id' => $i['id'],
                        'title' => $i['title'],
                        'subtitle' => ucfirst($i['severity'] ?? 'medium') . ' · ' . ucfirst($i['status'] ?? 'open'),
                        'url' => '/incidents/' . $i['id'],
                    ];
                }
            }
        }

        // Releases
        if ($type === 'all' || $type === 'releases') {
            if ($isAdmin && $this->db->tableExists('releases')) {
                $releases = $this->db->fetchAll(
                    "SELECT id, name, version, status FROM releases WHERE (name LIKE ? OR version LIKE ? OR release_notes LIKE ?) ORDER BY created_at DESC LIMIT 20",
                    [$like, $like, $like]
                );
                foreach ($releases as $r) {
                    $results[] = [
                        'type' => 'release',
                        'id' => $r['id'],
                        'title' => $r['name'],
                        'subtitle' => ($r['version'] ?? '') . ' · ' . ucfirst($r['status'] ?? 'draft'),
                        'url' => '/admin/releases/' . $r['id'],
                    ];
                }
            }
        }

        // Bills
        if ($type === 'all' || $type === 'bills') {
            if ($isAdmin) {
                $bills = $this->db->fetchAll(
                    "SELECT id, vendor, amount, due_date, status FROM bills WHERE (vendor LIKE ? OR description LIKE ?) ORDER BY due_date DESC LIMIT 20",
                    [$like, $like]
                );
                foreach ($bills as $b) {
                    $results[] = [
                        'type' => 'bill',
                        'id' => $b['id'],
                        'title' => $b['vendor'],
                        'subtitle' => '$' . number_format($b['amount'] ?? 0, 2) . ' · ' . ucfirst($b['status'] ?? 'pending'),
                        'url' => '/bills/' . $b['id'],
                    ];
                }
            }
        }

        // Projects
        if ($type === 'all' || $type === 'projects') {
            $projects = $this->db->fetchAll(
                "SELECT id, name, status FROM projects WHERE name LIKE ? ORDER BY name LIMIT 20",
                [$like]
            );
            foreach ($projects as $p) {
                $results[] = [
                    'type' => 'project',
                    'id' => $p['id'],
                    'title' => $p['name'],
                    'subtitle' => ucfirst($p['status'] ?? 'active'),
                    'url' => '/projects/' . $p['id'],
                ];
            }
        }

        return $results;
    }
}
