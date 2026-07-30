<?php

$outDir = __DIR__;
$srtPath = $outDir . '/taskflow_user_guide_vi.srt';
$storyPath = $outDir . '/taskflow_user_guide_storyboard.md';

$fontRegular = '/System/Library/Fonts/Supplemental/Verdana.ttf';
$fontBold = '/System/Library/Fonts/Supplemental/Verdana Bold.ttf';
if (!file_exists($fontRegular)) $fontRegular = '/System/Library/Fonts/SFNS.ttf';
if (!file_exists($fontBold)) $fontBold = $fontRegular;

$width = 1920;
$height = 1080;
$fps = 12;
$slides = [
    [
        'duration' => 5,
        'title' => 'TaskFlow Dashboard',
        'caption' => 'Bước 1: mở dashboard.bakudanramen.com và đăng nhập bằng email hoangdle@gmail.com cùng mật khẩu được cấp.',
        'screen' => 'login',
    ],
    [
        'duration' => 6,
        'title' => 'Overview',
        'caption' => 'Bước 2: vào Overview để xem tình trạng vận hành: việc quá hạn, tiến độ team, rủi ro và các việc cần xử lý hôm nay.',
        'screen' => 'overview',
    ],
    [
        'duration' => 6,
        'title' => 'My Tasks',
        'caption' => 'Bước 3: mở My Tasks để lọc việc của mình theo ưu tiên, hạn chót và trạng thái; bấm vào từng dòng để xem chi tiết.',
        'screen' => 'tasks',
    ],
    [
        'duration' => 6,
        'title' => 'Create Task',
        'caption' => 'Bước 4: dùng nút Create để tạo project, task hoặc bill; nhập tiêu đề, người phụ trách, hạn chót và nhấn Save.',
        'screen' => 'create',
    ],
    [
        'duration' => 6,
        'title' => 'Calendar & Inbox',
        'caption' => 'Bước 5: dùng Calendar để nhìn lịch theo tháng, và Inbox để kiểm tra phân công, bình luận, nhắc hạn và cảnh báo quá hạn.',
        'screen' => 'calendar',
    ],
    [
        'duration' => 6,
        'title' => 'Task Detail',
        'caption' => 'Bước 6: trong trang chi tiết task, cập nhật trạng thái, thêm bình luận, đổi deadline hoặc đánh dấu hoàn thành.',
        'screen' => 'detail',
    ],
    [
        'duration' => 5,
        'title' => 'Admin Tools',
        'caption' => 'Bước 7: với quyền admin hoặc manager, quản lý users, stores, vendors, bills, penalty và yêu cầu gia hạn deadline.',
        'screen' => 'admin',
    ],
    [
        'duration' => 4,
        'title' => 'Daily Routine',
        'caption' => 'Mỗi ngày: xem Overview, xử lý My Tasks, kiểm tra Calendar và Inbox, rồi cập nhật task ngay khi có thay đổi.',
        'screen' => 'done',
    ],
];

function c($img, string $hex, int $alpha = 0): int {
    $hex = ltrim($hex, '#');
    return imagecolorallocatealpha($img, hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2)), $alpha);
}

function rr($img, int $x, int $y, int $w, int $h, int $r, int $color): void {
    imagefilledrectangle($img, $x + $r, $y, $x + $w - $r, $y + $h, $color);
    imagefilledrectangle($img, $x, $y + $r, $x + $w, $y + $h - $r, $color);
    imagefilledellipse($img, $x + $r, $y + $r, $r * 2, $r * 2, $color);
    imagefilledellipse($img, $x + $w - $r, $y + $r, $r * 2, $r * 2, $color);
    imagefilledellipse($img, $x + $r, $y + $h - $r, $r * 2, $r * 2, $color);
    imagefilledellipse($img, $x + $w - $r, $y + $h - $r, $r * 2, $r * 2, $color);
}

function txt($img, string $text, int $size, int $x, int $y, int $color, string $font, string $align = 'left'): void {
    $box = imagettfbbox($size, 0, $font, $text);
    $tw = abs($box[4] - $box[0]);
    if ($align === 'center') $x -= (int)($tw / 2);
    if ($align === 'right') $x -= $tw;
    imagettftext($img, $size, 0, $x, $y, $color, $font, $text);
}

