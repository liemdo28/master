#!/bin/bash
set -e
cd ~/bakudanramen.com

BACKUP=".htaccess.backup-$(date +%Y%m%d_%H%M%S)"
cp .htaccess "$BACKUP"
echo "Backup: $BACKUP"

cat >> .htaccess << 'HTACCESS'

# Links Hub Node backend (jitless - grsec kernel compatibility)
PassengerAppRoot /home/liemdo0208/bakudanramen.com
PassengerAppType node
PassengerStartupFile server/server.js
PassengerNodejs /home/liemdo0208/nodejs22-jitless
PassengerBaseURI /api
HTACCESS

mkdir -p tmp && touch tmp/restart.txt
sleep 6

HOME_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://www.bakudanramen.com/)
MENU_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://www.bakudanramen.com/menu.html)
API_RESP=$(curl -s https://www.bakudanramen.com/api/public/links/bakudan)

echo "homepage: $HOME_CODE"
echo "menu.html: $MENU_CODE"
echo "api response: $API_RESP"

if [ "$HOME_CODE" != "200" ] || [ "$MENU_CODE" != "200" ]; then
  echo "!!! SITE BROKEN -- ROLLING BACK !!!"
  cp "$BACKUP" .htaccess
  touch tmp/restart.txt
  sleep 5
  HOME_CODE2=$(curl -s -o /dev/null -w "%{http_code}" https://www.bakudanramen.com/)
  echo "After rollback, homepage: $HOME_CODE2"
  echo "RESULT: ROLLED BACK"
else
  echo "RESULT: SITE HEALTHY"
fi
