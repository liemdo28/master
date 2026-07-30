#!/bin/bash
set -euo pipefail

test_case () {
  local name="$1" content="$2" status="$3"
  local tmpheaders last_block marker_raw location interpretation
  tmpheaders=$(mktemp)
  printf '%s' "$content" > "$tmpheaders"

  last_block=$(awk 'BEGIN{RS="\r?\n\r?\n"} NF>0{last=$0} END{print last}' "$tmpheaders" 2>/dev/null || true)
  if [ -z "$last_block" ]; then
    last_block=$(cat "$tmpheaders" 2>/dev/null || true)
  fi

  marker_raw=$(printf '%s\n' "$last_block" | grep -i '^X-Sec-Web-Contain:' | tail -1 | sed -E 's/^[Xx]-[Ss]ec-[Ww]eb-[Cc]ontain:[[:space:]]*//' | tr -d '\r' || true)
  location=$(printf '%s\n' "$last_block" | grep -i '^Location:' | tail -1 | sed -E 's/^[Ll]ocation:[[:space:]]*//' | tr -d '\r' || true)
  location="${location%%\?*}"
  rm -f "$tmpheaders" || true

  if [ "$marker_raw" = "blocked" ]; then
    interpretation="A: PROVEN DENY MATCH (exact marker)"
  elif [ -z "$marker_raw" ]; then
    interpretation="B: INCONCLUSIVE (no marker)"
  else
    interpretation="INVALID DIAGNOSTIC RESPONSE"
  fi
  if [ "$status" = "200" ]; then
    interpretation="C: FAIL - raw 200"
  elif [ "$status" = "500" ]; then
    interpretation="D: FAIL - 500"
  fi

  echo "[$name] marker='${marker_raw:-<empty>}' location='${location:-<empty>}' -> $interpretation"
}

# Case 1: exact marker match, single block
test_case "exact-marker" $'HTTP/1.1 403 Forbidden\r\nX-Sec-Web-Contain: blocked\r\nContent-Type: text/html\r\n\r\n' "403"

# Case 2: no marker at all (plain 302 to login)
test_case "no-marker" $'HTTP/1.1 302 Found\r\nLocation: https://dashboard.bakudanramen.com/login\r\n\r\n' "302"

# Case 3: marker present but wrong value
test_case "invalid-marker" $'HTTP/1.1 403 Forbidden\r\nX-Sec-Web-Contain: something-else\r\n\r\n' "403"

# Case 4: multiple header blocks (100-continue then final 302 with marker)
test_case "multi-block" $'HTTP/1.1 100 Continue\r\n\r\nHTTP/1.1 302 Found\r\nLocation: /login\r\nX-Sec-Web-Contain: blocked\r\n\r\n' "302"

# Case 5: totally empty headers (curl failure fallback scenario)
test_case "empty-headers" "" "000"

echo "ALL CASES COMPLETED WITHOUT ABORTING (set -e -o pipefail was active throughout)"
