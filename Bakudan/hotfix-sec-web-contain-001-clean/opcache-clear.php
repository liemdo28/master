<?php
// One-time opcache clear — delete this file after use
if (function_exists('opcache_reset')) {
    opcache_reset();
    echo json_encode(['cleared' => true, 'ts' => time()]);
} else {
    echo json_encode(['cleared' => false, 'note' => 'no opcache']);
}
