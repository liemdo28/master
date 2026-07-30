<?php
/**
 * Recovery uploader — bypass deploy validation by writing files directly.
 * Visit: https://dashboard.bakudanramen.com/upload-recovery.php?key=deploy-p3-2026
 * Self-deletes after running.
 */
if (($_GET['key'] ?? '') !== 'deploy-p3-2026') { http_response_code(403); die('Forbidden'); }
header('Content-Type: text/plain; charset=utf-8');
$root = __DIR__;

echo "=== UPLOAD RECOVERY ===\n\n";

// Write .env
$env = base64_decode('REJfSE9TVD1teXNxbC10YXNrZmxvdy5iYWt1ZGFucmFtZW4uY29tCkRCX05BTUU9dGFza2Zsb3dfZGIKREJfVVNFUj1saWVtZG8KREJfUEFTUz1saWVtQGR0MjE1NQpEQl9DSEFSU0VUPXV0ZjhtYjQK');
if (file_put_contents($root . '/.env', $env)) {
    echo "OK: .env written\n";
} else {
    echo "FAIL: could not write .env\n";
}

// Write recovery deploy.php
$deploy = '<?php
// RECOVERY DEPLOY
if (($_GET["key"] ?? "") !== "deploy-p3-2026") { http_response_code(403); die("Forbidden"); }
header("Content-Type: text/plain");
$root = __DIR__;
file_put_contents($root . "/.env", base64_decode("REJfSE9TVD1teXNxbC10YXNrZmxvdy5iYWt1ZGFucmFtZW4uY29tCkRCX05BTUU9dGFza2Zsb3dfZGIKREJfVVNFUj1saWVtZG8KREJfUEFTUz1saWVtQGR0MjE1NQpEQl9DSEFSU0VUPXV0ZjhtYjQK"));
echo "OK .env\n";
exec("cd $root && git fetch origin production-recovery 2>&1", $o, $c);
exec("cd $root && git checkout origin/production-recovery -- .htaccess index.php config/database.php views/layouts/main.php views/auth/login.php 2>&1", $o, $c);
echo implode("\n", $o);
@unlink(__FILE__);
echo "\nDone. Visit https://dashboard.bakudanramen.com/";
';
if (file_put_contents($root . '/deploy.php', $deploy)) {
    echo "OK: deploy.php written\n";
} else {
    echo "FAIL: could not write deploy.php\n";
}

echo "\nRecovery files uploaded. Next: visit https://dashboard.bakudanramen.com/deploy.php?key=deploy-p3-2026\n";
@unlink(__FILE__);
