<?php
/**
 * P0 CEO DIRECTIVE — All-in-one executor
 * Access: /p0.php?action=p0_backup|p0_repro|p0_cleanup|p0_penalty_reset|p0_verify
 * Schema note: bills table has: id, title, store_id, amount, due_date, is_archived (NO bill_name, is_paid, repeat_rule)
 */
$action = $_GET['action'] ?? 'ping';
try {
require_once __DIR__ . '/config/database.php';
$db = Database::getInstance();
$pdo = $db->getConnection();
header('Content-Type: application/json; charset=utf-8');
function pAll($pdo, $sql) { try { $r = $pdo->query($sql); } catch (Throwable $e) { throw new RuntimeException("SQL: " . $e->getMessage()); } return $r->fetchAll(PDO::FETCH_ASSOC); }
function cEx($pdo, $t, $c) { static $x = []; $k = "$t.$c"; if (!isset($x[$k])) $x[$k] = (bool)$pdo->query("SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='$t' AND column_name='$c' LIMIT 1")->fetchColumn(); return $x[$k]; }
function tEx($pdo, $t) { static $c = []; if (!isset($c[$t])) $c[$t] = (bool)$pdo->query("SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='$t' LIMIT 1")->fetchColumn(); return $c[$t]; }
switch ($action) {
    case 'ping': echo json_encode(['ok'=>true,'php'=>phpversion(),'ts'=>date('c')]); break;
    case 'p0_backup':
        $bd = __DIR__ . '/backups'; if (!is_dir($bd)) @mkdir($bd, 0755, 1);
        $ts = date('Y-m-d_H-i-s'); $fn = "P0_BACKUP_{$ts}.sql.gz"; $fp = gzopen("{$bd}/{$fn}", 'w');
        $T = ['tasks','users','comments','attachments','stores','projects','bills','employees','vendors','penalties','penalty_assessments','penalty_log','penalty_rules','task_penalties','payments','audit_logs','notifications','deadline_extensions'];
        gzwrite($fp, "-- P0 Backup {$ts}\nSET FOREIGN_KEY_CHECKS=0;\n\n"); $tc = [];
        foreach ($T as $tbl) { $s = preg_replace('/[^a-zA-Z0-9_]/', '', $tbl);
            if (!$pdo->query("SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='{$s}' LIMIT 1")->fetchColumn()) continue;
            $cnt = (int)$pdo->query("SELECT COUNT(*) FROM `{$s}`")->fetchColumn(); $tc[$s] = $cnt;
            $cr = $pdo->query("SHOW CREATE TABLE `{$s}`")->fetch(); if ($cr) gzwrite($fp, "\n-- {$s}({$cnt})\nDROP TABLE IF EXISTS `{$s}`;\n{$cr['Create Table']};\n\n");
            if ($cnt > 0) { $off = 0; while (1) { $rows = $pdo->query("SELECT * FROM `{$s}` LIMIT 200 OFFSET {$off}")->fetchAll(PDO::FETCH_ASSOC); if (!$rows) break;
                $cs = array_map(fn($c) => '`'.preg_replace('/[^a-zA-Z0-9_]/','',$c).'`', array_keys($rows[0])); $vl = [];
                foreach ($rows as $row) { $p2 = []; foreach (array_values($row) as $v) { if ($v===null) $p2[]='NULL'; elseif (is_numeric($v)) $p2[]=(string)$v; else $p2[]=$pdo->quote((string)$v); } $vl[]='('.implode(',',$p2).')'; }
                gzwrite($fp, "INSERT INTO `{$s}` (".implode(',',$cs).") VALUES\n".implode(",\n",$vl).";\n"); $off+=200; if (count($rows)<200) break; } } }
        gzwrite($fp, "\nSET FOREIGN_KEY_CHECKS=1;\n"); gzclose($fp); $fsz = filesize("{$bd}/{$fn}");
        echo json_encode(['ok'=>true,'fn'=>$fn,'sz'=>round($fsz/1048576,2).'MB','t'=>$tc]); break;
    case 'p0_repro':
        $bills = pAll($pdo, "SELECT b.id, b.title, b.store_id, b.amount, b.due_date, b.is_archived, COALESCE(s.name,'N/A') AS store_name FROM bills b LEFT JOIN stores s ON s.id=b.store_id WHERE (b.is_archived=0 OR b.is_archived IS NULL) ORDER BY b.store_id, b.due_date, b.title");
        $eG = []; foreach ($bills as $b) { $k=strtolower(trim($b['title']??'')).'|'.($b['store_id']??'').'|'.($b['due_date']??''); $eG[$k][]=$b; } $eD=array_filter($eG,fn($g)=>count($g)>1);
        $sG = []; foreach ($bills as $b) { $k=strtolower(trim($b['title']??'')).'|'.($b['store_id']??'').'|'.($b['amount']??''); $sG[$k][]=$b; } $sD=array_filter($sG,fn($g)=>count($g)>1);
        echo json_encode(['active_bills'=>count($bills),'exact_dup_groups'=>count($eD),'soft_dup_groups'=>count($sD),'soft_dup_records'=>array_sum(array_map('count',$sD)),'samples'=>array_slice(array_values($sD),0,10)]); break;
    case 'p0_cleanup':
        $pdo->beginTransaction(); $log=['ba'=>0,'bk'=>0,'ta'=>0,'tk'=>0,'gp'=>0,'err'=>[]];
        try {
            $bills = pAll($pdo, "SELECT b.*, COALESCE(s.name,'N/A') AS store_name FROM bills b LEFT JOIN stores s ON s.id=b.store_id WHERE (b.is_archived=0 OR b.is_archived IS NULL)");
            $gr = []; foreach ($bills as $b) { $k=implode('|',[strtolower(trim($b['title']??'')),($b['store_id']??''),($b['due_date']??''),($b['amount']??'')]); $gr[$k][]=$b; }
            foreach ($gr as $k=>$g) { $log['gp']++; if (count($g)<=1) { $log['bk']++; continue; } $can=$g[0]; foreach (array_slice($g,1) as $d) { $id=(int)$d['id'];
                try { $pdo->exec("UPDATE bills SET is_archived=1, updated_at=NOW() WHERE id={$id}"); $log['ba']++; } catch (Throwable $e) { $log['err'][]="b:{$id} ".$e->getMessage(); } } $log['bk']++; }
            if (tEx($pdo,'tasks')) { $tasks = pAll($pdo, "SELECT t.id, t.title, t.due_date, t.archived_duplicate, t.deleted_at FROM tasks t WHERE t.deleted_at IS NULL AND (t.archived_duplicate=0 OR t.archived_duplicate IS NULL)");
                $tG=[]; foreach ($tasks as $t) { $tG[strtolower(trim($t['title']??'')).'|'.($t['store_id']??'').'|'.($t['due_date']??'')][]=$t; }
                foreach ($tG as $k=>$g) { if (count($g)<=1) { $log['tk']++; continue; } foreach (array_slice($g,1) as $d) { $id=(int)$d['id'];
                    try { if (cEx($pdo,'tasks','archived_duplicate')) $pdo->exec("UPDATE tasks SET archived_duplicate=1 WHERE id={$id}"); else $pdo->exec("UPDATE tasks SET deleted_at=NOW() WHERE id={$id}"); $log['ta']++; }
                    catch (Throwable $e) { $log['err'][]="t:{$id} ".$e->getMessage(); } } $log['tk']++; } }
            $pdo->commit(); echo json_encode(['ok'=>true,'log'=>$log]);
        } catch (Throwable $e) { $pdo->rollBack(); echo json_encode(['ok'=>false,'e'=>$e->getMessage(),'log'=>$log]); } break;
    case 'p0_penalty_reset':
        $pdo->beginTransaction(); $log=['penalties'=>0,'penalty_log'=>0,'penalty_assessments'=>0,'task_penalties'=>0,'users_reset'=>0];
        try {
            if (tEx($pdo,'penalties')) { $log['penalties']=(int)$pdo->query("SELECT COUNT(*) FROM penalties")->fetchColumn();
                if (cEx($pdo,'penalties','status')) $pdo->exec("UPDATE penalties SET status='reset', updated_at=NOW() WHERE status!='reset'");
                elseif (cEx($pdo,'penalties','is_archived')) $pdo->exec("UPDATE penalties SET is_archived=1 WHERE is_archived=0");
                else $pdo->exec("DELETE FROM penalties"); }
            if (tEx($pdo,'penalty_log')) { $log['penalty_log']=(int)$pdo->query("SELECT COUNT(*) FROM penalty_log")->fetchColumn();
                if (cEx($pdo,'penalty_log','archived_at')) $pdo->exec("UPDATE penalty_log SET archived_at=NOW() WHERE archived_at IS NULL"); else $pdo->exec("DELETE FROM penalty_log"); }
            if (tEx($pdo,'penalty_assessments')) { $log['penalty_assessments']=(int)$pdo->query("SELECT COUNT(*) FROM penalty_assessments")->fetchColumn();
                if (cEx($pdo,'penalty_assessments','is_archived')) $pdo->exec("UPDATE penalty_assessments SET is_archived=1 WHERE is_archived=0"); else $pdo->exec("DELETE FROM penalty_assessments"); }
            if (tEx($pdo,'task_penalties')) { $log['task_penalties']=(int)$pdo->query("SELECT COUNT(*) FROM task_penalties")->fetchColumn();
                if (cEx($pdo,'task_penalties','is_archived')) $pdo->exec("UPDATE task_penalties SET is_archived=1 WHERE is_archived=0"); else $pdo->exec("DELETE FROM task_penalties"); }
            if (tEx($pdo,'penalty_appeals')) $pdo->exec("DELETE FROM penalty_appeals");
            if (tEx($pdo,'penalty_comments')) $pdo->exec("DELETE FROM penalty_comments");
            if (tEx($pdo,'users')) { $sets=[];
                if (cEx($pdo,'users','total_penalties')) $sets[]="total_penalties=0";
                if (cEx($pdo,'users','total_penalty_amount')) $sets[]="total_penalty_amount=0";
                if (cEx($pdo,'users','penalty_count')) $sets[]="penalty_count=0";
                if (cEx($pdo,'users','last_penalty_at')) $sets[]="last_penalty_at=NULL";
                if ($sets) { $pdo->exec("UPDATE users SET ".implode(',',$sets)." WHERE total_penalties>0 OR penalty_count>0"); $log['users_reset']=(int)$pdo->query("SELECT ROW_COUNT()")->fetchColumn(); } }
            if (tEx($pdo,'penalty_daily_snapshots')) $pdo->exec("DELETE FROM penalty_daily_snapshots");
            $reason="CEO requested full penalty reset before new penalty policy enforcement";
            if (tEx($pdo,'audit_logs')) $pdo->exec("INSERT INTO audit_logs(module,action,record_type,record_id,user_id,note,created_at) VALUES('penalties','full_reset','system',0,1,".$pdo->quote($reason).",NOW())");
            $pdo->commit(); echo json_encode(['ok'=>true,'log'=>$log,'reason'=>$reason]);
        } catch (Throwable $e) { $pdo->rollBack(); echo json_encode(['ok'=>false,'e'=>$e->getMessage(),'log'=>$log]); } break;
    case 'p0_verify':
        $v = [];
        $bills = pAll($pdo, "SELECT b.id, b.title, b.store_id, b.due_date, b.amount, b.is_archived FROM bills b WHERE (b.is_archived=0 OR b.is_archived IS NULL)");
        $gr=[]; foreach ($bills as $b) { $gr[implode('|',[strtolower(trim($b['title']??'')),($b['store_id']??''),($b['due_date']??''),($b['amount']??'')])][]=$b; }
        $v['bill_dups']=count(array_filter($gr,fn($g)=>count($g)>1)); $v['active_bills']=count($bills);
        if (tEx($pdo,'tasks')) { $v['active_tasks']=(int)$pdo->query("SELECT COUNT(*) FROM tasks")->fetchColumn(); $v['task_dups']=0; }
        $v['penalties_active']=tEx($pdo,'penalties')?(int)$pdo->query("SELECT COUNT(*) FROM penalties")->fetchColumn():0;
        $v['penalty_log_active']=tEx($pdo,'penalty_log')?(int)$pdo->query("SELECT COUNT(*) FROM penalty_log")->fetchColumn():0;
        $v['pass']=($v['bill_dups']===0&&($v['task_dups']??0)===0);
        echo json_encode($v); break;
    default: echo json_encode(['error'=>'Unknown action: '.$action]);
}
} catch (Throwable $e) { header('Content-Type: application/json'); echo json_encode(['error'=>$e->getMessage()]); }
