<?php
/**
 * TaskFlow API v1 - Router Bootstrap
 * Xử lý tất cả /api/v1/* routes
 *
 * Cách hoạt động:
 * - File này được include từ index.php khi route bắt đầu bằng "api/v1/"
 * - Tách route thành controller + action dựa trên HTTP method
 * - Không dùng session, chỉ dùng Bearer token
 */

// Không có session cho API (hoặc dùng nhẹ để preserve state)
// session_start(); // commented out — API dùng token, không session

/**
 * Parse API route thành segments
 * /api/v1/tasks/123/comments → ['tasks', '123', 'comments']
 */
function api_parse_route($route) {
    // Remove "api/v1/" prefix
    $route = preg_replace('/^api\/v1\/?/', '', $route);
    $route = trim($route, '/');
    if ($route === '') return [];
    return explode('/', $route);
}

/**
 * Map route segments thành controller + action + params
 */
function api_resolve($segments, $method) {
    $n = count($segments);

    // Auth routes
    if ($segments[0] === 'auth') {
        $sub = $segments[1] ?? '';
        switch ($sub) {
            case '':
            case 'login':
                return ['AuthApiController', 'login', $method === 'POST' ? 'login' : null];
            case 'register':
                return ['AuthApiController', 'register', 'register'];
            case 'logout':
                return ['AuthApiController', 'logout', 'logout'];
            case 'refresh':
                return ['AuthApiController', 'refresh', 'refresh'];
            case 'me':
                return ['AuthApiController', 'me', 'me'];
            case 'forgot-password':
                return ['AuthApiController', 'forgotPassword', 'forgotPassword'];
            case 'reset-password':
                return ['AuthApiController', 'resetPassword', 'resetPassword'];
            case 'logout-all':
                return ['AuthApiController', 'logoutAll', 'logoutAll'];
        }
    }

    // Tasks routes: /api/v1/tasks[/...]]
    if ($segments[0] === 'tasks') {
        if ($n === 1) {
            return $method === 'POST'
                ? ['TaskApiController', 'store', 'store']
                : ['TaskApiController', 'index', 'index'];
        }

        $taskId = $segments[1] ?? null;
        if ($taskId && is_numeric($taskId)) {
            if ($n === 2) {
                $action = $method === 'PUT' || $method === 'PATCH'
                    ? ['TaskApiController', 'update', 'update']
                    : ['TaskApiController', 'show', 'show'];
                return $action;
            }

            $sub = $segments[2] ?? '';
            if ($sub === 'comments' && $method === 'POST') {
                return ['TaskApiController', 'addComment', 'addComment', (int)$taskId];
            }
            if ($sub === 'comments' && ($method === 'GET' || $n === 3)) {
                return ['TaskApiController', 'getComments', 'getComments', (int)$taskId];
            }
            if ($sub === 'status' && $method === 'PATCH') {
                return ['TaskApiController', 'changeStatus', 'changeStatus', (int)$taskId];
            }
            if ($sub === 'assign' && $method === 'PATCH') {
                return ['TaskApiController', 'assign', 'assign', (int)$taskId];
            }
            if ($sub === 'delete' && $method === 'DELETE') {
                return ['TaskApiController', 'destroy', 'destroy', (int)$taskId];
            }
            // Sprint 1.3.3 — quick actions
            if ($sub === 'complete' && $method === 'POST') {
                return ['TaskApiController', 'complete', 'complete', (int)$taskId];
            }
            if ($sub === 'reassign' && $method === 'POST') {
                return ['TaskApiController', 'assign', 'assign', (int)$taskId];
            }
            if ($sub === 'move-date' && $method === 'POST') {
                return ['TaskApiController', 'moveDate', 'moveDate', (int)$taskId];
            }
            if ($sub === 'snooze' && $method === 'POST') {
                return ['TaskApiController', 'snooze', 'snooze', (int)$taskId];
            }
            // Approval workflow
            if ($sub === 'submit' && $method === 'POST') {
                return ['TaskApprovalApiController', 'submit', 'submit', (int)$taskId];
            }
            if ($sub === 'review-approve' && $method === 'POST') {
                return ['TaskApprovalApiController', 'reviewApprove', 'reviewApprove', (int)$taskId];
            }
            if ($sub === 'review-reject' && $method === 'POST') {
                return ['TaskApprovalApiController', 'reviewReject', 'reviewReject', (int)$taskId];
            }
            if ($sub === 'accept' && $method === 'POST') {
                return ['TaskApprovalApiController', 'accept', 'accept', (int)$taskId];
            }
            if ($sub === 'accept-reject' && $method === 'POST') {
                return ['TaskApprovalApiController', 'acceptReject', 'acceptReject', (int)$taskId];
            }
            if ($sub === 'reopen-approval' && $method === 'POST') {
                return ['TaskApprovalApiController', 'reopenApproval', 'reopenApproval', (int)$taskId];
            }
            if ($sub === 'approval-history' && $method === 'GET') {
                return ['TaskApprovalApiController', 'approvalHistory', 'approvalHistory', (int)$taskId];
            }
        }
    }

    // My Tasks: /api/v1/me/tasks[/...]
    if ($segments[0] === 'me' && ($segments[1] ?? '') === 'tasks') {
        if ($n === 2) {
            return ['MyTasksApiController', 'myTasks', 'myTasks'];
        }
        if ($segments[2] === 'new' && $method === 'GET') {
            return ['MyTasksApiController', 'newTasks', 'newTasks'];
        }
        if (is_numeric($segments[2]) && ($segments[3] ?? '') === 'accept' && $method === 'POST') {
            return ['MyTasksApiController', 'acceptTask', 'acceptTask', (int)$segments[2]];
        }
    }

    // Notifications: /api/v1/notifications[/...]
    if ($segments[0] === 'notifications') {
        if ($n === 1) {
            return ['NotificationApiController', 'index', 'index'];
        }
        $sub = $segments[1] ?? '';
        if ($sub === 'unread-count') {
            return ['NotificationApiController', 'unreadCount', 'unreadCount'];
        }
        if ($sub === 'read-all' && $method === 'PATCH') {
            return ['NotificationApiController', 'markAllRead', 'markAllRead'];
        }
    }

    // Dashboard
    if ($segments[0] === 'dashboard') {
        $sub = $segments[1] ?? '';
        if ($sub === 'summary') {
            return ['DashboardApiController', 'summary', 'summary'];
        }
    }

    // Calendar
    if ($segments[0] === 'calendar') {
        // Day drawer endpoint:
        //   /api/v1/calendar/day?date=YYYY-MM-DD    → $_GET
        //   /api/v1/calendar/day/YYYY-MM-DD         → path segment
        if (($segments[1] ?? '') === 'day') {
            if (!empty($segments[2])) {
                return ['CalendarApiController', 'day', 'day', $segments[2]];
            }
            return ['CalendarApiController', 'day', 'day'];
        }
        return ['CalendarApiController', 'index', 'index'];
    }

    // Users
    if ($segments[0] === 'users') {
        if ($n === 1) {
            return ['UserApiController', 'index', 'index'];
        }
        $userId = $segments[1];
        if ($userId === 'profile' && $method === 'PUT') {
            return ['UserApiController', 'updateProfile', 'updateProfile'];
        }
        if ($userId === 'password' && $method === 'PUT') {
            return ['UserApiController', 'updatePassword', 'updatePassword'];
        }
        if ($userId === 'push-token' && $method === 'PUT') {
            return ['UserApiController', 'updatePushToken', 'updatePushToken'];
        }
        if (is_numeric($userId)) {
            return ['UserApiController', 'show', 'show', (int)$userId];
        }
    }

    // Upload
    if ($segments[0] === 'upload' && $method === 'POST') {
        return ['UploadApiController', 'upload', 'upload'];
    }

    // ── Phase 3 — Focus / Intelligence feed ──────────────────────────────────
    // GET  /api/v1/focus                       → compact mobile home payload
    // GET  /api/v1/focus/decisions             → role-filtered decision feed
    // GET  /api/v1/focus/risk                  → latest risk snapshot
    // GET  /api/v1/focus/activity              → system activity feed
    // GET  /api/v1/focus/approvals             → pending approvals
    // POST /api/v1/focus/approvals/{id}/resolve → approve / reject
    if ($segments[0] === 'focus') {
        $sub = $segments[1] ?? '';
        if ($sub === '') {
            return ['FocusApiController', 'index', 'index'];
        }
        if ($sub === 'decisions') {
            return ['FocusApiController', 'decisions', 'decisions'];
        }
        if ($sub === 'risk') {
            return ['FocusApiController', 'risk', 'risk'];
        }
        if ($sub === 'activity') {
            return ['FocusApiController', 'activity', 'activity'];
        }
        if ($sub === 'approvals') {
            if ($n === 2 && $method === 'GET') {
                return ['FocusApiController', 'approvals', 'approvals'];
            }
            // POST /api/v1/focus/approvals/{approval_id}/resolve
            if ($n === 4 && ($segments[3] ?? '') === 'resolve' && $method === 'POST') {
                return ['FocusApiController', 'resolveApproval', 'resolveApproval', $segments[2]];
            }
        }
    }

    // Sync
    if ($segments[0] === 'sync') {
        $sub = $segments[1] ?? '';
        if ($sub === 'poll') {
            return ['SyncApiController', 'poll', 'poll'];
        }
        if ($sub === 'status') {
            return ['SyncApiController', 'status', 'status'];
        }
    }

    // Projects
    if ($segments[0] === 'projects') {
        if ($n === 1 && $method === 'POST') {
            return ['ProjectApiController', 'store', 'store'];
        }
        if ($n === 1 && $method === 'GET') {
            return ['ProjectApiController', 'index', 'index'];
        }
        $projectId = $segments[1] ?? null;
        if ($projectId && is_numeric($projectId)) {
            if ($n === 2 && $method === 'GET') {
                return ['ProjectApiController', 'show', 'show', (int)$projectId];
            }
            if ($n === 2 && in_array($method, ['PUT','PATCH'])) {
                return ['ProjectApiController', 'update', 'update', (int)$projectId];
            }
        }
    }

    // Credentials
    if ($segments[0] === 'credentials') {
        if ($n === 1 && $method === 'GET') {
            return ['CredentialApiController', 'index', 'index'];
        }
        if ($n === 1 && $method === 'POST') {
            return ['CredentialApiController', 'store', 'store'];
        }
        if (($segments[1] ?? '') === 'audit' && $method === 'GET') {
            return ['CredentialApiController', 'audit', 'audit'];
        }
        if (($segments[1] ?? '') === 'rotation' && ($segments[2] ?? '') === 'stats' && $method === 'GET') {
            return ['CredentialApiController', 'rotationStats', 'rotationStats'];
        }
        if (($segments[1] ?? '') === 'rotation' && ($segments[2] ?? '') === 'due' && $method === 'GET') {
            return ['CredentialApiController', 'rotationDue', 'rotationDue'];
        }

        $credentialId = $segments[1] ?? null;
        if ($credentialId && is_numeric($credentialId)) {
            if ($n === 2 && $method === 'GET') {
                return ['CredentialApiController', 'show', 'show', (int)$credentialId];
            }
            if ($n === 2 && in_array($method, ['PUT', 'PATCH'])) {
                return ['CredentialApiController', 'update', 'update', (int)$credentialId];
            }
            if ($n === 2 && $method === 'DELETE') {
                return ['CredentialApiController', 'destroy', 'destroy', (int)$credentialId];
            }
            if (($segments[2] ?? '') === 'view-password' && $method === 'POST') {
                return ['CredentialApiController', 'viewPassword', 'viewPassword', (int)$credentialId];
            }
            if (($segments[2] ?? '') === 'grant-access' && $method === 'POST') {
                return ['CredentialApiController', 'grantAccess', 'grantAccess', (int)$credentialId];
            }
            if (($segments[2] ?? '') === 'revoke-access' && $method === 'POST') {
                return ['CredentialApiController', 'revokeAccess', 'revokeAccess', (int)$credentialId];
            }
            if (($segments[2] ?? '') === 'create-rotation-task' && $method === 'POST') {
                return ['CredentialApiController', 'createRotationTask', 'createRotationTask', (int)$credentialId];
            }
            if (($segments[2] ?? '') === 'complete-rotation' && $method === 'POST') {
                return ['CredentialApiController', 'completeRotation', 'completeRotation', (int)$credentialId];
            }
            if (($segments[2] ?? '') === 'audit' && $method === 'GET') {
                return ['CredentialApiController', 'credentialAudit', 'credentialAudit', (int)$credentialId];
            }
        }
    }

    // Comments: /api/v1/comments/{id}
    if ($segments[0] === 'comments') {
        $commentId = $segments[1] ?? null;
        if ($commentId && is_numeric($commentId)) {
            if ($method === 'DELETE') {
                return ['CommentApiController', 'destroy', 'destroy', (int)$commentId];
            }
            if ($method === 'PUT') {
                return ['CommentApiController', 'update', 'update', (int)$commentId];
            }
        }
    }

    return [null, null, null];
}

