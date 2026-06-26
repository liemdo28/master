# Hướng Dẫn Cập Nhật Tính Năng & API Keys

> **Ngày tạo**: 2026-06-24  
> **Dành cho**: dev1 (Laptop1)  
> **Mục tiêu**: Cập nhật tính năng và API keys mà KHÔNG làm thay đổi source quá nhiều

---

## 📋 Tổng Quan Kiến Trúc

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: IDE Layer (Ổn định - KHÔNG ĐỘNG)                 │
│  ~/Projects/agent-coding/  (Laptop1 khác PC)                │
└───────────────────────┬─────────────────────────────────────┘
                        │  HTTP env vars
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Gateway Layer (THAY ĐỔI TẠI ĐÂY)                  │
│  agent-coding-api-keys/  ← Project hiện tại                │
│  Port: 3456                                               │
└─────────────────────────────────────────────────────────────┘
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
   Antigravity      OpusMax        Ollama
   (NKQ api)       (Shop)       (Local)
```

---

## ⚠️ Nguyên Tắc Quan Trọng

1. **KHÔNG thay đổi kiến trúc thư mục** - Laptop1 và PC có cấu trúc khác nhau
2. **Chỉ cập nhật config và keys** - Không sửa source code core trừ khi cần thiết
3. **Backup trước khi thay đổi** - Luôn tạo bản sao lưu
4. **Test sau khi cập nhật** - Chạy `npm run build` và `npm start`

---

## 🔑 Cách Quản Lý API Keys

### 1. Nơi lưu trữ Keys

```
keys.json                    ← Nơi chính (gitignored)
.env                         ← Override từ env var
src/config/defaults.ts       ← Chỉ đọc, không sửa
```

### 2. Cấu trúc keys.json

```json
{
  "activeProviders": ["antigravity", "opusmax"],
  "mode": "fallback",
  "providers": {
    "antigravity": {
      "baseURL": "https://api.nkq.vn/v1",
      "model": "claude-opus-4-7",
      "keys": [
        {
          "id": "key-1",
          "value": "sk-ant-XXXXX",
          "active": true,
          "label": "NKQ Key 1 (AGOP-6094)"
        }
      ]
    },
    "opusmax": {
      "baseURL": "https://opusmax.shop/v1",
      "model": "claude-opus-4-7-standard",
      "keys": [
        {
          "id": "key-1",
          "value": "sk-om-XXXXX",
          "active": true,
          "label": "OpusMax Key 1"
        }
      ]
    }
  }
}
```

### 3. Thêm Key Mới

**Cách 1: Qua Dashboard (Khuyến nghị)**
```
http://localhost:3456
→ Dashboard → Providers → Thêm Key
```

**Cách 2: Sửa trực tiếp keys.json**

```bash
# Mở file
code keys.json

