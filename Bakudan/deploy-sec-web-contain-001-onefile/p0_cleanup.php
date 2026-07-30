<?php
/** P0: Cleanup + Penalty Reset + Verify */
define('K','P0-CEO-2026');if(($_GET['key']??'')!==K){http_response_code(403);die('F');}
error_reporting(0);ini_set('max_execution_time','600');ini_set('memory_limit','512M');header('Content-Type:application/json;charset=utf-8');
$step=$_GET['step']??'all';
$ef=__DIR__.'/.env';if(!file_exists($ef))$ef='/home/liemdo0208/dashboard.bakudanramen.com/.env';
if(!file_exists($ef))die(json_encode(['e'=>'.env nf']));
list($H,$N,$U,$P)=['','','',''];
foreach(file($ef,2|512)as$l){$l=trim($l);if(!$l||$l[0]=='#'||strpos($l,'=')===false)continue;[$k,$v]=explode('=',$l,2);$k=trim($k);$v=trim($v);if(preg_match('/^([\'"])(.*)\\1$/',$v,$m))$v=$m[2];if($k=='DB_HOST')$H=$v;if($k=='DB_NAME')$N=$v;if($k=='DB_USER')$U=$v;if($k=='DB_PASS')$P=$v;}
try{$pdo=new PDO("mysql:host=$H;dbname=$N;charset=utf8mb4",$U,$P,[3=>3,5=>5]);$pdo->exec('SET NAMES utf8mb4');$pdo->exec("SET time_zone='+07:00'");}catch(PDOException$e){die(json_encode(['e'=>'DB fail','d'=>$e->getMessage()]));}
function tEx($p,$t){static$c=[];if(!isset($c[$t]))$c[$t]=(bool)$p->query("SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='$t' LIMIT 1")->fetchColumn();return$c[$t];}
function cEx($p,$t,$c){static$x=[];$k="$t.$c";if(!isset($x[$k]))$x[$k]=(bool)$p->query("SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='$t' AND column_name='$c' LIMIT 1")->fetchColumn();return$x[$k];}
function logAudit($pdo,$mod,$act,$rtype,$rid,$uid,$note){$note=preg_replace('/[\'"]/',' ',$note);if(cEx($pdo,'audit_logs','module')){$pdo->exec("INSERT INTO audit_logs(module,action,record_type,record_id,user_id,note,created_at)VALUES('$mod','$act','$rtype',$rid,$uid,'".substr($note,0,500)."',NOW())");}}
$act=(int)($_GET['actor_id']??1);
// CLEANUP
if($step=='all'||$step=='4'||$step=='cleanup'){
  $pdo->beginTransaction();$log=['ba'=>0,'bk'=>0,'ta'=>0,'tk'=>0,'pa'=>0,'gp'=>0,'err'=>[]];
  try{
    $bills=$pdo->query("SELECT b.*,COALESCE(s.name,'N/A')AS sn FROM bills b LEFT JOIN stores s ON s.id=b.store_id WHERE(b.is_archived=0 OR b.is_archived IS NULL)")->fetchAll(5);
    $gr=[];foreach($bills as$b){$k=implode('|',[strtolower(trim($b['bill_name']??'')),($b['store_id']??''),($b['due_date']??''),($b['amount']??''),($b['repeat_rule']??'')]);$gr[$k][]=$b;}
    foreach($gr as$k=>$g){$log['gp']++;if(count($g)<=1){$log['bk']++;continue;}$can=$g[0];$dps=array_slice($g,1);
      foreach($dps as$d){$id=(int)$d['id'];try{$pdo->exec("UPDATE bills SET is_archived=1,status='archived_duplicate',updated_at=NOW()WHERE id=$id");logAudit($pdo,'bills','archive_duplicate','bill',$id,$act,"P0 CEO: archived duplicate of bill#{$can['id']}|{$can['bill_name']}|{$can['sn']}");$log['ba']++;}catch(Throwable$e){$log['err'][]="b:$id ".$e->getMessage();}}$log['bk']++;}
    if(tEx($pdo,'tasks')){$tasks=$pdo->query("SELECT t.*,COALESCE(s.name,'N/A')AS sn FROM tasks t LEFT JOIN stores s ON s.id=t.store_id WHERE t.deleted_at IS NULL AND(t.archived_duplicate=0 OR t.archived_duplicate IS NULL)")->fetchAll(5);$tG=[];foreach($tasks as$t){$tG[strtolower(trim($t['title']??'')).'|'.($t['store_id']??'').'|'.($t['due_date']??'')][]=$t;}foreach($tG as$k=>$g){if(count($g)<=1){$log['tk']++;continue;}$can=$g[0];$dps=array_slice($g,1);foreach($dps as$d){$id=(int)$d['id'];try{if(cEx($pdo,'tasks','archived_duplicate'))$pdo->exec("UPDATE tasks SET archived_duplicate=1,duplicate_reason='P0_cleanup'WHERE id=$id");else$pdo->exec("UPDATE tasks SET deleted_at=NOW()WHERE id=$id");logAudit($pdo,'tasks','archive_duplicate','task',$id,$act,"P0 CEO: archived duplicate of task#{$can['id']}|{$can['title']}");$log['ta']++;}catch(Throwable$e){$log['err'][]="t:$id ".$e->getMessage();}}$log['tk']++;}}
    if(tEx($pdo,'payments')){$pays=$pdo->query("SELECT id,bill_id,amount,paid_at FROM payments")->fetchAll(5);$pG=[];foreach($pays as$p){$pG[($p['bill_id']??'').'|'.($p['amount']??'').'|'.($p['paid_at']??'')][]=$p;}foreach($pG as$k=>$g){if(count($g)<=1)continue;$dps=array_slice($g,1);foreach($dps as$d){$id=(int)$d['id'];try{if(cEx($pdo,'payments','is_archived'))$pdo->exec("UPDATE payments SET is_archived=1 WHERE id=$id");else$pdo->exec("DELETE FROM payments WHERE id=$id LIMIT 1");$log['pa']++;}catch(Throwable$e){$log['err'][]="p:$id ".$e->getMessage();}}}}
    $pdo->commit();$out['cleanup']=['ok'=>1,'log'=>$log];}
  catch(Throwable$e){$pdo->rollBack();$out['cleanup']=['ok'=>0,'e'=>$e->getMessage(),'log'=>$log];}}
