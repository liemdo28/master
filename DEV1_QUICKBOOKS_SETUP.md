# DEV1 TASK — QuickBooks Connector Setup
**Priority:** P0 — Finance data blocked  
**Estimated time:** 2-3 hours  
**Assigned:** Dev1  

---

## Context

Mi-Core cần kết nối QuickBooks Desktop để lấy data tài chính (P&L, tax, payroll).  
QuickBooks chạy trên `laptop1`. Mi-Core server chạy trên `mi-core-primary` (Windows PC).  
Kết nối qua **QuickBooks Web Connector** (QBWC) — agent local trên laptop1 push data về mi-core.

---

## Step 1 — Cài QB Web Connector trên laptop1

1. Download: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started/get-started-with-qbdesktop/download-the-qb-web-connector
2. Cài vào Windows (laptop1), chạy cùng QuickBooks Desktop

---

## Step 2 — Tạo file `.qwc` cho mi-core

Tạo file `mi-core-connector.qwc` với nội dung sau (thay `<LAPTOP1_IP>` bằng IP thật của laptop1 trên mạng nội bộ hoặc Tailscale IP):

```xml
<?xml version="1.0"?>
<QBWCXML>
  <AppName>Mi-Core Financial Connector</AppName>
  <AppID>mi-core-qb-001</AppID>
  <AppURL>http://<LAPTOP1_IP>:3456/api/qb/webhook</AppURL>
  <AppDescription>Mi CEO OS - QuickBooks data sync</AppDescription>
  <AppSupport>http://<LAPTOP1_IP>:3456</AppSupport>
  <UserName>mi-admin</UserName>
  <OwnerID>{8A2D4F9E-1B3C-4D5E-8F6A-7B2C3D4E5F6A}</OwnerID>
  <FileID>{1A2B3C4D-5E6F-7A8B-9C0D-1E2F3A4B5C6D}</FileID>
  <QBType>QBFS</QBType>
  <Scheduler>
    <RunEveryNMinutes>360</RunEveryNMinutes>
  </Scheduler>
</QBWCXML>
```

---

## Step 3 — Start QB Ops Agent trên laptop1

```bash
# Clone/copy the qb-ops-agent từ mi-core
cd E:/Project/Master/mi-core/services/qb-ops-agent

# Set env vars
cp .env.example .env
# Edit .env:
#   AGENT_OS_API_URL=http://<mi-core-ip>:4001
#   QB_API_KEY=<generate a random 32-char string>
#   PORT=3456

npm install
node src/index.js
```

---

## Step 4 — Load .qwc vào QuickBooks Web Connector

1. Mở QuickBooks Desktop → mở company file
2. Mở QB Web Connector → click "Add an Application"
3. Chọn file `mi-core-connector.qwc`
4. Nhập password khi hỏi (dùng `QB_API_KEY` từ .env)
5. Check "Auto-Run" → set schedule 6 hours

---

## Step 5 — Add env var vào mi-core

Thêm vào `E:/Project/Master/mi-core/.env` (tạo nếu chưa có):

```bash
QB_AGENT_URL=http://<laptop1-ip>:3456
QB_API_KEY=<same key as above>
```

Rồi `pm2 restart mi-core`.

---

## Step 6 — Test

```bash
# Từ mi-core-primary, test kết nối
curl http://127.0.0.1:4001/api/connectors/quickbooks/status

# Kết quả mong đợi:
# { "connected": true, "last_sync": "...", "data_available": true }
```

---

## Handoff checklist

- [ ] QB Web Connector installed on laptop1
- [ ] `.qwc` file created with correct IP
- [ ] `qb-ops-agent` running on port 3456 on laptop1
- [ ] `.qwc` loaded into QBWC + password set + auto-run ON
- [ ] `QB_AGENT_URL` + `QB_API_KEY` added to mi-core .env
- [ ] `pm2 restart mi-core`
- [ ] `GET /api/connectors/quickbooks/status` returns `connected: true`
- [ ] Ping @liem khi done

---

## Nếu gặp lỗi

| Lỗi | Fix |
|-----|-----|
| QBWC can't connect to AppURL | Kiểm tra firewall laptop1 port 3456 |
| "Application not certified" | Bỏ qua, click Continue |
| QB agent offline sau reboot | `pm2 startup` trên laptop1 |
| IP thay đổi | Dùng Tailscale hostname thay IP |
