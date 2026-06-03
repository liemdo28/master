# Prompt gửi Dev (paste vào chat / Telegram / email)

> Copy phần dưới đường kẻ và paste cho Dev. Đính kèm đủ 8 files theo structure này:
>
> - `01-CEO_BRIEF.md`
> - `02-CONTROL_PLANE_SPEC.md`
> - 3 template reports trong thư mục `templates/`
> - 2 acceptance scripts trong thư mục `acceptance/`

---

Chào team,

Sau khi đọc kỹ status report bạn gửi, mình đang pivot. Không phải pivot tham vọng — pivot **trọng tâm**.

Hệ thống hiện tại:
- Hiểu source code: 35% xong, đang đi đúng hướng
- Điều khiển PC từ laptop: **0–10%, chưa chứng minh**
- Điều khiển Cline/Antigravity: **0–5%, chưa verify**
- Chat CEO: **0%**

Mình không cần thêm Knowledge Graph, DNA, Dependency Engine cho 26 projects. **Mình cần điều khiển được máy PC từ laptop ngay.**

## Đường dây phải chạy được

```
Laptop của mình  →  Agent OS (Control Plane)  →  PC Worker  →  Cline/Antigravity  →  Code thật, terminal thật
```

Khi mình ngồi ở Las Vegas, gõ `agentctl exec audit E:\Project\Master` và nhận được kết quả từ PC, mới gọi là Agent OS sống. Bây giờ chưa.

## Yêu cầu cụ thể

Đính kèm đủ 7 files support bên cạnh prompt này. Đọc theo thứ tự:

1. **`01-CEO_BRIEF.md`** — đọc đầu tiên. Pivot này là gì, deadlines, deliverables D1-D6.
2. **`02-CONTROL_PLANE_SPEC.md`** — kiến trúc Laptop↔Worker đề xuất. Có thể đề xuất khác nếu có lý do tốt — viết ra trong report.
3. **`templates/CLINE_ANTIGRAVITY_CAPABILITY_REPORT.md`** — fill in, deadline 3 ngày.
4. **`templates/WORKER_CONNECTIVITY_REPORT.md`** — fill in, deadline 3 ngày.
5. **`templates/CONTROL_PLANE_CONNECTIVITY_REPORT.md`** — fill in, deadline 3 ngày.
6. **`acceptance/verify-D2-ping-pong.sh`** + `verify-D3-to-D6.sh` — đây là các script mình **sẽ chạy** để accept deliverable. Đừng claim "xong D3" cho đến khi `verify-D3-to-D6.sh --skip-to D3` trả về exit code 0 trên máy mình.

Acceptance nghĩa là script chạy được trên máy mình. Không phải Dev tự claim "xong".

## 6 deliverables với deadlines cứng

| # | Deliverable | Deadline | Acceptance |
|---|---|---|---|
| D1 | 3 capability reports | 3 ngày | filed vào repo |
| D2 | Ping/pong qua wire | 7 ngày | `verify-D2-ping-pong.sh` pass |
| D3 | Open Antigravity từ laptop | 10 ngày | `verify-D3-to-D6.sh --skip-to D3` pass |
| D4 | Start API Proxy từ laptop | 12 ngày | D4 trong script pass |
| D5 | Audit E:\Project\Master | 18 ngày | D5 pass, report fetch về laptop được |
| D6 | Inject prompt vào Cline | 25 ngày | D6 pass, stream output về laptop được |

## Các quy tắc làm việc

1. **Mỗi ngày 1 dòng status** trong channel: `D<N> — <state> — <next>`. Không cần dài.
2. **Mỗi 3 ngày 1 update dài hơn** — học được gì, blocker gì, 3 ngày tới làm gì.
3. **Claim deliverable done thì kèm:** (a) output của acceptance script, (b) screencast 60 giây thao tác thật.
4. **Slip deadline phải báo trước 48h.** Không phải lúc deadline tới mới nói.
5. **Disagree với pivot này** — nói thẳng, viết ra, mình lắng nghe. Sau hôm nay "tôi không đồng ý từ đầu" không phải lý do hợp lệ cho việc trễ deadline.

## Checks 7 câu mình cần trả lời thẳng

Trong `CLINE_ANTIGRAVITY_CAPABILITY_REPORT.md`. Nếu câu nào "không biết" — OK, viết `KNOWN_UNKNOWN` + plan tìm hiểu. Không đoán.

1. Antigravity nằm ở đâu? Đường dẫn cụ thể trên PC.
2. Cline có API/CLI/headless không?
3. Có inject prompt vào Cline được không? Cơ chế gì?
4. Có đọc được output của Cline không? Như nào?
5. Có stream log real-time được không? Latency bao nhiêu?
6. Worker có chạy được `E:\Project\Master\Agent\agent-coding-api-keys\start-proxy-win.bat` không?
7. Laptop tạo task → PC nhận → execute → trả kết quả: dùng transport gì? Auth gì? Reliability ra sao?

## Phạm vi hủy

Tạm dừng ngay (resume sau khi D6 xong):

- ❌ Project DNA cho 26 projects
- ❌ Dependency Engine
- ❌ Knowledge Graph data
- ❌ CEO Search
- ❌ Bất kỳ module/architecture mới nào

Tiếp tục những thứ đã có nhưng **không thêm scope**.

## Tại sao

Master Intelligence Layer của các bạn là engineering tốt. Index được 9002 files / 26 projects là đáng nể. Nhưng nó **không giúp mình chạy business**. Hiện tại mình có bộ não nhưng không có **tay chân**. Mình cần tay chân trước. Có tay chân rồi não mới có việc làm.

Xây tay chân. Sau đó quay lại làm não thông minh hơn.

Có gì bí — gọi mình trước, đừng đợi đến deadline.

— Hoang
