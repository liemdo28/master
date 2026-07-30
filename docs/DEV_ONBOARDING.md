# Mi-Core Developer Onboarding
**Dành cho:** External Dev — Integration System, Review System, Doordash Campaigns  
**Cập nhật:** 2026-06-11

---

## 1. Tổng quan hệ thống

```
                     ┌──────────────────────────────────┐
                     │         CEO PHONE (WhatsApp)      │
                     └────────────┬─────────────────────┘
                                  │ /mi commands
                     ┌────────────▼─────────────────────┐
                     │   whatsapp-ai-gateway (Laptop 1)  │
                     │   Port: 3210 | Runs 24/7          │
                     │   - Food Safety Chatbot           │
                     │   - /mi routing → Mi-Core         │
                     └────────────┬─────────────────────┘
                                  │ REST API (LAN/Tailscale)
                     ┌────────────▼─────────────────────┐
                     │       Mi-Core PC (Main Brain)     │
                     │       http://192.168.x.x:4001     │
                     │   - AI Engine (Ollama local)      │
                     │   - Big Data (PG + MinIO + Qdrant)│
                     │   - Approval Gate (L1/L2/L3)      │
                     │   - Node Controller               │
                     └────┬──────────┬──────────┬───────┘
                          │          │          │
              ┌───────────▼─┐  ┌─────▼──────┐  ┌▼──────────────────┐
              │ Integration  │  │   Review   │  │ Doordash Campaigns │
              │ System       │  │   System   │  │                    │
              │ (Laptop 1)   │  │ (Laptop 1) │  │   (Laptop 1)       │
              │ ACTIVE node  │  │            │  │                    │
              └─────────────┘  └────────────┘  └────────────────────┘
```

**Nguyên tắc:**
- Mi-Core PC là **brain duy nhất** — tất cả AI, data, approval đều qua đây
- Laptop 1 chạy các project con — **worker nodes**
- Mọi action nguy hiểm (push, deploy, delete) đều cần CEO approve qua WhatsApp
- Local AI first — không gọi cloud AI mặc định

---

## 2. Những gì Dev cần build cho mỗi project

### 2.1 Yêu cầu bắt buộc với mỗi project

Mỗi project trên Laptop 1 **phải có**:

#### A. Mi-Node Agent (đã có sẵn — chỉ cần chạy)
```
Thư mục: E:\Project\Master\mi-node-agent\
```
Đây là một Express server nhỏ (port 4100), Mi-Core dùng để:
- Kiểm tra status của laptop
- Chạy lệnh allowlisted (git pull, npm run build, pm2 restart...)
- Đọc file log

Dev **không cần code gì** — chỉ cần chạy:
```bash
cd E:\Project\Master\mi-node-agent
npm install && npm run build
```
Config trong `.env`:
```
NODE_ID=laptop1
NODE_SECRET=<dev tự đặt, báo lại cho CEO>
NODE_AGENT_PORT=4100
MI_CORE_URL=http://<MI_CORE_IP>:4001
```

#### B. Health Endpoint (`GET /health`)
Mỗi project **phải có** endpoint này — Mi-Core sẽ poll mỗi 15 phút:
```json
GET /health
→ {
    "status": "ok",
    "project": "integration-system",
    "version": "1.0.0",
    "uptime_seconds": 3600,
    "timestamp": "2026-06-11T00:00:00.000Z"
  }
```

#### C. Register với Mi-Core khi khởi động
Gọi API này một lần khi app start:
```http
POST http://<MI_CORE_IP>:4001/api/nodes/register
Content-Type: application/json

{
  "node_id": "laptop1",
  "port": 4100,
  "platform": "win32",
  "node_version": "v20.0.0"
}
```

---

## 3. API Mi-Core — Những gì project con có thể gọi

**Base URL:** `http://<MI_CORE_IP>:4001`  
**Auth:** Không cần — chỉ chạy trên LAN/Tailscale, IP guard tự động cho phép

### 3.1 Approval Gate — Bắt buộc cho write actions

Trước khi thực hiện bất kỳ action nào có rủi ro, project **phải xin approval**:

```
Risk Level:
  L1 = read-only    → tự động pass, không cần approval
  L2 = write/create → CEO approve 1 lần qua WhatsApp
  L3 = dangerous    → CEO approve 2 lần (git push, delete, deploy prod)
```

**Xin approval:**
```http
POST /api/approval/enqueue
Content-Type: application/json

{
  "risk_level": 2,
  "category": "create_task",
  "description": "Tạo task mới trên Asana cho campaign Q3",
  "target": "Asana project: Doordash Q3"
}

→ { "id": "abc123", "status": "pending", "risk_level": 2 }
```

**Kiểm tra approval đã được duyệt chưa:**
```http
GET /api/approval/abc123
→ { "id": "abc123", "status": "approved" | "rejected" | "pending" }
```

**Nguyên tắc:** Không bao giờ tự ý execute L2/L3 mà không có `status: "approved"`.

---

### 3.2 Data Push vào Mi-Core Big Data

Mi-Core có PostgreSQL + MinIO + Qdrant. Projects có thể push data vào để CEO xem qua dashboard/WhatsApp.

**Push metrics/events:**
```http
POST /api/bigdata/ingest
Content-Type: application/json

{
  "source": "integration-system",
  "type": "metric",
  "data": {
    "event": "release_deployed",
    "version": "v2.1.0",
    "store": "stone_oak",
    "duration_ms": 4200
  },
  "timestamp": "2026-06-11T10:00:00.000Z"
}
```

