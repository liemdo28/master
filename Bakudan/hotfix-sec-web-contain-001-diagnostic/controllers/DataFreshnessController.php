<?php

class DataFreshnessController {
    private $db;
    private $miApiBase = 'http://127.0.0.1:4001';

    public function __construct() {
        $this->db = Database::getInstance();
    }

    public function index() {
        if (!isAdmin()) { redirect('dashboard'); return; }
        $visibilityData = $this->fetchMiApi('/api/visibility/quickbooks');
        $mirrorSummary  = $this->fetchMiApi('/api/qb/mirror/summary');
        $companyList    = $this->fetchMiApi('/api/qb/mirror/companies');
        $apiAccounts    = $this->fetchMiApi('/api/qb/mirror/accounts');
        if (!$visibilityData) { $visibilityData = $this->loadVisibilityCacheJson(); }
        $qbOverview      = $this->buildQbOverview($visibilityData, $apiAccounts);
        $importCoverage  = $this->buildImportCoverage($visibilityData, $mirrorSummary);
        $accountCoverage = $this->buildAccountCoverage($visibilityData, $apiAccounts);
        $accountRows    = $this->buildAccountRows($visibilityData);
        $companyRows     = $this->buildCompanyRows($visibilityData, $companyList);
        require __DIR__ . '/../views/admin/data_freshness.php';
    }

    protected function fetchMiApi(string $endpoint): ?array {
        $url = $this->miApiBase . $endpoint;
        $ctx = stream_context_create(['http' => ['timeout' => 5, 'ignore_errors' => true]]);
        $raw = @file_get_contents($url, false, $ctx);
        if ($raw === false) return null;
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : null;
    }

    protected function loadVisibilityCacheJson(): ?array {
        $paths = [
            'D:/Project/Master/.local-agent-global/visibility/quickbooks/data.json',
            dirname(__DIR__, 2) . '/.local-agent-global/visibility/quickbooks/data.json',
        ];
        foreach ($paths as $p) {
            if (is_file($p)) {
                $raw = @file_get_contents($p);
                $decoded = json_decode($raw ?? '', true);
                if (is_array($decoded)) return $decoded;
            }
        }
        return null;
    }

    protected function buildQbOverview(array|null $visibility, array|null $apiAccounts): array {
        $coa = $visibility['chart_of_accounts'] ?? ($visibility['summary'] ?? []);
        $lastSync = $visibility['last_sync_timestamp'] ?? ($visibility['last_successful_sync'] ?? null);
        // Count accounts from Raw Stockton only (company_file_id = qb-mirror primary)
        $rawStocktonCid = 'QzpcUUIgRGF0YVxSYXcgU3RvY2t0b25c';
        $rsAccounts = [];
        if (is_array($apiAccounts) && isset($apiAccounts['accounts']) && is_array($apiAccounts['accounts'])) {
            foreach ($apiAccounts['accounts'] as $acc) {
                if (($acc['company_file_id'] ?? '') === $rawStocktonCid) {
                    $rsAccounts[] = $acc;
                }
            }
        }
        $rsTypeCounts = [];
        foreach ($rsAccounts as $acc) {
            $t = $acc['account_type'] ?? 'Unknown';
            $rsTypeCounts[$t] = ($rsTypeCounts[$t] ?? 0) + 1;
        }
        $rsTotal = count($rsAccounts);
        return [
            'generated_at'=>$visibility['generated_at']??null,
            'cache_source'=>($visibility['generated_at']??null)?'Mi API':'File cache',
            'last_sync_timestamp'=>$lastSync,
            'last_sync_status'=>$visibility['last_sync_status']??'unknown',
            'status'=>$visibility['dashboard_status']??$visibility['status']??'unknown',
            'certified'=>(bool)($visibility['certified']??false),
            'coverage_ok'=>$rsTotal > 0 && ($coa['coverage_ok'] ?? false), // derive from RS counts
            'certified_green'=>$rsTotal > 0 && ($coa['certified_green'] ?? false),
            // Use Raw Stockton account counts (from qb-mirror per-company)
            'total_accounts'=>$rsTotal,
            'total_bank_accounts'=>(int)($rsTypeCounts['Bank'] ?? 0),
            'total_credit_card_accounts'=>(int)($rsTypeCounts['CreditCard'] ?? 0),
            'total_income_accounts'=>(int)($rsTypeCounts['Income'] ?? 0),
            'total_expense_accounts'=>(int)($rsTypeCounts['Expense'] ?? 0),
            // Dates from visibility (all companies, use what is available)
            'latest_account_sync_at'=>$coa['latest_account_sync_at']??null,
            'latest_sales_receipt_date'=>$coa['latest_sales_receipt_date']??null,
            'latest_bank_transaction_date'=>$coa['latest_bank_transaction_date']??null,
            'latest_credit_card_transaction_date'=>$coa['latest_credit_card_transaction_date']??null,
            'mirror_source'=>$coa['source']??null,
            'gaps'=>$visibility['gaps']??[],
            'action_required'=>(bool)($visibility['action_required']??false),
            'required_dev1_action'=>$visibility['required_dev1_action']??null,
        ];
    }

