<?php
/** P0 SCAN: backup + repro + deep audit (read-only) */
define('SECRET_KEY','P0-CEO-2026');
if(($_GET['key']??'')!==SECRET_KEY){http_response_code(403);die(json_encode(['e'=>'F']));}
error_reporting(0);ini_set('max_execution_time','600');ini_set('memory_limit','512M');header('Content-Type:application/json;charset=utf-8');
$step=$_GET['step']??'all';$out=['ts'=>date('c'),'step'=>$step];
$envFile=__DIR__.'/.env';if(!file_exists($envFile))$envFile='/home/liemdo0208/dashboard.bakudanramen.com/.env';
if(!file_exists($envFile)){die(json_encode(['e'=>'.env nf']));}
list($DB_HOST,$DB_NAME,$DB_USER,$DB_PASS)=['','','',''];
foreach(file($envFile,2|512)as$l){$l=trim($l);if(!$l||$l[0]=='#'||strpos($l,'=')===false)continue;[$k,$v]=explode('=',$l,2);$k=trim($k);$v=trim($v);if(preg_match('/^([\'"])(.*)\\1$/',$v,$m))$v=$m[2];if($k=='DB_HOST')$DB_HOST=$v;if($k=='DB_NAME')$DB_NAME=$v;if($k=='DB_USER')$DB_USER=$v;if($k=='DB_PASS')$DB_PASS=$v;}
try{$pdo=new PDO("mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4",$DB_USER,$DB_PASS,[3=>3,5=>5]);$pdo->exec('SET NAMES utf8mb4');$pdo->exec("SET time_zone='+07:00'");}catch(PDOException$e){die(json_encode(['e'=>'DB fail','d'=>$e->getMessage()]));}
function tEx($p,$t){static$c=[];if(!isset($c[$t]))$c[$t]=(bool)$p->query("SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='$t' LIMIT 1")->fetchColumn();return$c[$t];}
function cEx($p,$t,$c){static$x=[];$k="$t.$c";if(!isset($x[$k]))$x[$k]=(bool)$p->query("SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='$t' AND column_name='$c' LIMIT 1")->fetchColumn();return$x[$k];}
@mkdir($BD=__DIR__.'/backups',0755,1);@mkdir(__DIR__.'/reports',0755,1);
// BACKUP
if($step=='all'||$step=='1'||$step=='backup'){
  $T=['tasks','users','comments','attachments','files','images','credentials','credential_permissions','task_approval_events','audit_logs','notifications','stores','projects','shifts','bills','employees','deadline_extensions','penalties','penalty_assessments','penalty_history','penalty_rules','task_penalties','penalty_daily_snapshots','penalty_log','payments','vendors','duplicate_task_flags','duplicate_bill_flags','obligation_payments','obligation_tasks','obligations'];
  $ts=date('Y-m-d_H-i-s');$fn="P0_BACKUP_$ts.sql.gz";$fp=gzopen($BD.'/'.$fn,'w');
  if(!$fp){$out['backup']=['e'=>"Cannot write $BD/$fn"];}else{
    gzwrite($fp,"-- P0 Backup $ts|DB:$DB_NAME\nSET FOREIGN_KEY_CHECKS=0;\n\n");$tc=[];
    foreach($T as$tbl){$s=preg_replace('/[^a-zA-Z0-9_]/','',$tbl);
      if(!$pdo->query("SELECT 1 FROM information_schema.tables WHERE table_schema='$DB_NAME' AND table_name='$s' LIMIT 1")->fetchColumn())continue;
      $cnt=(int)$pdo->query("SELECT COUNT(*) FROM `$s`")->fetchColumn();$tc[$s]=$cnt;
      $cr=$pdo->query("SHOW CREATE TABLE `$s`")->fetch();if($cr)gzwrite($fp,"\n-- $s($cnt)\nDROP TABLE IF EXISTS `$s`;\n".$cr['Create Table'].";\n\n");
      if($cnt>0){$off=0;$ch=200;while(1){$rows=$pdo->query("SELECT * FROM `$s` LIMIT $ch OFFSET $off")->fetchAll(5);if(!$rows)break;
        $cs=array_map(fn($c)=>"`".preg_replace('/[^a-zA-Z0-9_]/','',$c)."`",array_keys($rows[0]));$vl=[];
        foreach($rows as$row){$p2=[];foreach(array_values($row)as$v){if($v===null)$p2[]='NULL';elseif(is_numeric($v))$p2[]=(string)$v;else$p2[]=$pdo->quote((string)$v);}$vl[]='('.implode(',',$p2).')';}
        gzwrite($fp,"INSERT INTO `$s` (".implode(',',$cs).") VALUES\n".implode(",\n",$vl).";\n");$off+=$ch;if(count($rows)<$ch)break;}}}
    gzwrite($fp,"\nSET FOREIGN_KEY_CHECKS=1;\n");gzclose($fp);$fsz=filesize($BD.'/'.$fn);
    $out['backup']=['fn'=>$fn,'fp'=>$BD.'/'.$fn,'ts'=>$ts,'sz'=>$fsz,'szh'=>round($fsz/1048576,2).'MB','t'=>$tc,'ok'=>1];}}
