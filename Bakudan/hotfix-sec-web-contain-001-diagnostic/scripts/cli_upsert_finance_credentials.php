<?php
/**
 * Idempotent finance credential metadata import.
 *
 * Password values are intentionally read from environment variables so secrets
 * never live in git. When an env var is missing, metadata is still updated and
 * the existing encrypted password, if any, is left unchanged.
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('CLI only.');
}

chdir(dirname(__DIR__));
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../service/EncryptionService.php';
require_once __DIR__ . '/../models/Credential.php';

$db = Database::getInstance();
$model = new Credential();

function financeStoreId(Database $db, array $patterns): ?int {
    foreach ($patterns as $pattern) {
        $row = $db->fetch(
            "SELECT id FROM stores WHERE LOWER(name) LIKE ? ORDER BY id LIMIT 1",
            [$pattern]
        );
        if ($row) {
            return (int)$row['id'];
        }
    }
    return null;
}

function financeEnv(?string $name): ?string {
    if ($name === null) return null;
    $value = getenv($name);
    return ($value === false || $value === '') ? null : $value;
}

$stores = [
    'b1' => financeStoreId($db, ['%the rim%', '%(b1)%', 'b1%']),
    'b2' => financeStoreId($db, ['%stone oak%', '%(b2)%', 'b2%']),
    'b3' => financeStoreId($db, ['%bandera%', '%(b3)%', 'b3%']),
    'modesto' => financeStoreId($db, ['%modesto%']),
    'raw' => financeStoreId($db, ['%raw stockton%', '%stockton%', '%raw%']),
];

$owner = $db->fetch(
    "SELECT id FROM users WHERE role IN ('admin','ceo') ORDER BY CASE WHEN role='admin' THEN 0 ELSE 1 END, id LIMIT 1"
);
$ownerId = (int)($owner['id'] ?? 0);
if (!$ownerId) {
    echo "No admin/ceo user found; aborting.\n";
    exit(1);
}

$sheet = 'https://docs.google.com/spreadsheets/d/1yHTaQab-N4jNamxeCCLFE9gKu8JxCjHtIKgrIYVx1HI/edit?gid=0#gid=0';

$entries = [
    [
        'service_name' => 'RentPayment - B3 Rent',
        'store_key' => 'b3',
        'website' => 'rentpayment.com',
        'login_url' => 'https://rentpayment.com/pay/login.html',
        'username' => 'bakduanramen3',
        'env' => 'FIN_CRED_B3_RENTPAYMENT_PASSWORD',
        'notes' => 'B3 rent portal.',
    ],
    [
        'service_name' => 'SecureCafe - B1 Rent',
        'store_key' => 'b1',
        'website' => 'securecafe3.com',
        'login_url' => 'https://www.securecafe3.com/newtenantportal/content2/login/?companyID=776&propertyID=139106',
        'username' => 'bakudanramen210@gmail.com',
        'env' => 'FIN_CRED_SECURECAFE_PASSWORD',
        'notes' => 'B1 rent portal. Shared login with B2.',
    ],
    [
        'service_name' => 'SecureCafe - B2 Rent',
        'store_key' => 'b2',
        'website' => 'securecafe3.com',
        'login_url' => 'https://www.securecafe3.com/newtenantportal/content2/login/?companyID=776&propertyID=139106',
        'username' => 'bakudanramen210@gmail.com',
        'env' => 'FIN_CRED_SECURECAFE_PASSWORD',
        'notes' => 'B2 rent portal. Shared login with B1.',
    ],
    [
        'service_name' => 'Texas Comptroller - B1 Sales Tax',
        'store_key' => 'b1',
        'website' => 'security.app.cpa.state.tx.us',
        'login_url' => 'https://security.app.cpa.state.tx.us/public/login',
        'username' => 'bakudanramen210',
        'env' => 'FIN_CRED_TX_COMPTROLLER_PASSWORD',
        'notes' => 'B1 monthly Texas tax filing. Login portal migrated to security.app.cpa.state.tx.us (2026-07-10). Calculation sheet: ' . $sheet,
    ],
    [
        'service_name' => 'Texas Comptroller - B2 Sales Tax',
        'store_key' => 'b2',
        'website' => 'security.app.cpa.state.tx.us',
        'login_url' => 'https://security.app.cpa.state.tx.us/public/login',
        'username' => 'bakudanramen210',
        'env' => 'FIN_CRED_TX_COMPTROLLER_PASSWORD',
        'notes' => 'B2 monthly Texas tax filing. Login portal migrated to security.app.cpa.state.tx.us (2026-07-10). Calculation sheet: ' . $sheet,
    ],
    [
        'service_name' => 'Texas Comptroller - B3 Sales Tax',
        'store_key' => 'b3',
        'website' => 'security.app.cpa.state.tx.us',
        'login_url' => 'https://security.app.cpa.state.tx.us/public/login',
        'username' => 'bakudanramen210',
        'env' => 'FIN_CRED_TX_COMPTROLLER_PASSWORD',
        'notes' => 'B3 monthly Texas tax filing. Login portal migrated to security.app.cpa.state.tx.us (2026-07-10). Calculation sheet: ' . $sheet,
    ],
    [
        'service_name' => 'AmTrust Insurance - Modesto',
        'store_key' => 'modesto',
        'website' => 'amtrustgroup.com',
        'login_url' => 'https://auth.amtrustgroup.com/AuthServer/account/login',
        'username' => 'rawsushimodesto',
        'env' => 'FIN_CRED_AMTRUST_MODESTO_PASSWORD',
        'notes' => 'Modesto AmTrust insurance portal.',
    ],
    [
        'service_name' => 'CDTFA - Raw Stockton Sales Tax',
        'store_key' => 'raw',
        'website' => 'onlineservices.cdtfa.ca.gov',
        'login_url' => 'https://onlineservices.cdtfa.ca.gov/_/',
        'username' => 'rawstockton',
        'env' => 'FIN_CRED_CDTFA_RAW_PASSWORD',
        'notes' => 'California CDTFA sales tax filing for Raw Stockton.',
    ],
    [
        'service_name' => 'AT&T - Raw Stockton Phone',
        'store_key' => 'raw',
        'website' => 'att.com',
        'login_url' => 'https://www.att.com/acctsvcs/fastpay',
        'username' => '2096093886',
        'env' => null,
        'notes' => 'AT&T Wireless (NOT AT&T PREPAID) FastPay for Raw Stockton phone line. No login required — pay with account number 2096093886 and ZIP 95219.',
        'credential_type' => 'link',
    ],
    [
        'service_name' => 'CPS Energy - B1',
        'store_key' => 'b1',
        'website' => 'cpsenergy.com',
        'login_url' => 'https://secure.cpsenergy.com/mma/wssHome.jsp',
        'username' => 'Bakudanramen',
        'env' => 'FIN_CRED_CPS_ENERGY_PASSWORD',
        'notes' => 'CPS Energy electric utility portal. Shared login across B1/B2/B3.',
    ],
    [
        'service_name' => 'CPS Energy - B2',
        'store_key' => 'b2',
        'website' => 'cpsenergy.com',
        'login_url' => 'https://secure.cpsenergy.com/mma/wssHome.jsp',
        'username' => 'Bakudanramen',
        'env' => 'FIN_CRED_CPS_ENERGY_PASSWORD',
        'notes' => 'CPS Energy electric utility portal. Shared login across B1/B2/B3.',
    ],
    [
        'service_name' => 'CPS Energy - B3',
        'store_key' => 'b3',
        'website' => 'cpsenergy.com',
        'login_url' => 'https://secure.cpsenergy.com/mma/wssHome.jsp',
        'username' => 'Bakudanramen',
        'env' => 'FIN_CRED_CPS_ENERGY_PASSWORD',
        'notes' => 'CPS Energy electric utility portal. Shared login across B1/B2/B3.',
    ],
];

$created = 0;
$updated = 0;
$skippedPassword = 0;

foreach ($entries as $entry) {
    $storeId = $stores[$entry['store_key']] ?? null;
    if (!$storeId) {
        echo "Skipped {$entry['service_name']}: store not found.\n";
        continue;
    }

    $password = financeEnv($entry['env'] ?? null);
    $data = [
        'service_name' => $entry['service_name'],
        'credential_type' => $entry['credential_type'] ?? 'login',
        'website' => $entry['website'],
        'login_url' => $entry['login_url'],
        'username' => $entry['username'],
        'owner_user_id' => $ownerId,
        'store_id' => $storeId,
        'department' => 'Finance',
        'status' => 'active',
        'notes' => $entry['notes'],
    ];
    if ($password !== null) {
        $data['password'] = $password;
    } elseif (!empty($entry['env'])) {
        $skippedPassword++;
    }

    $existing = $db->fetch(
        "SELECT id FROM credentials WHERE service_name = ? AND store_id = ? AND status != 'deleted' AND deleted_at IS NULL",
        [$entry['service_name'], $storeId]
    );

    if ($existing) {
        $model->update((int)$existing['id'], $data, $ownerId);
        echo "Updated: {$entry['service_name']}\n";
        $updated++;
        continue;
    }

    $model->create($data, $ownerId);
    echo "Created: {$entry['service_name']}\n";
    $created++;
}

echo "Credential import complete: {$created} created, {$updated} updated, {$skippedPassword} password updates skipped because deploy env secrets were not set.\n";
