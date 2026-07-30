<?php
/**
 * API v1 - Response helpers
 * Chuẩn response format cho tất cả API endpoints
 */

if (!function_exists('api_response')) {
    function api_response($data = [], $message = 'OK', $status = 200, $meta = [], $errors = []) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        echo json_encode([
            'success' => $status >= 200 && $status < 400,
            'message' => $message,
            'data' => $data,
            'meta'  => $meta,
            'errors' => $errors,
            'timestamp' => time(),
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
}

if (!function_exists('api_error')) {
    function api_error($message = 'Error', $status = 400, $errors = []) {
        api_response([], $message, $status, [], $errors);
    }
}

if (!function_exists('api_paginate')) {
    /**
     * Wrap items với pagination metadata
     * @param array $items
     * @param int $total total records
     * @param int $page
     * @param int $perPage
     * @return array
     */
    function api_paginate($items, $total, $page, $perPage) {
        return [
            'items' => $items,
            'pagination' => [
                'page'       => (int)$page,
                'per_page'   => (int)$perPage,
                'total'      => (int)$total,
                'total_pages'=> (int)ceil($total / $perPage),
                'has_more'   => ($page * $perPage) < $total,
            ]
        ];
    }
}

if (!function_exists('api_meta')) {
    /**
     * Metadata helpers
     */
    function api_meta_pagination($items, $total, $page, $perPage) {
        return api_paginate($items, $total, $page, $perPage);
    }
}
