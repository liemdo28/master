<?php
require_once __DIR__ . '/../service/UniversalVerificationEngine.php';

function assertTrue($condition, string $message): void {
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$now = new DateTimeImmutable('2026-06-02 12:00:00');

$dueTomorrow = new DateTimeImmutable('2026-06-03 10:00:00');
$stages = UniversalVerificationEngine::reminderStages($dueTomorrow, $now);
assertTrue(in_array('24h_before_due', $stages, true), '24h reminder is generated');

$dueInTwoHours = new DateTimeImmutable('2026-06-02 14:00:00');
$stages = UniversalVerificationEngine::reminderStages($dueInTwoHours, $now);
assertTrue(in_array('3h_before_due', $stages, true), '3h reminder is generated');

$dueThreeDaysAgo = new DateTimeImmutable('2026-05-30 12:00:00');
$stages = UniversalVerificationEngine::reminderStages($dueThreeDaysAgo, $now);
assertTrue(in_array('24h_overdue', $stages, true), '24h overdue reminder is generated');
assertTrue(in_array('3_days_overdue', $stages, true), '3 day overdue reminder is generated');

$escalation = UniversalVerificationEngine::escalationStage($dueThreeDaysAgo, $now);
assertTrue($escalation['stage'] === 'manager_notification', '3 day overdue escalates to manager');
assertTrue($escalation['suggest_penalty'] === false, '3 day overdue does not suggest penalty yet');

$dueSevenDaysAgo = new DateTimeImmutable('2026-05-25 12:00:00');
$escalation = UniversalVerificationEngine::escalationStage($dueSevenDaysAgo, $now);
assertTrue($escalation['stage'] === 'admin_notification', '7 day overdue escalates to admin');
assertTrue($escalation['suggest_penalty'] === true, '7 day overdue suggests penalty');

echo "PASS verification_escalation.test.php\n";
