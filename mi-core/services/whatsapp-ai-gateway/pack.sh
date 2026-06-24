#!/usr/bin/env bash
# Creates a clean distributable zip — excludes secrets, session data, and node_modules
set -e

VERSION=$(node -p "require('./package.json').version")
OUT="whatsapp-ai-gateway-v${VERSION}.zip"

echo "Packing v${VERSION} → ${OUT}"

rm -f "${OUT}"

zip -r "${OUT}" . \
  --exclude "*.git*" \
  --exclude "./node_modules" \
  --exclude "node_modules/*" \
  --exclude "./secrets" \
  --exclude "secrets/*" \
  --exclude "./.wwebjs_auth" \
  --exclude ".wwebjs_auth/*" \
  --exclude "./.wwebjs_cache" \
  --exclude ".wwebjs_cache/*" \
  --exclude "./logs" \
  --exclude "logs/*" \
  --exclude "./installer" \
  --exclude "installer/*" \
  --exclude "./screenshots" \
  --exclude "screenshots/*" \
  --exclude "*/screenshots" \
  --exclude "*/screenshots/*" \
  --exclude ".env" \
  --exclude "*.zip" \
  --exclude "data/uploads" \
  --exclude "data/uploads/*" \
  --exclude "data/runtime" \
  --exclude "data/runtime/*" \
  --exclude "data/template-ocr-smoke" \
  --exclude "data/template-ocr-smoke/*" \
  --exclude "data/whatsapp" \
  --exclude "data/whatsapp/*" \
  --exclude "data/session*" \
  --exclude "data/session/*" \
  --exclude "data/session*/*" \
  --exclude "data/backup/*.json" \
  --exclude "data/backup/*.db*" \
  --exclude "data/backup/*.malformed*" \
  --exclude "data/*.db" \
  --exclude "data/*.db-shm" \
  --exclude "data/*.db-wal" \
  --exclude "data/*.journal" \
  --exclude "*/Cache/*" \
  --exclude "*/Local Storage/*" \
  --exclude "*/IndexedDB/*" \
  --exclude "*/Login Data*" \
  --exclude "*/Cookies*" \
  --exclude "*/Local State" \
  --exclude "*/Preferences" \
  --exclude "*/Secure Preferences" \
  --exclude "*/History*" \
  --exclude "*/Favicons*" \
  --exclude "s.trim()).includes(chatId)" \
  --exclude "{const" \
  --exclude "test.txt" \
  --exclude "temp_md1.txt" \
  --exclude "make_docs.py" \
  --exclude "make_docs2.py" \
  --exclude "write_docs.py" \
  --exclude "write_docs.js" \
  --exclude "write_both.py" \
  --exclude "*/LOCK" \
  --exclude "*/LOG" \
  --exclude "*/LOG.old"

echo "Verifying exclusions..."
VIOLATION_REGEX='(^\.env$|^node_modules(/|$)|^secrets(/|$)|^\.wwebjs_auth(/|$)|^\.wwebjs_cache(/|$)|^logs(/|$)|^installer(/|$)|^screenshots(/|$)|^data/uploads(/|$)|^data/runtime(/|$)|^data/template-ocr-smoke(/|$)|^data/whatsapp(/|$)|^data/session[^/]*(/.*)?$|^data/backup/.*\.json$|^data/backup/.*\.db.*$|^data/backup/.*\.malformed.*$|^data/[^/]*\.db$|^data/[^/]*\.db-wal$|^data/[^/]*\.db-shm$|^data/[^/]*\.journal$|(^|.*/)Cache(/|$)|(^|.*/)Local Storage(/|$)|(^|.*/)IndexedDB(/|$)|(^|.*/)Login Data.*$|(^|.*/)Cookies.*$|(^|.*/)Local State$|(^|.*/)Preferences$|(^|.*/)Secure Preferences$|(^|.*/)History.*$|(^|.*/)Favicons.*$|(^|.*/)s\.trim\(\)\)\.includes\(chatId\)$|(^|.*/)\{const$|(^|.*/)test\.txt$|(^|.*/)temp_md1\.txt$|(^|.*/)make_docs\.py$|(^|.*/)make_docs2\.py$|(^|.*/)write_docs\.py$|(^|.*/)write_docs\.js$|(^|.*/)write_both\.py$|(^|.*/)LOCK$|(^|.*/)LOG$|(^|.*/)LOG\.old$|\.zip$)'
if unzip -Z1 "${OUT}" | grep -E "${VIOLATION_REGEX}" >/dev/null; then
  echo "FAIL: excluded files found in zip"
  unzip -Z1 "${OUT}" | grep -E "${VIOLATION_REGEX}"
  exit 1
fi

echo "Done: ${OUT}"
echo ""
echo "Recipient install steps:"
echo "  1. unzip ${OUT}"
echo "  2. npm install"
echo "  3. cp .env.example .env && edit .env"
echo "  4. npm start"