function wrapLines(string $text, int $maxChars): array {
    $words = preg_split('/\s+/u', trim($text));
    $lines = [];
    $line = '';
    foreach ($words as $word) {
        $candidate = $line === '' ? $word : $line . ' ' . $word;
        if (mb_strlen($candidate) > $maxChars && $line !== '') {
            $lines[] = $line;
            $line = $word;
        } else {
            $line = $candidate;
        }
    }
    if ($line !== '') $lines[] = $line;
    return $lines;
}

function drawBase($img, string $title, array $slide, int $frameInSlide, int $framesInSlide, array $fonts): void {
    [$fontRegular, $fontBold] = $fonts;
    $bg = c($img, '#0E1117');
    imagefilledrectangle($img, 0, 0, 1920, 1080, $bg);
    for ($i = 0; $i < 260; $i++) {
        $shade = imagecolorallocatealpha($img, 18 + (int)($i / 14), 24 + (int)($i / 16), 34 + (int)($i / 18), 0);
        imageline($img, 0, $i, 1920, $i, $shade);
    }

    rr($img, 70, 60, 1780, 860, 22, c($img, '#151B23'));
    rr($img, 90, 82, 310, 816, 18, c($img, '#0B0F14'));
    rr($img, 430, 82, 1400, 816, 18, c($img, '#10161F'));

    txt($img, 'TaskFlow', 34, 132, 145, c($img, '#FFFFFF'), $fontBold);
    txt($img, 'Bakudan Ramen operations', 16, 132, 178, c($img, '#9AA4B2'), $fontRegular);
    $items = ['Overview', 'My Tasks', 'Calendar', 'Inbox', 'Projects', 'Bills', 'Admin'];
    $activeMap = [
        'login' => '',
        'overview' => 'Overview',
        'tasks' => 'My Tasks',
        'create' => 'Projects',
        'calendar' => 'Calendar',
        'detail' => 'My Tasks',
        'admin' => 'Admin',
        'done' => 'Overview',
    ];
    $active = $activeMap[$slide['screen']] ?? '';
    foreach ($items as $i => $item) {
        $y = 235 + $i * 66;
        if ($item === $active) rr($img, 118, $y - 34, 244, 46, 10, c($img, '#223B5F'));
        txt($img, $item, 19, 154, $y, $item === $active ? c($img, '#FFFFFF') : c($img, '#A9B4C2'), $fontRegular);
    }

    txt($img, $title, 42, 480, 158, c($img, '#FFFFFF'), $fontBold);
    $progress = $framesInSlide > 1 ? $frameInSlide / ($framesInSlide - 1) : 1;
    rr($img, 480, 182, (int)(420 + 180 * $progress), 8, 4, c($img, '#3B82F6'));
}

function card($img, int $x, int $y, int $w, int $h, string $title, string $value, string $accent, array $fonts): void {
    [$fontRegular, $fontBold] = $fonts;
    rr($img, $x, $y, $w, $h, 16, c($img, '#1B2430'));
    imagefilledrectangle($img, $x, $y, $x + 7, $y + $h, c($img, $accent));
    txt($img, $title, 17, $x + 26, $y + 42, c($img, '#9AA4B2'), $fontRegular);
    txt($img, $value, 40, $x + 26, $y + 96, c($img, '#FFFFFF'), $fontBold);
}