**Upload file vào MinIO:**
```http
POST /api/bigdata/upload
Content-Type: multipart/form-data

file=<binary>
bucket=mi-reports
key=integration/report-2026-06-11.xlsx
```

**Lưu ý bảo mật — KHÔNG ĐƯỢC push:**
- API keys, passwords, tokens
- .env file content
- OAuth tokens, session cookies
- Private keys, credentials

---

### 3.3 Push thông báo lên WhatsApp CEO

Khi có event quan trọng, project có thể notify CEO qua WhatsApp:
```http
POST /api/whatsapp/mi/notify
Content-Type: application/json
x-api-key: <MI_NOTIFY_KEY>   ← CEO cấp

{
  "source": "integration-system",
  "level": "warning",          // info | warning | critical
  "message": "Deploy v2.1.0 hoàn thành — 3/3 stores OK",
  "data": { "version": "v2.1.0", "duration_ms": 12000 }
}
```

---

### 3.4 Pull data từ Mi-Core

```http
# Lấy danh sách approvals đang chờ
GET /api/approval?status=pending

# Lấy project list
GET /api/projects

# Lấy connector status
GET /api/visibility/connectors

# Xem knowledge base
POST /api/knowledge/search
{ "query": "stone oak daily template", "limit": 5 }
```

---

## 4. Spec từng project

### 4.1 Integration System

**Mục đích:** Quản lý deploy, release, sync data giữa các store  
**Node role:** `ACTIVE` (leader lock — chỉ 1 instance chạy active tại 1 thời điểm)  
**Port gợi ý:** `4200`

**Yêu cầu bắt buộc:**
- `GET /health` endpoint
- Heartbeat mỗi 3 phút: `POST http://MI_CORE:4001/api/nodes/laptop1/heartbeat`
- Tất cả git push, deploy production → L3 approval
- Chỉ 1 instance được `ACTIVE` tại 1 thời điểm (leader lock)

**Env vars cần:**
```env
MI_CORE_URL=http://<MI_CORE_IP>:4001
NODE_ID=laptop1
MI_NOTIFY_KEY=<CEO cấp>
PORT=4200
```

---

### 4.2 Review System

**Mục đích:** Thu thập và phân tích reviews từ Google, Yelp, Doordash  
**Port gợi ý:** `4300`

**Yêu cầu bắt buộc:**
- `GET /health` endpoint
- Push review summary vào Mi-Core mỗi ngày
- Khi review < 3 sao → notify CEO qua WhatsApp ngay

**Data format khi push review:**
```json
POST /api/bigdata/ingest
{
  "source": "review-system",
  "type": "review",
  "data": {
    "store": "stone_oak",
    "platform": "google",
    "rating": 2,
    "text": "...",
    "reviewer": "...",
    "url": "..."
  }
}
```

---

### 4.3 Doordash Campaigns

**Mục đích:** Quản lý campaigns, promotions trên Doordash  
**Port gợi ý:** `4400`

**Yêu cầu bắt buộc:**
- `GET /health` endpoint
- Tạo/sửa campaign → L2 approval trước khi call Doordash API
- Push campaign metrics vào Mi-Core daily

---

## 5. Những gì CEO sẽ cấp cho Dev

Trước khi bắt đầu dev, CEO sẽ cung cấp:

| Item | Dùng để |
|------|---------|
| `MI_CORE_IP` | IP của Mi-Core PC trên LAN/Tailscale |
| `MI_NOTIFY_KEY` | Gọi `/api/whatsapp/mi/notify` |
| `NODE_SECRET` | Auth Mi-Node-Agent với Mi-Core |
| Tailscale invite | Truy cập Mi-Core khi off-site |

---

## 6. Checklist trước khi bàn giao

Dev hoàn thành khi tất cả các điểm sau đều xanh:

- [ ] `GET /health` trả về JSON hợp lệ
- [ ] App tự register với Mi-Core khi start: `POST /api/nodes/register`
- [ ] App heartbeat mỗi 3 phút (integration-system)
- [ ] L2/L3 actions đi qua approval gate — không tự execute
- [ ] Không có hardcode secrets trong code (dùng `.env`)
- [ ] `.env` không commit vào git
- [ ] Mi-Node-Agent chạy được trên laptop (port 4100)
- [ ] `npm run build` và `npm start` chạy không lỗi

---

## 7. Test kết nối với Mi-Core

Dev có thể test ngay khi có `MI_CORE_IP`:

```bash
# 1. Health check Mi-Core
curl http://<MI_CORE_IP>:4001/api/health

# 2. Register node
curl -X POST http://<MI_CORE_IP>:4001/api/nodes/register \
  -H "Content-Type: application/json" \
  -d '{"node_id":"laptop1","port":4100,"platform":"win32","node_version":"v20.0.0"}'

# 3. Test approval gate
curl -X POST http://<MI_CORE_IP>:4001/api/approval/enqueue \
  -H "Content-Type: application/json" \
  -d '{"risk_level":1,"category":"read_file","description":"test read","target":"test"}'
```

---

## 8. Liên hệ & hỗ trợ

Mọi câu hỏi về API, approval flow, data format → liên hệ CEO trực tiếp qua WhatsApp.  
Không tự thay đổi schema BigData hoặc approval levels mà không xin phép trước.