    protected function buildImportCoverage(array|null $visibility, array|null $mirror): array {
        $coa=$visibility['chart_of_accounts']??($visibility['summary']??[]);
        $mirSum=$mirror['summary']??[];
        return [
            ['data_type'=>'Chart of Accounts','records'=>(int)($coa['total_accounts']??$mirSum['accounts']??0),'latest_date'=>$coa['latest_account_sync_at']??null,'status'=>$this->importCoverageStatus($visibility),'source'=>'chart_of_accounts / qb-mirror.db'],
            ['data_type'=>'Sales Receipts','records'=>(int)($mirSum['sales_receipts']??$coa['sales_receipts']??0),'latest_date'=>$coa['latest_sales_receipt_date']??null,'status'=>$this->txnFreshnessStatus($coa['latest_sales_receipt_date']??null),'source'=>'SalesReceipt / qb-mirror.db'],
            ['data_type'=>'Checks','records'=>(int)($mirSum['checks']??0),'latest_date'=>null,'status'=>($mirSum['checks']??0)>0?'fresh':'missing','source'=>'Check / qb-mirror.db'],
            ['data_type'=>'Deposits','records'=>(int)($mirSum['deposits']??0),'latest_date'=>null,'status'=>($mirSum['deposits']??0)>0?'fresh':'missing','source'=>'Deposit / qb-mirror.db'],
            ['data_type'=>'Credit Card Charges','records'=>(int)($mirSum['credit_card_charges']??0),'latest_date'=>$coa['latest_credit_card_transaction_date']??null,'status'=>$this->txnFreshnessStatus($coa['latest_credit_card_transaction_date']??null),'source'=>'CreditCardCharge / qb-mirror.db'],
            ['data_type'=>'Credit Card Credits','records'=>(int)($mirSum['credit_card_credits']??0),'latest_date'=>$coa['latest_credit_card_transaction_date']??null,'status'=>($mirSum['credit_card_credits']??0)>0?$this->txnFreshnessStatus($coa['latest_credit_card_transaction_date']??null):'missing','source'=>'CreditCardCredit / qb-mirror.db'],
            ['data_type'=>'Bank Accounts','records'=>(int)($coa['total_bank_accounts']??0),'latest_date'=>$coa['latest_bank_transaction_date']??null,'status'=>$this->txnFreshnessStatus($coa['latest_bank_transaction_date']??null),'source'=>'chart_of_accounts type=Bank'],
            ['data_type'=>'Credit Card Accounts','records'=>(int)($coa['total_credit_card_accounts']??0),'latest_date'=>$coa['latest_credit_card_transaction_date']??null,'status'=>$this->txnFreshnessStatus($coa['latest_credit_card_transaction_date']??null),'source'=>'chart_of_accounts type=CreditCard'],
        ];
    }

    protected function buildAccountCoverage(array|null $visibility, array|null $apiAccounts): array {
        $typeMap=['Bank'=>'Bank','CreditCard'=>'Credit Card','Income'=>'Income','Expense'=>'Expense','AccountsReceivable'=>'Accounts Receivable','AccountsPayable'=>'Accounts Payable','CostOfGoodsSold'=>'Cost of Goods Sold','Equity'=>'Equity','FixedAsset'=>'Fixed Asset','LongTermLiability'=>'Long Term Liability','OtherAsset'=>'Other Asset','OtherCurrentAsset'=>'Other Current Asset','OtherCurrentLiability'=>'Other Current Liability','OtherExpense'=>'Other Expense','OtherIncome'=>'Other Income'];
        // Filter accounts to Raw Stockton only for Chart of Accounts Coverage
        $rawStocktonCid = 'QzpcUUIgRGF0YVxSYXcgU3RvY2t0b25c';
        $accounts = [];
        if (is_array($apiAccounts) && isset($apiAccounts['accounts']) && is_array($apiAccounts['accounts'])) {
            foreach ($apiAccounts['accounts'] as $acc) {
                if (($acc['company_file_id'] ?? '') === $rawStocktonCid) {
                    $accounts[] = $acc;
                }
            }
        }
        $counts = [];
        foreach ($accounts as $acc) {
            $t = $acc['account_type'] ?? 'Unknown';
            $counts[$t] = ($counts[$t] ?? 0) + 1;
        }
        $rows=[];
        foreach($typeMap as $key=>$label){$count=(int)($counts[$key]??0);$min=($key==='Bank'||$key==='CreditCard')?1:0;$status=($count>=$min)?'fresh':($count>0?'stale':'missing');$rows[]=['type'=>$label,'type_key'=>$key,'count'=>$count,'min_expected'=>$min,'status'=>$status];}
        return $rows;
    }

