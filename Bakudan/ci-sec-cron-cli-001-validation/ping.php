<?php
// Bare diagnostic — NO requires, NO includes
header('Content-Type: application/json');
$root = __DIR__;
$result = [
    'status' => 'ok',
    'time' => date('c'),
    'cwd' => getcwd(),
    'root' => $root,
    'script' => $_SERVER['SCRIPT_FILENAME'] ?? '?',
    'request_uri' => $_SERVER['REQUEST_URI'] ?? '?',
    'auto_prepend' => ini_get('auto_prepend_file'),
    'section_exists' => file_exists($root . '/models/Section.php'),
    'index_exists' => file_exists($root . '/index.php'),
    'git_head' => trim(@file_get_contents($root . '/.git/HEAD') ?: 'no .git'),
    'git_log' => trim(shell_exec("cd {$root} && git log --oneline -3 2>&1") ?: 'no git'),
    'ls_models' => array_slice(scandir($root . '/models') ?: [], 0, 20),
];
echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
