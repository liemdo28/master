#!/bin/bash
# Gateway helper — run from anywhere:  ./gw.sh start | stop | logs | metrics | health
cd "$(dirname "$0")"

PORT="${PORT:-3456}"
CMD="${1:-help}"

_kill_port() {
  local pids
  pids=$(lsof -ti:"$PORT" 2>/dev/null)
  if [ -n "$pids" ]; then
    echo "[gw] Killing existing process on port $PORT (PID: $pids)"
    echo "$pids" | xargs kill -SIGTERM 2>/dev/null
    sleep 1
    # Force kill if still running
    pids=$(lsof -ti:"$PORT" 2>/dev/null)
    [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null
  fi
}

case "$CMD" in
  start)
    _kill_port
    echo "[gw] Starting gateway on port $PORT..."
    npm start
    ;;
  restart)
    _kill_port
    echo "[gw] Restarting gateway on port $PORT..."
    npm start
    ;;
  stop)
    _kill_port
    echo "[gw] Gateway stopped."
    ;;
  dev)
    _kill_port
    echo "[gw] Starting in dev mode..."
    npm run dev
    ;;
  build)
    npm run build
    ;;
  status)
    if lsof -ti:"$PORT" >/dev/null 2>&1; then
      echo "[gw] Running on port $PORT (PID: $(lsof -ti:"$PORT"))"
      curl -s "http://127.0.0.1:$PORT/health" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Status:', d['status'], '| Mode:', d['mode'], '| Providers:', len([p for p in d['providers'] if p['enabled']]),'enabled')" 2>/dev/null
    else
      echo "[gw] NOT running on port $PORT"
    fi
    ;;
  health)
    curl -s "http://127.0.0.1:$PORT/health" | python3 -m json.tool 2>/dev/null || curl -s "http://127.0.0.1:$PORT/health"
    ;;
  logs)
    curl -s "http://127.0.0.1:$PORT/api/logs/structured" | python3 -m json.tool 2>/dev/null || curl -s "http://127.0.0.1:$PORT/api/logs/structured"
    ;;
  metrics)
    curl -s "http://127.0.0.1:$PORT/api/metrics" | python3 -m json.tool 2>/dev/null || curl -s "http://127.0.0.1:$PORT/api/metrics"
    ;;
  runtime)
    open "http://127.0.0.1:$PORT/runtime"
    ;;
  dashboard)
    open "http://127.0.0.1:$PORT"
    ;;
  docker:build)
    docker build -t antigravity-gateway:latest .
    ;;
  docker:run)
    docker compose up -d && echo "[gw] Gateway running in Docker at :3456"
    ;;
  docker:stop)
    docker compose down
    ;;
  docker:logs)
    docker compose logs -f gateway
    ;;
  *)
    echo "Antigravity Gateway Helper"
    echo ""
    echo "Usage: ./gw.sh <command> [PORT=3456]"
    echo ""
    echo "Commands:"
    echo "  start          Kill existing + start gateway (foreground)"
    echo "  restart        Same as start"
    echo "  stop           Kill gateway on port \$PORT"
    echo "  status         Show running status"
    echo "  dev            Start in dev mode (tsx, hot-reload)"
    echo "  build          Compile TypeScript"
    echo "  health         Check /health endpoint"
    echo "  logs           View structured request logs"
    echo "  metrics        View gateway metrics"
    echo "  runtime        Open Runtime OPS dashboard"
    echo "  dashboard      Open main dashboard"
    echo "  docker:build   Build Docker image"
    echo "  docker:run     Start via docker compose"
    echo "  docker:stop    Stop docker compose"
    echo "  docker:logs    Tail docker logs"
    ;;
esac
