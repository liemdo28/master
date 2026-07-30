<?php
class MonthlyExtensionUsageService {
    private MonthlyExtensionUsage $model;

    public function __construct() {
        $this->model = new MonthlyExtensionUsage();
    }

    public function getStatus(int $userId): array {
        return (new DeadlineExtensionService())->getQuotaStatus($userId);
    }

    public function getLeaderboard(): array {
        $db = Database::getInstance();
        $ym = date('Y-m');
        return $db->fetchAll(
            "SELECT u.id, u.name, u.avatar, COALESCE(m.used_count,0) as used_count, COALESCE(m.quota,5) as quota
             FROM users u
             LEFT JOIN monthly_extension_usage m ON u.id=m.user_id AND m.year_month=?
             WHERE u.is_active=1
             ORDER BY used_count DESC
             LIMIT 20",
            [$ym]
        );
    }
}