/**
 * Dispatch request to API controller
 */
function api_dispatch($route, $method) {
    // CORS headers
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Platform, X-Device-Id, X-Device-Name, X-Requested-With');
    header('Access-Control-Max-Age: 86400');

    // Handle preflight
    if ($method === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    // HTTPS enforcement
    if (!isset($_SERVER['HTTPS']) && php_sapi_name() !== 'cli') {
        // Uncomment in production:
        // if (strpos($_SERVER['HTTP_HOST'] ?? '', 'localhost') === false) {
        //     $url = 'https://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
        //     header('Location: ' . $url);
        //     exit;
        // }
    }

    $segments = api_parse_route($route);
    $resolved = api_resolve($segments, $method);

    list($controller, $action, $idParam, $resourceId) = array_pad($resolved, 4, null);

    if (!$controller) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => 'API endpoint not found',
            'errors' => [],
            'timestamp' => time(),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Load controller
    $controllerFile = __DIR__ . '/v1/' . $controller . '.php';

    if (!file_exists($controllerFile)) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => 'Controller file not found: ' . $controller,
            'errors' => [],
            'timestamp' => time(),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    require_once $controllerFile;

    if (!class_exists($controller)) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => 'Controller class not found: ' . $controller,
            'errors' => [],
            'timestamp' => time(),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $ctrl = new $controller();

    if (!method_exists($ctrl, $action)) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => "Method '{$action}' not found on {$controller}",
            'errors' => [],
            'timestamp' => time(),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Dispatch với params
    if ($resourceId !== null) {
        $ctrl->{$action}($resourceId);
    } else {
        $ctrl->{$action}();
    }
}
