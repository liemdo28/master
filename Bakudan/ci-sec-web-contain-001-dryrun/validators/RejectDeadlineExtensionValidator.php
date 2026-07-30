<?php
class RejectDeadlineExtensionValidator {
    public function validate(array $data): array {
        $errors = [];
        $id = (int)($data['extension_id'] ?? 0);
        if ($id <= 0) $errors[] = 'extension_id is required.';
        $note = trim($data['note'] ?? '');
        if (strlen($note) < 3) $errors[] = 'Rejection reason is required.';
        return $errors;
    }
}
