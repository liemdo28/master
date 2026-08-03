#!/usr/bin/env bash
# Phase 4: one-time authorized model fetch. Sequential, disk-guarded.
# Floor: stop before D: free space drops below 30 GB.
export OLLAMA_HOST=127.0.0.1:11434
set -u

LOG="D:/phase4-agentic-coding/.phase4/evidence/model-pull.log"
mkdir -p "$(dirname "$LOG")"

free_gb() {
  powershell -NoProfile -Command "[math]::Round((Get-PSDrive -PSProvider FileSystem -Name D).Free/1GB,1)" 2>/dev/null | tr -d '\r'
}

MODELS="qwen2.5-coder:7b qwen2.5-coder:14b deepseek-coder-v2:lite"

{
  echo "=== Phase 4 model pull started $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  echo "OLLAMA_MODELS=${OLLAMA_MODELS:-<unset>}"
  echo "disk_free_gb_start=$(free_gb)"
} | tee -a "$LOG"

for m in $MODELS; do
  before=$(free_gb)
  echo "--- pulling $m (disk_free_gb=$before) ---" | tee -a "$LOG"
  if awk -v f="$before" 'BEGIN{exit !(f < 30)}'; then
    echo "ABORT: disk free ${before}GB below 30GB floor; skipping $m and all remaining" | tee -a "$LOG"
    break
  fi
  attempt=1
  ok=0
  while [ $attempt -le 2 ]; do
    echo "attempt $attempt for $m" | tee -a "$LOG"
    if ollama pull "$m" >>"$LOG" 2>&1; then
      ok=1; break
    fi
    echo "attempt $attempt FAILED for $m" | tee -a "$LOG"
    attempt=$((attempt+1))
    sleep 5
  done
  after=$(free_gb)
  if [ $ok -eq 1 ]; then
    echo "OK $m (disk_free_gb=$after)" | tee -a "$LOG"
  else
    echo "FAILED-TWICE $m (disk_free_gb=$after)" | tee -a "$LOG"
  fi
done

{
  echo "disk_free_gb_end=$(free_gb)"
  echo "=== installed models ==="
  ollama list
  echo "=== Phase 4 model pull finished $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
} | tee -a "$LOG"
