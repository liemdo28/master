<?php
class ApproveDeadlineExtensionValidator {
    public function validate(array $data): array {
        $errors = [];
        $id = (int)($data['extension_id'] ?? 0);
        if ($id <= 0) $errors[] = 'extension_id is required.';
        return $errors;
    }
}
