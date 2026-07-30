<?php
/**
 * WalkthroughLibraryController — Phase 11.7
 * Admin library for reviewing all walkthrough records across releases and roles.
 * Route: /admin/walkthrough-library
 */
require_once __DIR__ . '/../models/Release.php';
require_once __DIR__ . '/../models/User.php';

class WalkthroughLibraryController
{
    private Release $releaseModel;
    private User $userModel;

    public function __construct()
    {
        $this->releaseModel = new Release();
        $this->userModel = new User();
    }

    private function requireAdmin(): void
    {
        if (!canAdmin()) {
            header('Location: /dashboard');
            exit;
        }
    }

    /**
     * GET /admin/walkthrough-library
     * Full library view with filters by role, release, result.
     */
    public function index(): void
    {
        $this->requireAdmin();

        $db = Database::getInstance();

        // Build filter conditions from query params
        $roleFilter   = trim($_GET['role']   ?? '');
        $resultFilter = trim($_GET['result'] ?? '');
        $releaseId    = (int)($_GET['release_id'] ?? 0);

        $where = ['1=1'];
        $params = [];

        if ($roleFilter && in_array($roleFilter, ['ceo','manager','member','admin','release_qa'])) {
            $where[] = "r.walkthrough_{$roleFilter} IS NOT NULL";
        }
        if ($resultFilter && in_array($resultFilter, ['pass','fail','pending'])) {
            $role = $roleFilter ?: 'ceo';
            $where[] = "r.walkthrough_{$role} = ?";
            $params[] = $resultFilter;
        }
        if ($releaseId > 0) {
            $where[] = 'r.id = ?';
            $params[] = $releaseId;
        }

        $whereClause = implode(' AND ', $where);

        // Fetch releases with any walkthrough status
        $releases = $db->fetchAll(
            "SELECT r.id, r.version, r.status, r.scheduled_at, r.published_at,
                    r.walkthrough_ceo, r.walkthrough_manager, r.walkthrough_member,
                    r.walkthrough_admin, r.walkthrough_release_qa,
                    u.name AS owner_name
             FROM releases r
             LEFT JOIN users u ON r.owner_id = u.id
             WHERE ({$whereClause})
               AND (
                   r.walkthrough_ceo IS NOT NULL OR r.walkthrough_manager IS NOT NULL
                   OR r.walkthrough_member IS NOT NULL OR r.walkthrough_admin IS NOT NULL
                   OR r.walkthrough_release_qa IS NOT NULL
               )
             ORDER BY COALESCE(r.published_at, r.scheduled_at) DESC
             LIMIT 100",
            $params
        );

        // Fetch all releases for dropdown
        $allReleases = $db->fetchAll(
            "SELECT id, version FROM releases ORDER BY published_at DESC LIMIT 200"
        );

        // Compute summary stats
        $stats = $db->fetch(
            "SELECT
                 SUM(walkthrough_ceo     = 'pass') AS ceo_pass,
                 SUM(walkthrough_ceo     = 'fail') AS ceo_fail,
                 SUM(walkthrough_ceo     = 'pending') AS ceo_pending,
                 SUM(walkthrough_manager = 'pass') AS manager_pass,
                 SUM(walkthrough_manager = 'fail') AS manager_fail,
                 SUM(walkthrough_manager = 'pending') AS manager_pending,
                 SUM(walkthrough_member  = 'pass') AS member_pass,
                 SUM(walkthrough_member  = 'fail') AS member_fail,
                 SUM(walkthrough_member  = 'pending') AS member_pending,
                 SUM(walkthrough_admin   = 'pass') AS admin_pass,
                 SUM(walkthrough_admin   = 'fail') AS admin_fail,
                 SUM(walkthrough_admin   = 'pending') AS admin_pending,
                 SUM(walkthrough_release_qa = 'pass') AS qa_pass,
                 SUM(walkthrough_release_qa = 'fail') AS qa_fail,
                 SUM(walkthrough_release_qa = 'pending') AS qa_pending,
                 COUNT(*) AS total_releases
             FROM releases
             WHERE walkthrough_ceo IS NOT NULL
                OR walkthrough_manager IS NOT NULL
                OR walkthrough_member IS NOT NULL
                OR walkthrough_admin IS NOT NULL
                OR walkthrough_release_qa IS NOT NULL"
        );

        $this->render('admin/walkthrough-library/index', [
            'releases'     => $releases,
            'allReleases' => $allReleases,
            'stats'       => $stats,
            'filters'     => [
                'role'   => $roleFilter,
                'result' => $resultFilter,
                'release_id' => $releaseId,
            ],
            'title'       => 'Walkthrough Library',
        ]);
    }

    /**
     * API: GET /api/admin/walkthrough-library/summary
     * JSON summary for dashboard widgets.
     */
    public function apiSummary(): void
    {
        $this->requireAdmin();
        header('Content-Type: application/json');

        $db = Database::getInstance();

        $stats = $db->fetch(
            "SELECT
                 SUM(walkthrough_ceo       = 'pass') AS ceo_pass,
                 SUM(walkthrough_manager    = 'pass') AS manager_pass,
                 SUM(walkthrough_member     = 'pass') AS member_pass,
                 SUM(walkthrough_admin      = 'pass') AS admin_pass,
                 SUM(walkthrough_release_qa = 'pass') AS qa_pass,
                 SUM(walkthrough_ceo       = 'pending') +
                 SUM(walkthrough_manager    = 'pending') +
                 SUM(walkthrough_member     = 'pending') +
                 SUM(walkthrough_admin      = 'pending') +
                 SUM(walkthrough_release_qa = 'pending') AS total_pending,
                 SUM(walkthrough_ceo       = 'fail') +
                 SUM(walkthrough_manager    = 'fail') +
                 SUM(walkthrough_member     = 'fail') +
                 SUM(walkthrough_admin      = 'fail') +
                 SUM(walkthrough_release_qa = 'fail') AS total_fail,
                 COUNT(*) AS total_releases
             FROM releases
             WHERE walkthrough_ceo IS NOT NULL"
        );

        // Recent walkthrough completions
        $recent = $db->fetchAll(
            "SELECT r.id, r.version,
                    r.walkthrough_ceo, r.walkthrough_manager,
                    r.walkthrough_member, r.walkthrough_admin,
                    r.walkthrough_release_qa,
                    r.published_at
             FROM releases r
             WHERE (r.walkthrough_ceo IS NOT NULL
                 OR r.walkthrough_manager IS NOT NULL
                 OR r.walkthrough_member IS NOT NULL
                 OR r.walkthrough_admin IS NOT NULL)
               AND r.status = 'live'
             ORDER BY r.published_at DESC
             LIMIT 10"
        );

        echo json_encode([
            'stats'   => $stats,
            'recent'  => $recent,
            'generated_at' => date('c'),
        ], JSON_THROW_ON_ERROR);
    }

    private function render(string $view, array $data = []): void
    {
        extract($data);
        $currentPage = 'walkthrough-library';
        $pageTitle = $title ?? 'Walkthrough Library';
        ob_start();
        include __DIR__ . '/../views/' . $view . '.php';
        $content = ob_get_clean();
        include __DIR__ . '/../views/layouts/main.php';
    }
}
