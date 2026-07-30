<?php
require_once __DIR__ . '/../service/UniversalVerificationEngine.php';

function assertTrue($condition, string $message): void {
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$missingOwner = UniversalVerificationEngine::validateWorkflowRecord([
    'store_id' => 1,
    'priority' => 'high',
    'due_date' => '2026-06-03 10:00:00',
]);
assertTrue($missingOwner['valid'] === false, 'owner is required');
assertTrue(in_array('owner', $missingOwner['missing'], true), 'owner missing is reported');

$noVerification = UniversalVerificationEngine::canCompleteFromState(false, []);
assertTrue($noVerification['allowed'] === true, 'record without verification can complete');

$blocked = UniversalVerificationEngine::canCompleteFromState(true, [
    ['step_order' => 1, 'status' => 'approved'],
    ['step_order' => 2, 'status' => 'pending'],
]);
assertTrue($blocked['allowed'] === false, 'multi-step verification blocks incomplete chain');
assertTrue($blocked['reason'] === 'verification_step_incomplete', 'block reason is explicit');
assertTrue($blocked['step_order'] === 2, 'blocked step order is reported');

$allowed = UniversalVerificationEngine::canCompleteFromState(true, [
    ['step_order' => 1, 'status' => 'approved'],
    ['step_order' => 2, 'status' => 'approved'],
]);
assertTrue($allowed['allowed'] === true, 'all approved steps allow completion');

echo "PASS verification_engine.test.php\n";
