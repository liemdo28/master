<?php
class MonthlyExtensionUsage {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    public function getOrCreate(int $userId, string $yearMonth): array {
        $row = $this->db->fetch(
            "SELECT * FROM monthly_extension_usage WHERE user_id=? AND year_month=?",
            [$userId, $yearMonth]
        );
        if (!$row) {
            $this->db->execute(
                "INSERT IGNORE INTO monthly_extension_usage (user_id, year_month, used_count, quota) VALUES (?,?,0,5)",
                [$userId, $yearMonth]
            );
            $row = $this->db->fetch(
                "SELECT * FROM monthly_extension_usage WHERE user_id=? AND year_month=?",
                [$userId, $yearMonth]
            );
        }
        return $row ?? ['user_id' => $userId, 'year_month' => $yearMonth, 'used_count' => 0, 'quota' => 5];
    }

    public function getRemainingQuota(int $userId): int {
        $ym  = date('Y-m');
        $row = $this->getOrCreate($userId, $ym);
        return max(0, (int)$row['quota'] - (int)$row['used_count']);
    }

    public function increment(int $userId): void {
        $ym = date('Y-m');
        $this->getOrCreate($userId, $ym);
        $this->db->execute(
            "UPDATE monthly_extension_usage SET used_count=used_count+1 WHERE user_id=? AND year_month=?",
            [$userId, $ym]
        );
    }
}
