@echo off
set MYSQL="C:\xampp\mysql\bin\mysql.exe"
%MYSQL% -h mysql-taskflow.bakudanramen.com -u liemdo -pliem@dt2155 taskflow_db -e "SELECT table_name FROM information_schema.tables WHERE table_schema='taskflow_db' ORDER BY table_name;"
