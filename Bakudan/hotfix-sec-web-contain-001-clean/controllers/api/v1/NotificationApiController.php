<?php
/**
 * API v1 - Notifications Endpoints
 * GET|PATCH /api/v1/notifications
 */
require_once __DIR__ . '/ApiController.php';

class NotificationApiController extends ApiController {

    // ── GET /api/v1/notifications ────────────────────────────────
    public function index() {
        $this->requireAuth();

        $p = $this->paginationParams(30, 100);
        $type     = $_GET['type'] ?? '';
        $unreadOnly = filter_var($_GET['unread_only'] ?? false, FILTER_VALIDATE_BOOLEAN);

        $where = "n.user_id = ?";
        $params = [$this->userId];

        if ($type) {
            $where .= " AND n.type = ?";
            $params[] = $type;
        }
        if ($unreadOnly) {
            $where .= " AND n.is_read = 0";
        }

        // Count total
        $total = $this->db->fetch(
            "SELECT COUNT(*) as total FROM notifications n WHERE {$where}",
            $params
        )['total'];

        $offset = ($p['page'] - 1) * $p['perPage'];

        $notifications = $this->db->fetchAll(
            "SELECT n.*, u.name as from_user_name, u.avatar as from_user_avatar
             FROM notifications n
             LEFT JOIN users u ON n.from_user_id = u.id
             WHERE {$where}
             ORDER BY n.created_at DESC
             LIMIT {$p['perPage']} OFFSET {$offset}",
            $params
        );

        $unreadCount = $this->db->fetch(
            "SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0",
            [$this->userId]
        )['c'] ?? 0;

        api_response([
            'notifications' => array_map([$this, 'formatNotification'], $notifications),
            'unread_count' => (int)$unreadCount,
        ], 'OK', 200, api_paginate($notifications, $total, $p['page'], $p['perPage']));
    }

    // ── PATCH /api/v1/notifications/read-all ─────────────────────
    public function markAllRead() {
        $this->requireAuth();

        $this->db->update(
            "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0",
            [$this->userId]
        );

        $this->auditLog('notifications_read_all', 'notification', null);
        api_response(['updated' => true], 'All notifications marked as read');
    }

    // ── GET /api/v1/notifications/unread-count ────────────────────
    public function unreadCount() {
        $this->requireAuth();

        $r = $this->db->fetch(
            "SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0",
            [$this->userId]
        );

        api_response(['unread_count' => (int)$r['c']]);
    }

    // ── Helper format ────────────────────────────────────────────
    public function formatNotification($n) {
        return [
            'id'             => (int)$n['id'],
            'type'           => $n['type'] ?? '',
            'title'          => $n['title'] ?? '',
            'message'        => $n['message'] ?? '',
            'is_read'        => (int)($n['is_read'] ?? 0),
            'deep_link'      => $n['deep_link'] ?? ($n['task_id'] ? '/tasks/' . $n['task_id'] : null),
            'task_id'        => $n['task_id'] ? (int)$n['task_id'] : null,
            'project_id'     => $n['project_id'] ? (int)$n['project_id'] : null,
            'from_user_id'   => $n['from_user_id'] ? (int)$n['from_user_id'] : null,
            'from_user_name' => $n['from_user_name'] ?? null,
            'from_user_avatar'=> $n['from_user_avatar'] ?? null,
            'created_at'     => $n['created_at'] ?? null,
        ];
    }
}