function drawScreen($img, string $screen, array $fonts, float $p): void {
    [$fontRegular, $fontBold] = $fonts;
    if ($screen === 'login') {
        rr($img, 930, 255, 520, 470, 22, c($img, '#1B2430'));
        txt($img, 'Sign in', 34, 1190, 330, c($img, '#FFFFFF'), $fontBold, 'center');
        txt($img, 'Email', 17, 1015, 397, c($img, '#A9B4C2'), $fontRegular);
        rr($img, 1015, 420, 350, 54, 10, c($img, '#0E1117'));
        txt($img, 'hoangdle@gmail.com', 20, 1040, 455, c($img, '#FFFFFF'), $fontRegular);
        txt($img, 'Password', 17, 1015, 510, c($img, '#A9B4C2'), $fontRegular);
        rr($img, 1015, 533, 350, 54, 10, c($img, '#0E1117'));
        txt($img, '••••••••••', 20, 1040, 568, c($img, '#FFFFFF'), $fontRegular);
        rr($img, 1015, 625, 350, 58, 10, c($img, '#DC2626'));
        txt($img, 'Log in', 21, 1190, 662, c($img, '#FFFFFF'), $fontBold, 'center');
        txt($img, 'Use the assigned account', 19, 520, 420, c($img, '#A9B4C2'), $fontRegular);
        txt($img, 'to access live work.', 19, 520, 458, c($img, '#A9B4C2'), $fontRegular);
        txt($img, 'Keep passwords private.', 19, 520, 512, c($img, '#FBBF24'), $fontRegular);
        return;
    }
    if ($screen === 'overview') {
        card($img, 500, 240, 290, 145, 'Open tasks', '128', '#3B82F6', $fonts);
        card($img, 820, 240, 290, 145, 'Overdue', '17', '#EF4444', $fonts);
        card($img, 1140, 240, 290, 145, 'Due today', '24', '#F59E0B', $fonts);
        card($img, 1460, 240, 290, 145, 'Completed', '82%', '#10B981', $fonts);
        rr($img, 500, 430, 800, 300, 16, c($img, '#1B2430'));
        txt($img, 'Workload by team', 24, 535, 480, c($img, '#FFFFFF'), $fontBold);
        for ($i = 0; $i < 5; $i++) {
            $y = 535 + $i * 38;
            txt($img, ['Kitchen', 'Finance', 'Marketing', 'Store A', 'Store B'][$i], 17, 535, $y, c($img, '#A9B4C2'), $fontRegular);
            rr($img, 690, $y - 19, 420, 18, 9, c($img, '#0E1117'));
            rr($img, 690, $y - 19, (int)(120 + $i * 56), 18, 9, c($img, ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'][$i]));
        }
        rr($img, 1340, 430, 390, 300, 16, c($img, '#1B2430'));
        txt($img, 'Risk queue', 24, 1375, 480, c($img, '#FFFFFF'), $fontBold);
        foreach (['Late vendor payment', 'Unassigned opening task', 'Deadline extension request'] as $i => $line) {
            txt($img, $line, 17, 1375, 540 + $i * 55, c($img, '#DDE4EE'), $fontRegular);
        }
        return;
    }
    if ($screen === 'tasks') {
        rr($img, 500, 240, 1230, 90, 16, c($img, '#1B2430'));
        txt($img, 'Filters: Today  |  Overdue  |  High priority  |  Completed', 22, 535, 296, c($img, '#DDE4EE'), $fontRegular);
        $rows = ['Check morning prep list', 'Approve vendor invoice', 'Update social content calendar', 'Review team handoff notes', 'Confirm closing checklist'];
        foreach ($rows as $i => $row) {
            $y = 365 + $i * 82;
            rr($img, 500, $y, 1230, 62, 12, c($img, $i === 1 ? '#2B1E22' : '#17202B'));
            imagefilledellipse($img, 535, $y + 31, 24, 24, c($img, $i === 1 ? '#EF4444' : '#3B82F6'));
            txt($img, $row, 21, 570, $y + 39, c($img, '#FFFFFF'), $fontRegular);
            txt($img, $i === 1 ? 'Overdue' : 'Due soon', 15, 1540, $y + 38, c($img, $i === 1 ? '#FCA5A5' : '#93C5FD'), $fontBold);
        }
        return;
    }
    if ($screen === 'create') {
        rr($img, 600, 230, 820, 555, 20, c($img, '#1B2430'));
        txt($img, 'Create Task', 32, 1010, 300, c($img, '#FFFFFF'), $fontBold, 'center');
        foreach ([['Title', 'Prepare weekend store checklist'], ['Project', 'Store Operations'], ['Assignee', 'Team member'], ['Due date', '2026-05-29'], ['Priority', 'High']] as $i => $field) {
            $y = 350 + $i * 76;
            txt($img, $field[0], 16, 670, $y, c($img, '#A9B4C2'), $fontRegular);
            rr($img, 670, $y + 14, 570, 46, 9, c($img, '#0E1117'));
            txt($img, $field[1], 18, 692, $y + 45, c($img, '#FFFFFF'), $fontRegular);
        }
        rr($img, 1090, 715, 150, 52, 10, c($img, '#DC2626'));
        txt($img, 'Save', 20, 1165, 748, c($img, '#FFFFFF'), $fontBold, 'center');
        return;
    }
    if ($screen === 'calendar') {
        rr($img, 500, 240, 760, 560, 16, c($img, '#1B2430'));
        txt($img, 'May 2026', 28, 880, 300, c($img, '#FFFFFF'), $fontBold, 'center');
        for ($r = 0; $r < 5; $r++) {
            for ($col = 0; $col < 7; $col++) {
                $x = 535 + $col * 98;
                $y = 340 + $r * 78;
                rr($img, $x, $y, 82, 58, 8, c($img, ($r === 3 && $col === 4) ? '#223B5F' : '#10161F'));
                txt($img, (string)($r * 7 + $col + 1), 15, $x + 12, $y + 23, c($img, '#A9B4C2'), $fontRegular);
            }
        }
        rr($img, 1310, 240, 420, 560, 16, c($img, '#1B2430'));
        txt($img, 'Inbox', 28, 1345, 300, c($img, '#FFFFFF'), $fontBold);
        foreach (['New assignment', 'Comment mentioned you', 'Task due tomorrow', 'Overdue escalation'] as $i => $line) {
            rr($img, 1345, 340 + $i * 88, 335, 58, 10, c($img, '#10161F'));
            txt($img, $line, 17, 1370, 375 + $i * 88, c($img, '#DDE4EE'), $fontRegular);
        }
        return;
    }
    if ($screen === 'detail') {
        rr($img, 500, 240, 1230, 560, 16, c($img, '#1B2430'));
        txt($img, 'Approve vendor invoice', 34, 545, 310, c($img, '#FFFFFF'), $fontBold);
        rr($img, 545, 345, 148, 42, 8, c($img, '#2B1E22'));
        txt($img, 'High priority', 16, 565, 372, c($img, '#FCA5A5'), $fontBold);
        txt($img, 'Assignee: Hoang Dle', 19, 545, 440, c($img, '#DDE4EE'), $fontRegular);
        txt($img, 'Due date: 2026-05-29', 19, 545, 482, c($img, '#DDE4EE'), $fontRegular);
        rr($img, 545, 545, 230, 56, 10, c($img, '#10B981'));
        txt($img, 'Mark complete', 20, 660, 581, c($img, '#FFFFFF'), $fontBold, 'center');
        rr($img, 810, 545, 230, 56, 10, c($img, '#223B5F'));
        txt($img, 'Comment', 20, 925, 581, c($img, '#FFFFFF'), $fontBold, 'center');
        rr($img, 1130, 385, 500, 300, 14, c($img, '#10161F'));
        txt($img, 'Activity', 24, 1165, 440, c($img, '#FFFFFF'), $fontBold);
        foreach (['Status updated', 'Deadline changed', 'Comment added'] as $i => $line) {
            txt($img, $line, 17, 1165, 500 + $i * 54, c($img, '#A9B4C2'), $fontRegular);
        }
        return;
    }
    if ($screen === 'admin') {
        foreach ([['Users', 'Create, edit, deactivate'], ['Stores', 'Track store work'], ['Vendors', 'Manage suppliers'], ['Bills', 'Payment calendar'], ['Penalty', 'Late task policy'], ['Extensions', 'Approve deadline requests']] as $i => $tile) {
            $x = 500 + ($i % 3) * 405;
            $y = 260 + intdiv($i, 3) * 220;
            rr($img, $x, $y, 360, 165, 16, c($img, '#1B2430'));
            txt($img, $tile[0], 28, $x + 30, $y + 62, c($img, '#FFFFFF'), $fontBold);
            txt($img, $tile[1], 17, $x + 30, $y + 105, c($img, '#A9B4C2'), $fontRegular);
        }
        return;
    }
    rr($img, 600, 300, 720, 330, 24, c($img, '#1B2430'));
    txt($img, 'Ready for daily use', 40, 960, 410, c($img, '#FFFFFF'), $fontBold, 'center');
    txt($img, 'Overview → My Tasks → Calendar → Inbox', 23, 960, 485, c($img, '#DDE4EE'), $fontRegular, 'center');
    txt($img, 'Keep work updated as it happens.', 22, 960, 540, c($img, '#93C5FD'), $fontRegular, 'center');
}

function drawCaption($img, string $caption, array $fonts): void {
    [$fontRegular, $fontBold] = $fonts;
    rr($img, 210, 930, 1500, 104, 18, c($img, '#000000', 45));
    $lines = wrapLines($caption, 92);
    $y = count($lines) === 1 ? 992 : 972;
    foreach ($lines as $line) {
        txt($img, $line, 24, 960, $y, c($img, '#FFFFFF'), $fontBold, 'center');
        $y += 36;
    }
}

function drawCursor($img, string $screen, float $p): void {
    $points = [
        'login' => [1362, 650, 1160, 448],
        'overview' => [735, 300, 1530, 600],
        'tasks' => [1548, 485, 620, 396],
        'create' => [1168, 742, 690, 395],
        'calendar' => [1125, 650, 1520, 365],
        'detail' => [660, 572, 915, 572],
        'admin' => [690, 330, 1490, 548],
        'done' => [880, 485, 1040, 485],
    ];
    [$x1, $y1, $x2, $y2] = $points[$screen] ?? [960, 540, 960, 540];
    $t = min(1, max(0, $p));
    $x = (int)($x1 + ($x2 - $x1) * $t);
    $y = (int)($y1 + ($y2 - $y1) * $t);
    imagefilledellipse($img, $x, $y, 34, 34, c($img, '#FFFFFF'));
    imagefilledellipse($img, $x, $y, 20, 20, c($img, '#DC2626'));
}

function srtTime(float $seconds): string {
    $ms = (int)round(($seconds - floor($seconds)) * 1000);
    $whole = (int)floor($seconds);
    $h = intdiv($whole, 3600);
    $m = intdiv($whole % 3600, 60);
    $s = $whole % 60;
    return sprintf('%02d:%02d:%02d,%03d', $h, $m, $s, $ms);
}

$srt = '';
$story = "# TaskFlow User Guide Walkthrough\n\nAccount shown in the guide: `hoangdle@gmail.com`.\n\n";
$time = 0.0;
foreach ($slides as $i => $slide) {
    $start = $time;
    $end = $time + $slide['duration'];
    $srt .= ($i + 1) . "\n" . srtTime($start) . ' --> ' . srtTime($end) . "\n" . $slide['caption'] . "\n\n";
    $story .= ($i + 1) . ". **{$slide['title']}** ({$slide['duration']}s): {$slide['caption']}\n";
    $time = $end;
}
file_put_contents($srtPath, $srt);
file_put_contents($storyPath, $story);

if (($argv[1] ?? '') !== '--frames') {
    echo "Wrote:\n- {$srtPath}\n- {$storyPath}\nRun with --frames to stream JPEG frames.\n";
    exit(0);
}

foreach ($slides as $slide) {
    $frames = (int)($slide['duration'] * $fps);
    for ($f = 0; $f < $frames; $f++) {
        $img = imagecreatetruecolor($width, $height);
        imagesavealpha($img, true);
        imageantialias($img, true);
        drawBase($img, $slide['title'], $slide, $f, $frames, [$fontRegular, $fontBold]);
        $p = $frames > 1 ? $f / ($frames - 1) : 1;
        drawScreen($img, $slide['screen'], [$fontRegular, $fontBold], $p);
        drawCursor($img, $slide['screen'], $p);
        drawCaption($img, $slide['caption'], [$fontRegular, $fontBold]);
        imagejpeg($img, null, 92);
    }
}
