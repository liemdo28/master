# OpenClaw Personal

OpenClaw Personal la mot app nho de ban tu dung AI cho ca nhan ma khong can backend rieng.

## Co gi ben trong

- Chat UI theo kieu "personal cockpit"
- Luu local trong trinh duyet: profile, ghi chu, prompt presets, lich su chat
- Ho tro endpoint OpenAI-compatible (`/v1/chat/completions`)
- Export / import du lieu JSON
- Chay bang Node thuong, khong can cai them package

## Chay local

```bash
cd "E:\Project\Personal\openclaw"
npm run dev
```

Mo `http://127.0.0.1:4173`.

## Cach dung

1. Dien `API endpoint`, `API key`, `model`
2. Bat hoac tat `Stream response` theo provider ban dung
3. Chinh `system prompt` neu muon
4. Luu ghi chu va prompt presets trong giao dien
5. Chat o khung ben phai
6. Neu can backup, bam `Export workspace`

## Luu y

- App nay danh cho dung ca nhan.
- API key duoc luu trong `localStorage` tren may cua ban, nen khong phu hop cho deploy public.
- Hien tai app gui request theo dinh dang chat completions. Neu ban dung provider khac, hay dat endpoint tuong thich.