# Thêm key mới vào provider
{
  "keys": [
    { "id": "key-new", "value": "YOUR_KEY_HERE", "active": true, "label": "Key description" }
  ]
}
```

### 4. Override bằng Environment Variables

```bash
# Trong .env hoặc terminal
ANTIGRAVITY_API_KEY=sk-ant-xxxxx
ANTIGRAVITY_API_KEYS=sk-key1,sk-key2,sk-key3
OPUSMAX_API_KEY=sk-om-xxxxx
OPUSMAX_BASE_URL=https://custom-endpoint.com/v1
```

---

## 🔧 Cập Nhật Tính Năng

### 1. Cập nhật Provider Configuration

**File**: `keys.json`

```json
{
  "activeProviders": ["antigravity", "opusmax", "ollama"],
  "providers": {
    "antigravity": {
      "baseURL": "https://api.nkq.vn/v1",
      "models": ["claude-opus-4-7", "claude-opus-4-6"],
      "aliases": {
        "claude-opus-4-7": ["claude-opus-4-7"],
        "claude-sonnet-4-6": ["claude-opus-4-6"]
      }
    }
  }
}
```

### 2. Cập nhật Model Aliases

**File**: `src/config/defaults.ts` (CHỈ khi cần thiết)

```typescript
export const DEFAULT_MODEL_ALIASES: Record<string, string[]> = {
  'claude-opus-4-7': ['claude-opus-4.7', 'claude-opus-4'],
  // Thêm alias mới nếu cần
};
```

### 3. Cập nhật Routes

**File**: `keys.json`

```json
{
  "routes": {
    "coding": ["antigravity", "opusmax", "deepseek", "openrouter"],
    "fallback": ["antigravity", "opusmax", "openrouter", "anthropic"]
  }
}
```

### 4. Thêm Provider Mới

**Bước 1**: Thêm vào `keys.json`

```json
{
  "providers": {
    "newprovider": {
      "baseURL": "https://api.newprovider.com/v1",
      "model": "gpt-4",
      "keys": [{ "value": "key-here", "active": true }]
    }
  }
}
```

**Bước 2**: Thêm vào `activeProviders`

```json
{
  "activeProviders": ["antigravity", "opusmax", "newprovider"]
}
```

---

## 📁 Cấu Trúc Source Cần Biết

```
agent-coding-api-keys/
├── keys.json                 ← ✅ SỬA: API keys, providers
├── .env                      ← ✅ SỬA: Environment variables
├── src/
│   ├── config/
│   │   ├── defaults.ts       ← ⚠️ ÍT SỬA: Default configs
│   │   └── config-loader.ts  ← ⚠️ KHÔNG SỬA: Config loader
│   ├── providers/             ← ⚠️ KHÔNG SỬA: Provider implementations
│   ├── router/                ← ⚠️ KHÔNG SỬA: Routing logic
│   └── server.ts             ← ⚠️ KHÔNG SỬA: Entry point
├── src/keys/
│   └── keys-manager.ts       ← ✅ DÙNG: API quản lý keys
└── tests/                     ← ✅ THÊM: Test cases
```

---

## 🚀 Các Lệnh Cần Nhớ

```bash
# Cài đặt dependencies
npm install

# Build TypeScript
npm run build

# Chạy gateway
npm start

# Kiểm tra health
curl http://localhost:3456/health

# Xem logs
type gateway.log.1
```

---

## 🔍 Checklist Cập Nhật

### Khi cập nhật API Keys:
- [ ] Backup keys.json hiện tại
- [ ] Thêm key mới với label mô tả rõ ràng
- [ ] Set `active: true` cho key muốn sử dụng
- [ ] Restart gateway: `npm start`
- [ ] Test bằng: `curl http://localhost:3456/health`

### Khi cập nhật Provider Config:
- [ ] Backup keys.json
- [ ] Kiểm tra baseURL đúng
- [ ] Verify model names được support
- [ ] Test kết nối trước khi deploy

### Khi cập nhật Model Aliases:
- [ ] Backup defaults.ts
- [ ] Thêm alias vào đúng format
- [ ] Rebuild: `npm run build`
- [ ] Test với model alias mới

---

## 📊 Danh Sách Providers Hiện Tại

| Provider | Base URL | Priority | Status |
|----------|----------|----------|--------|
| antigravity (NKQ) | api.nkq.vn | 10 (Primary) | ✅ |
| opusmax | opusmax.shop | 20 (Fallback) | ✅ |
| anthropic | api.anthropic.com | 30 | 🔄 |
| openrouter | openrouter.ai | 40 | 🔄 |
| openai | api.openai.com | 50 | 🔄 |
| gemini | generativelanguage.googleapis.com | 60 | 🔄 |
| deepseek | api.deepseek.com | 70 | 🔄 |
| ollama | localhost:11434 | 80 (Local) | ✅ |

---

## ⚡ Troubleshooting

### Gateway không khởi động
```bash
# Kiểm tra port 3456 có bị chiếm không
netstat -ano | findstr 3456

# Kill process nếu cần
taskkill /PID <pid> /F
```

### Key không hoạt động
1. Kiểm tra key có đúng format không
2. Verify baseURL của provider
3. Check logs: `type gateway.log.1`
4. Test trực tiếp: `curl -X POST http://localhost:3456/v1/chat/completions`

### Provider timeout
```bash
# Tăng timeout trong .env
REQUEST_TIMEOUT_MS=180000
```

---

## 📞 Liên Hệ & Hỗ Trợ

- **Dashboard**: http://localhost:3456
- **Health Check**: http://localhost:3456/health
- **API Status**: http://localhost:3456/api/status

---

> **Lưu ý cuối**: Luôn commit với message rõ ràng khi thay đổi config. Ví dụ: `git commit -m "Update opusmax API key - 2026-06-24"`
