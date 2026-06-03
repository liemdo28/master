# Agent OS - Build Instructions

## Quick Build

### 1. Build Shared Library
```cmd
cd e:\Project\Master\agent-os\shared
npm install
npm run build
```

### 2. Build Control Plane
```cmd
cd e:\Project\Master\agent-os\agent-control
npm install
npm run build
```

### 3. Build Worker
```cmd
cd e:\Project\Master\agent-os\agent-worker
npm install
npm run build
```

## Start Control Plane
```cmd
cd e:\Project\Master\agent-os\agent-control
npm start
```

## Start Worker
```cmd
cd e:\Project\Master\agent-os\agent-worker
npm start
```

## One-Line Build All
```cmd
cd e:\Project\Master\agent-os\shared && npm install && npm run build && cd ..\agent-control && npm install && npm run build && cd ..\agent-worker && npm install && npm run build
```
