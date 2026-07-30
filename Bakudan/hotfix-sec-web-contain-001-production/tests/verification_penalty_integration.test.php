<?php
require_once __DIR__ . '/../service/UniversalVerificationEngine.php';

function assertTrue($condition, string $message): void {
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

assertTrue(
    UniversalVerificationEngine::suggestedPenaltyCategory('payment', 'verification') === 'Financial Confirmation Missed',
    'payment verification miss maps to financial confirmation penalty'
);

assertTrue(
    UniversalVerificationEngine::suggestedPenaltyCategory('bill', 'verification') === 'Financial Confirmation Missed',
    'bill verification miss maps to financial confirmation penalty'
);

assertTrue(
    UniversalVerificationEngine::suggestedPenaltyCategory('payroll', 'verification') === 'Approval Missed',
    'payroll verification miss maps to approval missed penalty'
);

assertTrue(
    UniversalVerificationEngine::suggestedPenaltyCategory('task', 'verification') === 'Verification Missed',
    'task verification miss maps to verification missed penalty'
);

$failed = false;
try {
    UniversalVerificationEngine::suggestedPenaltyCategory('unknown', 'verification');
} catch (InvalidArgumentException $e) {
    $failed = true;
}
assertTrue($failed, 'unknown object type fails instead of guessing');

echo "PASS verification_penalty_integration.test.php\n";
