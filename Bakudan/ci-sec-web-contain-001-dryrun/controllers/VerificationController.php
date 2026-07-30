<?php
class VerificationController
{
    private UniversalVerificationEngine $engine;

    public function __construct(?UniversalVerificationEngine $engine = null)
    {
        $this->engine = $engine ?: new UniversalVerificationEngine();
    }

    public function apiSummary(): void
    {
        header('Content-Type: application/json');
        $role = $_SESSION['role'] ?? 'member';
        $metrics = $this->engine->buildDashboardMetrics($role);

        echo json_encode([
            'success' => true,
            'preview' => true,
            'enforcement_enabled' => getenv('VERIFICATION_ENGINE_ENFORCE') === '1',
            'role' => $role,
            'data' => [
                'team_health_score' => $this->teamHealthScore($metrics),
                'stores_at_risk' => [],
                'pending_verifications' => $metrics['pending_verifications'],
                'overdue_verifications' => $metrics['overdue_verifications'],
                'pending_payroll_reviews' => null,
                'pending_payment_reviews' => null,
                'suggested_penalties' => $metrics['suggested_penalties'],
                'repeated_delays' => [],
                'verification_bottlenecks' => $metrics['verification_bottlenecks'],
                'top_operational_risks' => $this->topRisks($metrics),
            ],
        ]);
    }

    public function rulesScreen(): void
    {
        if (!function_exists('isAdmin') || !isAdmin()) {
            if (function_exists('redirect')) {
                redirect('overview');
                return;
            }
            http_response_code(403);
            echo 'Forbidden';
            return;
        }

        $notifications = class_exists('Notification') ? new Notification() : null;
        $unreadCount = $notifications ? $notifications->getUnreadCount($_SESSION['user_id']) : 0;
        $projects = class_exists('Project') ? (new Project())->getByUser($_SESSION['user_id'], true) : [];
        $users = class_exists('User') ? (new User())->getActive() : [];
        require __DIR__ . '/../views/admin/verification_rules.php';
    }

    public function apiAccountingSummary(): void
    {
        header('Content-Type: application/json');
        $role = $_SESSION['role'] ?? 'member';
        if (!in_array($role, ['accounting', 'admin', 'ceo'], true)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Accounting verification access required']);
            return;
        }

        $metrics = $this->engine->buildDashboardMetrics('accounting');
        echo json_encode([
            'success' => true,
            'preview' => true,
            'enforcement_enabled' => getenv('VERIFICATION_ENGINE_ENFORCE') === '1',
            'data' => [
                'bills_awaiting_verification' => null,
                'payments_awaiting_verification' => null,
                'payroll_awaiting_verification' => null,
                'financial_confirmations_pending' => $metrics['pending_verifications'],
                'verification_sla' => [
                    'pending' => $metrics['pending_verifications'],
                    'overdue' => $metrics['overdue_verifications'],
                ],
            ],
        ]);
    }

    private function teamHealthScore(array $metrics): int
    {
        $pending = (int)($metrics['pending_verifications'] ?? 0);
        $overdue = (int)($metrics['overdue_verifications'] ?? 0);
        return max(0, min(100, 100 - ($pending * 2) - ($overdue * 8)));
    }

    private function topRisks(array $metrics): array
    {
        $risks = [];
        if ((int)($metrics['overdue_verifications'] ?? 0) > 0) {
            $risks[] = 'Overdue verifications are blocking completion.';
        }
        if ((int)($metrics['suggested_penalties'] ?? 0) > 0) {
            $risks[] = 'Suggested penalties require admin review.';
        }
        return $risks;
    }
}
