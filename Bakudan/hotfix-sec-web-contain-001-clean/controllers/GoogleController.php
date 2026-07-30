<?php

class GoogleController
{
    public function connect()
    {
        requireAuth(); // nếu bạn có hàm này; nếu không thì thay bằng check session

        require_once __DIR__ . '/../services/GoogleCalendarService.php';
        $svc = new GoogleCalendarService(db());

        header('Location: ' . $svc->getAuthUrl());
        exit;
    }

    public function callback()
    {
        requireAuth();

        if (empty($_GET['code'])) {
            flash('error', 'Google callback thiếu code.');
            redirect(APP_URL . '/bills');
        }

        try {
            require_once __DIR__ . '/../services/GoogleCalendarService.php';
            $svc = new GoogleCalendarService(db());
            $svc->handleCallback((int)$_SESSION['user_id'], $_GET['code']);

            flash('success', 'Đã connect Google Calendar thành công!');
        } catch (Exception $e) {
            flash('error', 'Google OAuth lỗi: ' . $e->getMessage());
        }

        redirect(APP_URL . '/bills');
    }
}