// PENALTY RESET
if($step=='all'||$step=='5'||$step=='penalty'){
  $pdo->beginTransaction();$log=['penalties'=>0,'penalty_log'=>0,'penalty_assessments'=>0,'task_penalties'=>0,'users_reset'=>0];
  try{
    if(tEx($pdo,'penalties')){$log['penalties']=(int)$pdo->query("SELECT COUNT(*)FROM penalties")->fetchColumn();
      if(cEx($pdo,'penalties','status'))$pdo->exec("UPDATE penalties SET status='reset',updated_at=NOW()WHERE status!='reset'");
      elseif(cEx($pdo,'penalties','is_archived'))$pdo->exec("UPDATE penalties SET is_archived=1 WHERE is_archived=0");
      else $pdo->exec("DELETE FROM penalties");}
    if(tEx($pdo,'penalty_log')){$log['penalty_log']=(int)$pdo->query("SELECT COUNT(*)FROM penalty_log")->fetchColumn();
      if(cEx($pdo,'penalty_log','archived_at'))$pdo->exec("UPDATE penalty_log SET archived_at=NOW()WHERE archived_at IS NULL");
      else $pdo->exec("DELETE FROM penalty_log");}
    if(tEx($pdo,'penalty_assessments')){$log['penalty_assessments']=(int)$pdo->query("SELECT COUNT(*)FROM penalty_assessments")->fetchColumn();
      if(cEx($pdo,'penalty_assessments','is_archived'))$pdo->exec("UPDATE penalty_assessments SET is_archived=1 WHERE is_archived=0");
      else $pdo->exec("DELETE FROM penalty_assessments");}
    if(tEx($pdo,'task_penalties')){$log['task_penalties']=(int)$pdo->query("SELECT COUNT(*)FROM task_penalties")->fetchColumn();
      if(cEx($pdo,'task_penalties','is_archived'))$pdo->exec("UPDATE task_penalties SET is_archived=1 WHERE is_archived=0");
      else $pdo->exec("DELETE FROM task_penalties");}
    if(tEx($pdo,'penalty_appeals'))$pdo->exec("DELETE FROM penalty_appeals");
    if(tEx($pdo,'penalty_comments'))$pdo->exec("DELETE FROM penalty_comments");
    if(tEx($pdo,'users')){
      $q="UPDATE users SET ";$sets=[];
      if(cEx($pdo,'users','total_penalties'))$sets[]="total_penalties=0";
      if(cEx($pdo,'users','total_penalty_amount'))$sets[]="total_penalty_amount=0";
      if(cEx($pdo,'users','penalty_count'))$sets[]="penalty_count=0";
      if(cEx($pdo,'users','last_penalty_at'))$sets[]="last_penalty_at=NULL";
      if($sets){$pdo->exec($q.implode(',',$sets)." WHERE total_penalties>0 OR penalty_count>0");$log['users_reset']=(int)$pdo->query("SELECT ROW_COUNT()")->fetchColumn();}}
    if(tEx($pdo,'penalty_daily_snapshots'))$pdo->exec("DELETE FROM penalty_daily_snapshots");
    $reason="CEO requested full penalty reset before new penalty policy enforcement";
    logAudit($pdo,'penalties','full_reset','system',0,$act,$reason);
    $pdo->commit();$out['penalty_reset']=['ok'=>1,'log'=>$log,'reason'=>$reason];}
  catch(Throwable$e){$pdo->rollBack();$out['penalty_reset']=['ok'=>0,'e'=>$e->getMessage()];}}
