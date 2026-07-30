<?php
header('Content-Type:application/json');
$ef=__DIR__.'/.env';if(!file_exists($ef))$ef='/home/liemdo0208/dashboard.bakudanramen.com/.env';
if(!file_exists($ef)){echo json_encode(['e'=>'.env nf','dir'=>__DIR__,'cwd'=>getcwd()]);exit;}
echo json_encode(['ok'=>1,'env'=>$ef,'php'=>phpversion()]);
