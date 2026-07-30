<?php
/**
 * ApiResponse — Standardized API response envelope.
 *
 * All API endpoints should use this helper to ensure consistent response format:
 * {
 *   "success": true|false,
 *   "data": { ... },
 *   "meta": { "request_id": "...", "timestamp": "..." },
 *   "errors": []
 * }
 *
 * Usage:
 *   ApiResponse::success(['task' => $task]);
 *   ApiResponse::success(['tasks' => $tasks], ['total' => 42, 'page' => 1]);
 *   ApiResponse::error('Not found', 404);
 *   ApiResponse::validationError(['title' => 'Title is required', 'due_date' => 'Invalid date']);
 */
class ApiResponse
{
    /**
     * Send a successful response.
     *
     * @param array $data    Response payload
     * @param array $meta    Optional metadata (pagination, counts, etc.)
     * @param int   $status  HTTP status code (default 200)
     */
    public static function success(array $data = [], array $meta = [], int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');

        echo json_encode([
            'success' => true,
            'data'    => $data,
            'meta'    => array_merge(self::baseMeta(), $meta),
            'errors'  => [],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    /**
     * Send an error response.
     *
     * @param string $message  Human-readable error message
     * @param int    $status   HTTP status code
     * @param array  $errors   Optional structured error details
     */
    public static function error(string $message, int $status = 400, array $errors = []): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');

        echo json_encode([
            'success' => false,
            'data'    => null,
            'meta'    => self::baseMeta(),
            'errors'  => array_merge([['message' => $message, 'code' => $status]], $errors),
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    /**
     * Send a validation error response (422).
     *
     * @param array $fieldErrors  Associative array: field_name => error_message
     */
    public static function validationError(array $fieldErrors): void
    {
        http_response_code(422);
        header('Content-Type: application/json; charset=utf-8');

        $errors = [];
        foreach ($fieldErrors as $field => $message) {
            $errors[] = ['field' => $field, 'message' => $message];
        }

        echo json_encode([
            'success' => false,
            'data'    => null,
            'meta'    => self::baseMeta(),
            'errors'  => $errors,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    /**
     * Send a paginated success response.
     *
     * @param array $items      The items for this page
     * @param int   $total      Total item count
     * @param int   $page       Current page number
     * @param int   $perPage    Items per page
     */
    public static function paginated(array $items, int $total, int $page = 1, int $perPage = 20): void
    {
        self::success(
            ['items' => $items],
            [
                'total'    => $total,
                'page'     => $page,
                'per_page' => $perPage,
                'pages'    => (int) ceil($total / max(1, $perPage)),
            ]
        );
    }

    /**
     * Base metadata included in every response.
     */
    private static function baseMeta(): array
    {
        return [
            'request_id' => self::getRequestId(),
            'timestamp'  => date('c'),
        ];
    }

    private static function getRequestId(): string
    {
        static $id = null;
        if ($id === null) {
            $id = uniqid('req_', true);
        }
        return $id;
    }
}
