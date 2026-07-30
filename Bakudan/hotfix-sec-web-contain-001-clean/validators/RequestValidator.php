<?php
/**
 * RequestValidator — Base class for API request validation.
 *
 * Provides reusable validation primitives for:
 *   - Required fields
 *   - Type checking (string, int, date, enum, json)
 *   - Range/length constraints
 *   - Recurrence config validation
 *
 * Usage:
 *   $v = new RequestValidator($_POST);
 *   $v->required('title')->string('title', 1, 255);
 *   $v->optional('due_date')->date('due_date');
 *   $v->enum('priority', ['low','medium','high','urgent']);
 *   if ($v->fails()) ApiResponse::validationError($v->errors());
 *   $clean = $v->validated();
 */
class RequestValidator
{
    private array $data;
    private array $errors = [];
    private array $validated = [];

    public function __construct(array $data)
    {
        $this->data = $data;
    }

    // ── Chainable rules ──────────────────────────────────────────────────

    /**
     * Mark a field as required.
     */
    public function required(string $field, ?string $message = null): self
    {
        if (!array_key_exists($field, $this->data) || $this->isEmpty($this->data[$field])) {
            $this->errors[$field] = $message ?? "{$field} is required";
        }
        return $this;
    }

    /**
     * Mark a field as optional (no error if missing, but validate if present).
     */
    public function optional(string $field): self
    {
        // No-op — just for readability in chains
        return $this;
    }

    /**
     * Validate string field with length constraints.
     */
    public function string(string $field, int $min = 0, int $max = 65535): self
    {
        if (!$this->hasField($field)) return $this;
        $val = $this->data[$field];

        if (!is_string($val) && !is_numeric($val)) {
            $this->errors[$field] = "{$field} must be a string";
            return $this;
        }

        $val = trim((string) $val);
        $len = mb_strlen($val);

        if ($len < $min) {
            $this->errors[$field] = "{$field} must be at least {$min} characters";
        } elseif ($len > $max) {
            $this->errors[$field] = "{$field} must not exceed {$max} characters";
        } else {
            $this->validated[$field] = $val;
        }

        return $this;
    }

    /**
     * Validate integer field with range.
     */
    public function integer(string $field, ?int $min = null, ?int $max = null): self
    {
        if (!$this->hasField($field)) return $this;
        $val = $this->data[$field];

        if (!is_numeric($val)) {
            $this->errors[$field] = "{$field} must be a number";
            return $this;
        }

        $intVal = (int) $val;
        if ($min !== null && $intVal < $min) {
            $this->errors[$field] = "{$field} must be at least {$min}";
        } elseif ($max !== null && $intVal > $max) {
            $this->errors[$field] = "{$field} must not exceed {$max}";
        } else {
            $this->validated[$field] = $intVal;
        }

        return $this;
    }

