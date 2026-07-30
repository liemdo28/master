<?php
class CreateDeadlineExtensionValidator {
    public function validate(array $data): array {
        $errors = [];

        $taskId = (int)($data['task_id'] ?? 0);
        if ($taskId <= 0) $errors[] = 'task_id is required.';

        $newDue = trim($data['new_due_date'] ?? '');
        if (!$newDue) {
            $errors[] = 'New due date is required.';
        } elseif (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $newDue)) {
            $errors[] = 'New due date must be in YYYY-MM-DD format.';
        }

        $reason = trim($data['reason'] ?? '');
        if (strlen($reason) < 5) $errors[] = 'Reason must be at least 5 characters.';
        if (strlen($reason) > 1000) $errors[] = 'Reason is too long (max 1000 chars).';

        return $errors;
    }
}