// REPRO
if($step=='all'||$step=='2'||$step=='repro'){
  $bills=$pdo->query("SELECT b.id,b.bill_name AS t,b.store_id,b.vendor_id,b.category,b.due_date,b.amount,b.repeat_rule,COALESCE(s.name,'N/A')AS sn,COALESCE(v.name,'N/A')AS vn,b.status,b.is_paid,b.created_by,b.created_at FROM bills b LEFT JOIN stores s ON s.id=b.store_id LEFT JOIN vendors v ON v.id=b.vendor_id WHERE(b.is_archived=0 OR b.is_archived IS NULL)ORDER BY b.store_id,b.due_date,b.bill_name")->fetchAll(5);
  $eG=[];foreach($bills as$b){$k=strtolower(trim($b['t']??'')).'|'.($b['store_id']??'').'|'.($b['due_date']??'');$eG[$k][]=$b;}
  $eD=[];foreach($eG as$k=>$g)if(count($g)>1)$eD[$k]=$g;
  $sG=[];foreach($bills as$b){$k=strtolower(trim($b['t']??'')).'|'.($b['store_id']??'').'|'.($b['amount']??'');$sG[$k][]=$b;}
  $sD=[];foreach($sG as$k=>$g)if(count($g)>1)$sD[$k]=$g;
  $tD=[];
  if(tEx($pdo,'tasks')){$tasks=$pdo->query("SELECT t.id,t.title,t.store_id,t.assigned_to,t.due_date,COALESCE(s.name,'N/A')AS sn,t.status,t.archived_duplicate,t.created_at FROM tasks t LEFT JOIN stores s ON s.id=t.store_id WHERE t.deleted_at IS NULL AND(t.archived_duplicate=0 OR t.archived_duplicate IS NULL)ORDER BY t.store_id,t.due_date,t.title")->fetchAll(5);$tG=[];foreach($tasks as$t){$k=strtolower(trim($t['title']??'')).'|'.($t['store_id']??'').'|'.($t['due_date']??'');$tG[$k][]=$t;}foreach($tG as$k=>$g)if(count($g)>1)$tD[$k]=$g;}
  $out['repro']=['active_bills'=>count($bills),'active_tasks'=>tEx($pdo,'tasks')?(int)$pdo->query("SELECT COUNT(*)FROM tasks WHERE deleted_at IS NULL AND(archived_duplicate=0 OR archived_duplicate IS NULL)")->fetchColumn():0,'bill_exact_dup'=>['groups'=>count($eD),'records'=>array_sum(array_map('count',$eD))],'bill_soft_dup'=>['groups'=>count($sD),'records'=>array_sum(array_map('count',$sD))],'task_dup'=>['groups'=>count($tD),'records'=>array_sum(array_map('count',$tD))],'samples'=>$sD];
  $out['all_bills']=[];foreach($bills as$b)$out['all_bills'][]=['id'=>$b['id'],'t'=>$b['t'],'sn'=>$b['sn'],'vn'=>$b['vn'],'due'=>$b['due_date'],'amt'=>$b['amount'],'repeat'=>$b['repeat_rule'],'paid'=>$b['is_paid'],'status'=>$b['status']];}
// AUDIT
if($step=='all'||$step=='3'||$step=='audit'){
  $bills=$pdo->query("SELECT b.*,COALESCE(s.name,'N/A')AS sn,COALESCE(v.name,'N/A')AS vn FROM bills b LEFT JOIN stores s ON s.id=b.store_id LEFT JOIN vendors v ON v.id=b.vendor_id WHERE(b.is_archived=0 OR b.is_archived IS NULL)")->fetchAll(5);
  $L1=[];$L2=[];$L3=[];
  foreach($bills as$b){$L1[implode('|',['t:'.strtolower(trim($b['bill_name']??'')),'s:'.($b['store_id']??''),'v:'.($b['vendor_id']??''),'d:'.($b['due_date']??''),'a:'.($b['amount']??''),'r:'.($b['repeat_rule']??'')])][]=$b;
    $L2[implode('|',['t:'.strtolower(trim($b['bill_name']??'')),'s:'.($b['store_id']??''),'v:'.($b['vendor_id']??''),'a:'.($b['amount']??'')])][]=$b;
    $L3[implode('|',['t:'.strtolower(trim($b['bill_name']??'')),'s:'.($b['store_id']??'')])][]=$b;}
  $d1=array_filter($L1,fn($g)=>count($g)>1);$d2=array_filter($L2,fn($g)=>count($g)>1);$d3=array_filter($L3,fn($g)=>count($g)>1);
  $pD=[];if(tEx($pdo,'payments')){$pays=$pdo->query("SELECT id,bill_id,amount,paid_at FROM payments")->fetchAll(5);$pG=[];foreach($pays as$p){$k=($p['bill_id']??'').'|'.($p['amount']??'').'|'.($p['paid_at']??'');$pG[$k][]=$p;}foreach($pG as$k=>$g)if(count($g)>1)$pD[$k]=$g;}
  // Check for penalties
  $penCnt=0;if(tEx($pdo,'penalties'))$penCnt=(int)$pdo->query("SELECT COUNT(*)FROM penalties")->fetchColumn();
  $logCnt=0;if(tEx($pdo,'penalty_log'))$logCnt=(int)$pdo->query("SELECT COUNT(*)FROM penalty_log")->fetchColumn();
  $assCnt=0;if(tEx($pdo,'penalty_assessments'))$assCnt=(int)$pdo->query("SELECT COUNT(*)FROM penalty_assessments")->fetchColumn();
  $tpCnt=0