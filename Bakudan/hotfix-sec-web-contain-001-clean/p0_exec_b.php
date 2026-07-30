<?php
/**
 * P0 CEO DIRECTIVE Executor — Part B (step 4 remainder + steps 5-6 + output)
 * Access: https://dashboard.bakudanramen.com/p0_ceo_directive.php?key=P0-CEO-2026&step=X
 * Concatenate with p0_exec_a.php to form the full executor
 */
define('SECRET_KEY', 'P0-CEO-2026');
if (($_GET['key'] ?? '') !== SECRET_KEY) { http_response_code(403); header('Content-Type:application/json'); die(json_encode(['e'=>'F'])); }
error_reporting(0); ini_set('max_execution_time','600'); ini_set('memory_limit','512M'); header('Content-Type:application/json;charset=utf-8');
$step=$_GET['step']??'all'; $dry=!empty($_GET['dry_run']); $actor=(int)($_GET['actor_id']??1);
$out=['ts'=>date('c'),'step'=>$step,'dry'=>$dry];
$envFile=__DIR__.'/.env'; if(!file_exists($envFile))$envFile='/home/liemdo0208/dashboard.bakudanramen.com/.env';
if(!file_exists($envFile)){die(json_encode(['e'=>'.env nf']));}
list($DB_HOST,$DB_NAME,$DB_USER,$DB_PASS)=['','','',''];
foreach(file($envFile,2|512)as$l){$l=trim($l);if(!$l||$l[0]=='#'||strpos($l,'=')===false)continue;[$k,$v]=explode('=',$l,2);$k=trim($k);$v=trim($v);if(preg_match('/^([\'"])(.*)\1$/',$v,$m))$v=$m[2];if($k=='DB_HOST')$DB_HOST=$v;if($k=='DB_NAME')$DB_NAME=$v;if($k=='DB_USER')$DB_USER=$v;if($k=='DB_PASS')$DB_PASS=$v;}
try{$pdo=new PDO("mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4",$DB_USER,$DB_PASS,[3=>3,5=>5]);$pdo->exec('SET NAMES utf8mb4');$pdo->exec("SET time_zone='+07:00'");}catch(PDOException$e){die(json_encode(['e'=>'DB fail','d'=>$e->getMessage()]));}
function tEx($p,$t){static$c=[];if(!isset($c[$t]))$c[$t]=(bool)$p->query("SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='$t' LIMIT 1")->fetchColumn();return$c[$t];}
function cEx($p,$t,$c){static$x=[];$k="{$t}.{$c}";if(!isset($x[$k]))$x[$k]=(bool)$p->query("SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='$t' AND column_name='$c' LIMIT 1")->fetchColumn();return$x[$k];}
function logAudit($pdo,$mod,$act,$rtype,$rid,$uid,$note){$note=preg_replace('/[\'"]/',' ',$note);$note=substr($note,0,500);$pdo->exec("INSERT INTO audit_logs(module,action,record_type,record_id,user_id,note,created_at)VALUES('$mod','$act','$rtype',$rid,$uid,'".$pdo->quote($note)."',NOW())");}
@mkdir($RD=__DIR__.'/reports',0755,1); @mkdir($BD=__DIR__.'/backups',0755,1);
// === STEP 4 REMAINING: PAYMENTS + COMMIT ===
if($step=='all'||$step=='4'||$step=='cleanup'){
  if($dry){$out['cleanup']=['note'=>'DRY RUN — no changes','dry'=>1];}else{
    $pdo->beginTransaction();
    $log=['ba'=>0,'bk'=>0,'ta'=>0,'tk'=>0,'pa'=>0,'gp'=>0,'err'=>[]];
    try{
      $bills=$pdo->query("SELECT b.*,COALESCE(s.name,'N/A')AS sn,COALESCE(v.name,'N/A')AS vn FROM bills b LEFT JOIN stores s ON s.id=b.store_id LEFT JOIN vendors v ON v.id=b.vendor_id WHERE(b.is_archived=0 OR b.is_archived IS NULL)")->fetchAll(5);
      $gr=[];foreach($bills as$b){$k=implode('|',['t:'.strtolower(trim($b['bill_name']??'')),'s:'.($b['store_id']??''),'d:'.($b['due_date']??''),'a:'.($b['amount']??''),'r:'.($b['repeat_rule']??'')]);$gr[$k][]=$b;}
      foreach($gr as$k=>$g){$log['gp']++;if(count($g)<=1){$log['bk']++;continue;}$can=$g[0];$dps=array_slice($g,1);foreach($dps as$d){$id=(int)$d['id'];try{$pdo->exec("UPDATE bills SET is_archived=1,status='archived_duplicate',updated_at=NOW()WHERE id=$id");logAudit($pdo,'bills','archive_duplicate','bill',$id,$actor,"P0 CEO: archived duplicate of bill#{$can['id']}|{$can['bill_name']}|{$can['sn']}");$log['ba']++;}catch(Throwable$e){$log['err'][]="b:$id ".$e->getMessage();}}$log['bk']++;}
      if(tEx($pdo,'tasks')){$tasks=$pdo->query("SELECT t.*,COALESCE(s.name,'N/A')AS sn FROM tasks t LEFT JOIN stores s ON s.id=t.store_id WHERE t.deleted_at IS NULL AND(t.archived_duplicate=0 OR t.archived_duplicate IS NULL)")->fetchAll(5);$tG=[];foreach($tasks as$t){$k=strtolower(trim($t['title']??'')).'|'.($t['store_id']??'').'|'.($t['due_date']??'');$tG[$k][]=$t;}foreach($tG as$k=>$g){if(count($g)<=1){$log['tk']++;continue;}$can=$g[0];$dps=array_slice($g,1);foreach($dps as$d){$id=(int)$d['id'];try{if(cEx($pdo,'tasks','archived_duplicate'))$pdo->exec("UPDATE tasks SET archived_duplicate=1,duplicate_reason='P0_duplicate_cleanup'WHERE id=$id");else$pdo->exec("UPDATE tasks SET deleted_at=NOW()WHERE id=$id");logAudit($pdo,'tasks','archive_duplicate','task',$id,$actor,"P0 CEO: archived duplicate of task#{$can['id']}|{$can['title']}|{$can['sn']}");$log['ta']++;}catch(Throwable$e){$log['err'][]="t:$id ".$e->getMessage();}}$log['tk']++;}}
      if(tEx($pdo,'payments')){$pays=$pdo->query("SELECT id,bill_id,amount,paid_at,created_at FROM payments")->fetchAll(5);$pG=[];foreach($pays as$p){$k=($p['bill_id']??'').'|'.($p['amount']??'').'|'.($p['paid_at']??'');$pG[$k][]=$p;}foreach($pG as$k=>$g){if(count($g)<=1)continue;$can=$g[0];$dps=array_slice($g,1);foreach($dps as$d){$id=(int)$d['id'];try{if(cEx($pdo,'payments','is_archived')){$pdo->exec("UPDATE payments SET is_archived=1,updated_at=NOW()WHERE id=$id");}else{$pdo->exec("DELETE FROM payments WHERE id=$id LIMIT 1");}logAudit($pdo,'payments','archive_duplicate','payment',$id,$actor,"P0 CEO: archived duplicate of payment#{$can['id']}");$log['pa']++;}catch(Throwable$e){$log['err'][]="p:$id ".$e->getMessage();}}}
      $pdo->commit();
      $out['cleanup']=['ok'=>1,'log'=>$log,'ts'=>date('c')];}
    catch(Throwable$e){$pdo->rollBack();$out['cleanup']=['ok'=>0,'error'=>$e->getMessage(),'log'=>$log];}}}
// === STEP 5: PENALTY FULL RESET ===
if($step=='all'||$step=='5'||$step=='penalty_reset'){
  if($dry){$out['penalty_reset']=['note'=>'DRY RUN — no changes','dry'=>1];}else{
    $pdo->beginTransaction();
    $log=['penalty_records'=>0,'penalty_logs'=>0,'penalty_assessments'=>0,'task_penalties'=>0,'user_totals_reset'=>0,'errors'=>[]];
    $RESET_REASON="CEO requested full penalty reset before new penalty policy enforcement";
    try{
      // Archive penalty records
      if(tEx($pdo,'penalties')){$cnt=(int)$pdo->query("SELECT COUNT(*)FROM penalties")->fetchColumn();$log['penalty_records']=$cnt;
        if(cEx($pdo,'penalties','status')&&cEx($pdo,'penalties','archived_at')){
          $pdo->exec("UPDATE penalties SET status='reset',archived_at=NOW(),updated_at=NOW()WHERE status!='reset'");}
        elseif(cEx($pdo,'penalties','is_archived')){
          $pdo->exec("UPDATE penalties SET is_archived=1,updated_at=NOW()WHERE is_archived=0");}
        else{$pdo->exec("DELETE FROM penalties");}}
      // Reset penalty_log
      if(tEx($pdo,'penalty_log')){$cnt=(int)$pdo->query("SELECT COUNT(*)FROM penalty_log")->fetchColumn();$log['penalty_logs']=$cnt;
        if(cEx($pdo,'penalty_log','archived_at')||cEx($pdo,'penalty_log','is_archived')){
          $pdo->exec("UPDATE penalty_log SET archived_at=NOW()WHERE archived_at IS NULL");}
        else{$pdo->exec("DELETE FROM penalty_log");}}
      // Reset penalty_assessments
      if(tEx($pdo,'penalty_assessments')){$cnt=(int)$pdo->query("SELECT COUNT(*)FROM penalty_assessments")->fetchColumn();$log['penalty_assessments']=$cnt;
        if(cEx($pdo,'penalty_assessments','is_archived')){$pdo->exec("UPDATE penalty_assessments SET is_archived=1,updated_at=NOW()WHERE is_archived=0");}else{$pdo->exec("DELETE FROM penalty_assessments");}}
      // Reset task_penalties
      if(tEx($pdo,'task_penalties')){$cnt=(int)$pdo->query("SELECT COUNT(*)FROM task_penalties")->fetchColumn();$log['task_penalties']=$cnt;
        if(cEx($pdo,'task_penalties','is_archived')){$pdo->exec("UPDATE task_penalties SET is_archived=1,updated_at=NOW()WHERE is_archived=0");}else{$pdo->exec("DELETE FROM task_penalties");}}
      // Reset user penalty totals
      if(tEx($pdo,'users')){$pdo->exec("UPDATE users SET total_penalties=0,total_penalty_amount=0,penalty_count=0,last_penalty_at=NULL WHERE total_penalties>0 OR total_penalty_amount>0 OR penalty_count>0");$log['user_totals_reset']=(int)$pdo->query("SELECT ROW_COUNT()")->fetchColumn();}
      // Insert penalty history reset record
      if(tEx($pdo,'penalty_history')){$pdo->exec("INSERT INTO penalty_history(user_id,action,amount,reason,created_at)VALUES(1,'full_reset',0,'".$pdo->quote($RESET_REASON)."',NOW())");}
      // Clear penalty_daily_snapshots if exists
      if(tEx($pdo,'penalty_daily_snapshots')){$pdo->exec("DELETE FROM penalty_daily_snapshots");}
      // Audit log
      logAudit($pdo,'penalties','full_reset','system',0,$actor,$RESET_REASON);
      $pdo->commit();
      $out['penalty_reset']=['ok'=>1,'log'=>$log,'reason'=>$RESET_REASON,'ts'=>date('c')];}
    catch(Throwable$e){$pdo->rollBack();$out['penalty_reset']=['ok'=>0,'error'=>$e->getMessage(),'log'=>$log];}}}
// === STEP 6: VERIFICATION ===
if($step=='all'||$step=='6'||$step=='verify'){
  $v=[];
  // Bill duplicates
  $bills=$pdo->query("SELECT b.id,b.bill_name AS t,b.store_id,b.due_date,b.amount,b.repeat_rule FROM bills b WHERE(b.is_archived=0 OR b.is_archived IS NULL)")->fetchAll(5);
  $gr=[];foreach($bills as$b){$k=implode('|',['t:'.strtolower(trim($b['t']??'')),'s:'.($b['store_id']??''),'d:'.($b['due_date']??''),'a:'.($b['amount']??''),'r:'.($b['repeat_rule']??'')]);$gr[$k][]=$b;}
  $v['bill_exact_duplicates']=['groups'=>count(array_filter($gr,fn($g)=>count($g)>1)),'active_bills'=>(int)$pdo->query("SELECT COUNT(*)FROM bills WHERE(is_archived=0 OR is_archived IS NULL)")->fetchColumn()];
  // Task duplicates
  if(tEx($pdo,'tasks')){$tasks=$pdo->query("SELECT t.id,t.title,t.store_id,t.due_date FROM tasks t WHERE t.deleted_at IS NULL AND(t.archived_duplicate=0 OR t.archived_duplicate IS NULL)")->fetchAll(5);$tG=[];foreach($tasks as$t){$k=strtolower(trim($t['title']??'')).'|'.($t['store_id']??'').'|'.($t['due_date']??'');$tG[$k][]=$t;}$v['task_duplicates']=['groups'=>count(array_filter($tG,fn($g)=>count($g)>1)),'active_tasks'=>(int)$pdo->query("SELECT COUNT(*)FROM tasks WHERE deleted_at IS NULL AND(archived_duplicate=0 OR archived_duplicate IS NULL)")->fetchColumn()];}
  // Payment duplicates
  if(tEx($pdo,'payments')){$pays=$pdo->query("SELECT id,bill_id,amount,paid_at FROM payments")->fetchAll(5);$pG=[];foreach($pays as$p){$k=($p['bill_id']??'').'|'.($p['amount']??'').'|'.($p['paid_at']??'');$pG[$k][]=$p;