<?php
/** P0: DB Backup only */
define('K','P0-CEO-2026');if(($_GET['key']??'')!==K){http_response_code(403);die('F');}
error_reporting(0);ini_set('max_execution_time','600');ini_set('memory_limit','512M');header('Content-Type:application/json;charset=utf-8');
$ef=__DIR__.'/.env';if(!file_exists($ef))$ef='/home/liemdo0208/dashboard.bakudanramen.com/.env';
if(!file_exists($ef))die(json_encode(['e'=>'.env nf']));
list($H,$N,$U,$P)=['','','',''];
foreach(file($ef,2|512)as$l){$l=trim($l);if(!$l||$l[0]=='#'||strpos($l,'=')===false)continue;[$k,$v]=explode('=',$l,2);$k=trim($k);$v=trim($v);if(preg_match('/^([\'"])(.*)\\1$/',$v,$m))$v=$m[2];if($k=='DB_HOST')$H=$v;if($k=='DB_NAME')$N=$v;if($k=='DB_USER')$U=$v;if($k=='DB_PASS')$P=$v;}
try{$pdo=new PDO("mysql:host=$H;dbname=$N;charset=utf8mb4",$U,$P,[3=>3,5=>5]);$pdo->exec('SET NAMES utf8mb4');}catch(PDOException$e){die(json_encode(['e'=>'DB fail','d'=>$e->getMessage()]));}
$BD=__DIR__.'/backups';if(!is_dir($BD))@mkdir($BD,0755,1);
$T=['tasks','users','comments','attachments','files','images','credentials','credential_permissions','task_approval_events','audit_logs','notifications','stores','projects','shifts','bills','employees','deadline_extensions','penalties','penalty_assessments','penalty_history','penalty_rules','task_penalties','penalty_daily_snapshots','penalty_log','payments','vendors','duplicate_task_flags','duplicate_bill_flags','obligation_payments','obligation_tasks','obligations'];
$ts=date('Y-m-d_H-i-s');$fn="P0_BACKUP_$ts.sql.gz";$fp=gzopen($BD.'/'.$fn,'w');
if(!$fp)die(json_encode(['e'=>"Cannot write $BD/$fn"]));
gzwrite($fp,"-- P0 Backup $ts|DB:$N\nSET FOREIGN_KEY_CHECKS=0;\n\n");$tc=[];
foreach($T as$tbl){$s=preg_replace('/[^a-zA-Z0-9_]/','',$tbl);if(!$pdo->query("SELECT 1 FROM information_schema.tables WHERE table_schema='$N' AND table_name='$s' LIMIT 1")->fetchColumn())continue;$cnt=(int)$pdo->query("SELECT COUNT(*) FROM `$s`")->fetchColumn();$tc[$s]=$cnt;$cr=$pdo->query("SHOW CREATE TABLE `$s`")->fetch();if($cr)gzwrite($fp,"\n-- $s($cnt)\nDROP TABLE IF EXISTS `$s`;\n".$cr['Create Table'].";\n\n");
if($cnt>0){$off=0;while(1){$rows=$pdo->query("SELECT * FROM `$s` LIMIT 200 OFFSET $off")->fetchAll(5);if(!$rows)break;$cs=array_map(fn($c)=>"`".preg_replace('/[^a-zA-Z0-9_]/','',$c)."`",array_keys($rows[0]));$vl=[];foreach($rows as$row){$p2=[];foreach(array_values($row)as$v){if($v===null)$p2[]='NULL';elseif(is_numeric($v))$p2[]=(string)$v;else$p2[]=$pdo->quote((string)$v);}$vl[]='('.implode(',',$p2).')';}gzwrite($fp,"INSERT INTO `$s` (".implode(',',$cs).") VALUES\n".implode(",\n",$vl).";\n");$off+=200;if(count($rows)<200)break;}}}
gzwrite($fp,"\nSET FOREIGN_KEY_CHECKS=1;\n");gzclose($fp);$fsz=filesize($BD.'/'.$fn);
echo json_encode(['ok'=>1,'fn'=>$fn,'sz'=>$fsz,'szh'=>round($fsz/1048576,2).'MB','t'=>$tc,'ts'=>$ts]);