// VERIFY
if($step=='all'||$step=='6'||$step=='verify'){
  $v=[];
  $bills=$pdo->query("SELECT b.id,b.bill_name AS t,b.store_id,b.due_date,b.amount,b.repeat_rule FROM bills b WHERE(b.is_archived=0 OR b.is_archived IS NULL)")->fetchAll(5);$gr=[];foreach($bills as$b){$gr[implode('|',[strtolower(trim($b['t']??'')),($b['store_id']??''),($b['due_date']??''),($b['amount']??''),($b['repeat_rule']??'')])][]=$b;}$v['bill_dups']=count(array_filter($gr,fn($g)=>count($g)>1));$v['active_bills']=count($bills);
  if(tEx($pdo,'tasks')){$tasks=$pdo->query("SELECT t.id,t.title,t.store_id,t.due_date FROM tasks t WHERE t.deleted_at IS NULL AND(t.archived_duplicate=0 OR t.archived_duplicate IS NULL)")->fetchAll(5);$tG=[];foreach($tasks as$t){$tG[strtolower(trim($t['title']??'')).'|'.($t['store_id']??'').'|'.($t['due_date']??'')][]=$t;}$v['task_dups']=count(array_filter($tG,fn($g)=>count($g)>1));$v['active_tasks']=count($tasks);}
  if(tEx($pdo,'payments')){$pays=$pdo->query("SELECT id,bill_id,amount,paid_at FROM payments")->fetchAll(5);$pG=[];foreach($pays as$p){$pG[($p['bill_id']??'').'|'.($p['amount']??'').'|'.($p['paid_at']??'')][]=$p;}$v['pay_dups']=count(array_filter($pG,fn($g)=>count($g)>1));}
  $v['penalties']=tEx($pdo,'penalties')?(int)$pdo->query("SELECT COUNT(*)FROM penalties WHERE status!='reset'AND(status IS NULL OR status='')")->fetchColumn():0;
  $v['penalty_log']=tEx($pdo,'penalty_log')?(int)$pdo->query("SELECT COUNT(*)FROM penalty_log WHERE archived_at IS NULL")->fetchColumn():0;
  $v['pass']=($v['bill_dups']===0&&$v['task_dups']===0);
  $out['verify']=$v;}
echo json_encode($out);