    /**
     * Validate date field (YYYY-MM-DD format).
     */
    public function date(string $field, ?string $minDate = null, ?string $maxDate = null): self
    {
        if (!$this->hasField($field)) return $this;
        $val = trim((string) $this->data[$field]);

        if ($val === '' || $val === null) {
            $this->validated[$field] = null;
            return $this;
        }

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $val)) {
            $this->errors[$field] = "{$field} must be a valid date (YYYY-MM-DD)";
            return $this;
        }

        // Verify it's a real date
        $parts = explode('-', $val);
        if (!checkdate((int)$parts[1], (int)$parts[2], (int)$parts[0])) {
            $this->errors[$field] = "{$field} is not a valid calendar date";
            return $this;
        }

        if ($minDate && $val < $minDate) {
            $this->errors[$field] = "{$field} must be on or after {$minDate}";
        } elseif ($maxDate && $val > $maxDate) {
            $this->errors[$field] = "{$field} must be on or before {$maxDate}";
        } else {
            $this->validated[$field] = $val;
        }

        return $this;
    }

    /**
     * Validate enum field (must be one of allowed values).
     */
    public function enum(string $field, array $allowed): self
    {
        if (!$this->hasField($field)) return $this;
        $val = $this->data[$field];

        if (!in_array($val, $allowed, true)) {
            $this->errors[$field] = "{$field} must be one of: " . implode(', ', $allowed);
        } else {
            $this->validated[$field] = $val;
        }

        return $this;
    }

    /**
     * Validate JSON string field.
     */
    public function json(string $field): self
    {
        if (!$this->hasField($field)) return $this;
        $val = $this->data[$field];

        if ($val === null || $val === '') {
            $this->validated[$field] = null;
            return $this;
        }

        if (is_array($val)) {
            $this->validated[$field] = $val;
            return $this;
        }

        $decoded = json_decode((string) $val, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            $this->errors[$field] = "{$field} must be valid JSON";
        } else {
            $this->validated[$field] = $decoded;
        }

        return $this;
    }

    /**
     * Validate recurrence configuration.
     */
    public function recurrenceConfig(string $typeField = 'repeat_type', string $configField = 'repeat_config'): self
    {
        $type = $this->data[$typeField] ?? 'none';
        $allowedTypes = ['none', 'daily', 'weekly', 'monthly', 'yearly'];

        if (!in_array($type, $allowedTypes, true)) {
            $this->errors[$typeField] = "repeat_type must be one of: " . implode(', ', $allowedTypes);
            return $this;
        }

        $this->validated[$typeField] = $type;

        if ($type === 'none') {
            $this->validated[$configField] = null;
            return $this;
        }

        // Validate config if present
        if ($this->hasField($configField)) {
            $config = $this->data[$configField];
            if (is_string($config)) {
                $config = json_decode($config, true);
                if (!is_array($config)) {
                    $this->errors[$configField] = "repeat_config must be valid JSON";
                    return $this;
                }
            }

            if (is_array($config)) {
                // Validate interval
                $interval = $config['interval'] ?? 1;
                if (!is_numeric($interval) || (int)$interval < 1 || (int)$interval > 30) {
                    $this->errors[$configField] = "repeat_config.interval must be 1-30";
                    return $this;
                }

                // Validate weekly days
                if ($type === 'weekly' && isset($config['days'])) {
                    if (!is_array($config['days'])) {
                        $this->errors[$configField] = "repeat_config.days must be an array";
                        return $this;
                    }
                    foreach ($config['days'] as $day) {
                        if (!is_numeric($day) || (int)$day < 1 || (int)$day > 7) {
                            $this->errors[$configField] = "repeat_config.days values must be 1-7";
                            return $this;
                        }
                    }
                }

                // Validate monthly day_of_month
                if ($type === 'monthly' && isset($config['day_of_month'])) {
                    $dom = (int)$config['day_of_month'];
                    if ($dom < 1 || $dom > 31) {
                        $this->errors[$configField] = "repeat_config.day_of_month must be 1-31";
                        return $this;
                    }
                }

                $this->validated[$configField] = $config;
            }
        }

        return $this;
    }

    // ── Result methods ───────────────────────────────────────────────────

    /**
     * Check if validation failed.
     */
    public function fails(): bool
    {
        return !empty($this->errors);
    }

    /**
     * Get validation errors.
     */
    public function errors(): array
    {
        return $this->errors;
    }

    /**
     * Get validated (clean) data.
     * Only includes fields that passed validation.
     */
    public function validated(): array
    {
        return $this->validated;
    }

    /**
     * Get a specific validated value, or default.
     */
    public function get(string $field, $default = null)
    {
        return $this->validated[$field] ?? $default;
    }

    // ── Internal helpers ─────────────────────────────────────────────────

    private function hasField(string $field): bool
    {
        return array_key_exists($field, $this->data) && !$this->isEmpty($this->data[$field]);
    }

    private function isEmpty($value): bool
    {
        return $value === null || $value === '' || $value === [];
    }
}
