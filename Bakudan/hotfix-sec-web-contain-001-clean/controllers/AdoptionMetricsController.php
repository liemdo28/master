<?php
/**
 * Phase 11.6 — Adoption Metrics Dashboard
 * /admin/adoption-metrics — View usage analytics for Phase 11.5 features
 */
require_once __DIR__ . '/../service/UsageTracker.php';

class AdoptionMetricsController
{
    /**
     * GET /admin/adoption-metrics
     */
    public function index(): void
    {
        if (!canAdmin()) { redirect('/dashboard'); return; }

        $from = $_GET['from'] ?? date('Y-m-d', strtotime('-7 days'));
        $to = $_GET['to'] ?? date('Y-m-d');

        $summary = UsageTracker::getSummary($from, $to);

        // Feature adoption KPIs
        $kpis = $this->computeKPIs($from, $to);

        $pageTitle = 'Adoption Metrics';
        $currentPage = 'adoption-metrics';

        ob_start();
        include __DIR__ . '/../views/admin/adoption_metrics.php';
        $content = ob_get_clean();
        include __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * GET /api/admin/adoption-metrics — JSON
     */
    public function apiMetrics(): void
    {
        if (!canAdmin()) { http_response_code(403); echo json_encode(['error' => 'Forbidden']); return; }

        header('Content-Type: application/json');
        $from = $_GET['from'] ?? date('Y-m-d', strtotime('-7 days'));
        $to = $_GET['to'] ?? date('Y-m-d');

        $summary = UsageTracker::getSummary($from, $to);
        $kpis = $this->computeKPIs($from, $to);

        echo json_encode(['summary' => $summary, 'kpis' => $kpis]);
    }

    private function computeKPIs(string $from, string $to): array
    {
        try {
            $db = Database::getInstance();
            $params = [$from . ' 00:00:00', $to . ' 23:59:59'];

            // Search adoption
            $searchCount = (int)($db->fetch(
                "SELECT COUNT(*) as cnt FROM usage_events WHERE event = 'search' AND created_at BETWEEN ? AND ?", $params
            )['cnt'] ?? 0);

            // Workspace as entry point
            $workspaceViews = (int)($db->fetch(
                "SELECT COUNT(*) as cnt FROM usage_events WHERE event = 'workspace_view' AND created_at BETWEEN ? AND ?", $params
            )['cnt'] ?? 0);

            // FAB usage vs total creations
            $fabCreations = (int)($db->fetch(
                "SELECT COUNT(*) as cnt FROM usage_events WHERE event LIKE 'fab_%' AND created_at BETWEEN ? AND ?", $params
            )['cnt'] ?? 0);

            // Notification interactions
            $notifInteractions = (int)($db->fetch(
                "SELECT COUNT(*) as cnt FROM usage_events WHERE event LIKE 'notification_%' AND created_at BETWEEN ? AND ?", $params
            )['cnt'] ?? 0);

            // Control Tower visits
            $controlTowerVisits = (int)($db->fetch(
                "SELECT COUNT(*) as cnt FROM usage_events WHERE event = 'control_tower_view' AND created_at BETWEEN ? AND ?", $params
            )['cnt'] ?? 0);

            // Release artifact views
            $artifactViews = (int)($db->fetch(
                "SELECT COUNT(*) as cnt FROM usage_events WHERE event = 'release_artifacts_view' AND created_at BETWEEN ? AND ?", $params
            )['cnt'] ?? 0);

            // Health monitor views
            $healthViews = (int)($db->fetch(
                "SELECT COUNT(*) as cnt FROM usage_events WHERE event = 'health_monitor_view' AND created_at BETWEEN ? AND ?", $params
            )['cnt'] ?? 0);

            // Activity feed views
            $activityViews = (int)($db->fetch(
                "SELECT COUNT(*) as cnt FROM usage_events WHERE event = 'activity_feed_view' AND created_at BETWEEN ? AND ?", $params
            )['cnt'] ?? 0);

            // Unique daily active users
            $dau = (int)($db->fetch(
                "SELECT COUNT(DISTINCT user_id) as cnt FROM usage_events WHERE created_at BETWEEN ? AND ?", $params
            )['cnt'] ?? 0);

            $days = max(1, (strtotime($to) - strtotime($from)) / 86400);

            return [
                'search_usage' => $searchCount,
                'workspace_views' => $workspaceViews,
                'fab_creations' => $fabCreations,
                'notification_interactions' => $notifInteractions,
                'control_tower_visits' => $controlTowerVisits,
                'release_artifact_views' => $artifactViews,
                'health_monitor_views' => $healthViews,
                'activity_feed_views' => $activityViews,
                'daily_active_users' => $dau,
                'avg_events_per_day' => round(($searchCount + $workspaceViews + $fabCreations + $notifInteractions + $controlTowerVisits) / $days, 1),
            ];
        } catch (\Throwable $e) {
            return ['error' => 'Unable to compute KPIs'];
        }
    }
}