    protected function buildAccountRows(array|null $visibility): array {
        $coa=$visibility['chart_of_accounts']??($visibility['summary']??[]);
        $apiAccounts=$this->fetchMiApi('/api/qb/mirror/accounts');
        if (is_array($apiAccounts) && isset($apiAccounts['accounts']) && is_array($apiAccounts['accounts'])) {
            $rows=[];
            foreach($apiAccounts['accounts'] as $row){
                if(!is_array($row))continue;
                $type=(string)($row['account_type']??'Unknown');
                $classification=$this->classifyType($type);
                $latestTxn=null;
                if($classification==='Bank')$latestTxn=$coa['latest_bank_transaction_date']??null;
                elseif($classification==='Credit Card')$latestTxn=$coa['latest_credit_card_transaction_date']??null;
                $rows[]=[
                    'name'=>$row['full_name']?:($row['name']??'Unnamed'),
                    'account_number'=>$row['account_number']??null,
                    'account_type'=>$type,
                    'classification'=>$classification,
                    'balance'=>$row['total_balance']??($row['balance']??null),
                    'last_transaction_date'=>$latestTxn,
                    'last_sync_at'=>$row['synced_at']??($coa['latest_account_sync_at']??null)
                ];
            }
            usort($rows,fn($a,$b)=>[$a['classification'],$a['name']]<=>[$b['classification'],$b['name']]);
            return $rows;
        }

        $mirrorPaths=['D:/Project/Master/.local-agent-global/quickbooks/qb-mirror.db','D:/Project/Master/mi-core/data/qb-mirror.db'];
        foreach($mirrorPaths as $dbPath){
            if(!is_file($dbPath))continue;
            try{
                $pdo=new PDO("sqlite:$dbPath");
                $pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
                $stmt=$pdo->query("
                    SELECT
                        a.name,
                        a.full_name,
                        a.account_number,
                        a.account_type,
                        COALESCE(a.total_balance, a.balance) AS balance_amt,
                        CASE
                            WHEN a.account_type='Bank' THEN (
                                SELECT MAX(txn_date) FROM (
                                    SELECT c.txn_date FROM qb_checks c
                                    WHERE c.company_file_id=a.company_file_id AND (c.bank_account_name=a.full_name OR c.bank_account_name=a.name)
                                    UNION ALL
                                    SELECT d.txn_date FROM qb_deposits d
                                    WHERE d.company_file_id=a.company_file_id AND (d.account_name=a.full_name OR d.account_name=a.name)
                                )
                            )
                            WHEN a.account_type='CreditCard' THEN (
                                SELECT MAX(txn_date) FROM (
                                    SELECT cc.txn_date FROM qb_credit_card_charges cc
                                    WHERE cc.company_file_id=a.company_file_id AND (cc.account_name=a.full_name OR cc.account_name=a.name)
                                    UNION ALL
                                    SELECT cr.txn_date FROM qb_credit_card_credits cr
                                    WHERE cr.company_file_id=a.company_file_id AND (cr.account_name=a.full_name OR cr.account_name=a.name)
                                )
                            )
                            ELSE NULL
                        END AS latest_txn_date,
                        a.synced_at AS latest_sync_at
                    FROM qb_accounts a
                    ORDER BY a.account_type, COALESCE(a.full_name, a.name)
                    LIMIT 500
                ");
                $rows=[];
                while($row=$stmt->fetch(PDO::FETCH_ASSOC)){
                    $typeKey=$this->classifyType($row['account_type']??'');
                    $rows[]=[
                        'name'=>$row['full_name']?:($row['name']??'Unnamed'),
                        'account_number'=>$row['account_number']??null,
                        'account_type'=>$row['account_type']??'Unknown',
                        'classification'=>$typeKey,
                        'balance'=>$row['balance_amt']??null,
                        'last_transaction_date'=>$row['latest_txn_date']??null,
                        'last_sync_at'=>$row['latest_sync_at']??null
                    ];
                }
                return $rows;
            }catch(Throwable $e){error_log('[DATA-FRESHNESS] SQLite read failed: '.$e->getMessage());}
        }
        return [];
    }

    protected function classifyType(string $type): string {
        $t=strtolower($type);
        if(strpos($t,'creditcard')!==false)return 'Credit Card';
        if(strpos($t,'bank')!==false)return 'Bank';
        if(strpos($t,'cash')!==false)return 'Cash';
        if(stripos($type,'Income')!==false)return 'Income';
        if(stripos($type,'Expense')!==false)return 'Expense';
        return 'Other';
    }

    protected function importCoverageStatus(array|null $visibility): string {
        $coa=$visibility['chart_of_accounts']??($visibility['summary']??[]);
        if(($coa['coverage_ok']??false))return 'fresh';
        return (int)($coa['total_accounts']??0)>0?'stale':'missing';
    }

    protected function txnFreshnessStatus(?string $date): string {
        if(!$date||strtotime($date)===false)return 'missing';
        $days=(time()-strtotime($date))/86400;
        if($days<=3)return 'fresh';
        if($days<=14)return 'stale';
        return 'blocked';
    }

    protected function buildCompanyRows(array|null $visibility, array|null $companyList): array {
        $companies = $companyList['companies'] ?? [];
        $apiAccounts = $this->fetchMiApi('/api/qb/mirror/accounts');
        $accounts = is_array($apiAccounts) && isset($apiAccounts['accounts']) ? $apiAccounts['accounts'] : [];

        // Group accounts by company_file_id
        $byCompany = [];
        foreach ($accounts as $acc) {
            $cid = $acc['company_file_id'] ?? 'unknown';
            if (!isset($byCompany[$cid])) $byCompany[$cid] = [];
            $byCompany[$cid][] = $acc;
        }

        $rows = [];
        $visMachines = $visibility['machines'] ?? [];

        // Build machine_id -> store_name map
        $machineStoreMap = [];
        foreach ($visMachines as $m) {
            $machineStoreMap[$m['machine_id'] ?? ''] = $m['store_name'] ?? $m['store_code'] ?? 'unknown';
        }

        foreach ($companies as $co) {
            $cid = $co['company_file_id'] ?? '';
            $accList = $byCompany[$cid] ?? [];
            $typeCounts = [];
            foreach ($accList as $acc) {
                $t = $acc['account_type'] ?? 'Unknown';
                $typeCounts[$t] = ($typeCounts[$t] ?? 0) + 1;
            }
            $bank = $typeCounts['Bank'] ?? 0;
            $cc = $typeCounts['CreditCard'] ?? 0;
            $income = $typeCounts['Income'] ?? 0;
            $expense = $typeCounts['Expense'] ?? 0;
            $total = count($accList);
            $machineId = $co['machine_id'] ?? '';
            $storeName = $machineStoreMap[$machineId] ?? $machineId;
            $lastSync = $co['last_sync_at'] ?? null;
            $syncDays = $lastSync ? (time() - strtotime($lastSync)) / 86400 : null;
            $syncStatus = $syncDays !== null
                ? ($syncDays <= 1 ? 'fresh' : ($syncDays <= 7 ? 'stale' : 'blocked'))
                : 'missing';
            $rows[] = [
                'company_name'   => $this->extractCompanyName($co['company_file_path'] ?? $cid),
                'company_path'   => $co['company_file_path'] ?? $cid,
                'machine_id'     => $machineId,
                'store_name'    => $storeName,
                'last_sync_at'   => $lastSync,
                'sync_status'   => $syncStatus,
                'total_accounts'=> $total,
                'bank_accounts' => $bank,
                'cc_accounts'   => $cc,
                'income_accounts'=> $income,
                'expense_accounts'=> $expense,
                'type_counts'   => $typeCounts,
            ];
        }

        // Raw Stockton is already included via the companies loop above.
        // No fallback needed since /api/qb/mirror/companies returns all 8.

        usort($rows, fn($a,$b) => strcmp($a['store_name'] ?? '', $b['store_name'] ?? ''));
        return $rows;
    }

    protected function extractCompanyName(string $path): string {
        // Extract friendly name from path segments
        $segments = explode('\\', str_replace('/', '\\', $path));
        $filename = end($segments);
        $filename = preg_replace('/\s*\([^)]*\)\s*\.qbw$/i', '', $filename);
        $filename = preg_replace('/\.qbw$/i', '', $filename);
        if (stripos($path, 'Raw Stockton') !== false) return 'Raw Stockton';
        if (stripos($path, 'Bakudan\\B1') !== false) return 'Bakudan B1';
        if (stripos($path, 'Bakudan\\B2') !== false) return 'Bakudan B2';
        if (stripos($path, 'Bakudan\\B3') !== false) return 'Bakudan B3';
        if (stripos($path, 'IFT') !== false && stripos($path, 'Jinya') !== false) return 'IFT Jinya Ramen';
        if (stripos($path, 'IFT') !== false && stripos($path, 'tea') !== false) return 'IFT New Tea House';
        if (stripos($path, 'Copper') !== false) return 'The Coppers LLC';
        return $filename ?: 'Unknown Company';
    }
}

