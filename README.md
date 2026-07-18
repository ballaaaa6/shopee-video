# PocketDock

หน้าเว็บควบคุม Android บน Oracle Cloud สำหรับงานอัปโหลดวิดีโอแบบใช้คนควบคุมก่อน แล้วค่อยต่อระบบจัดคิวและ automation หลังผ่านการทดสอบกับแอปจริง

## โครงสร้าง

- `apps/web` — หน้า dashboard สำหรับ Cloudflare
- `apps/gateway` — API บน Oracle ที่รับภาพหน้าจอและส่งคำสั่ง ADB
- `infra/oracle` — ไฟล์ติดตั้ง service บน Ubuntu

## เปิดหน้าเว็บในเครื่อง

```powershell
cd "apps\web"
$env:WRANGLER_LOG_PATH=".wrangler/wrangler.log"
npx vinext dev
```

เปิด `http://localhost:3000` หน้าเว็บจะแสดงโหมดตัวอย่างจนกว่าจะกำหนด `NEXT_PUBLIC_GATEWAY_URL`

## ตั้งค่า gateway URL

สร้าง `apps/web/.env.local`:

```env
NEXT_PUBLIC_GATEWAY_URL=https://android-api.example.com
```

ห้ามเปิด ADB หรือ gateway port สู่ public internet โดยตรง ระบบจริงควรเข้าผ่าน Cloudflare Tunnel และล็อกด้วย Cloudflare Access

## ตรวจโค้ด

```powershell
cd "apps\web"
$env:WRANGLER_LOG_PATH=".wrangler/wrangler.log"
npx vinext build

cd "..\gateway"
npm run check
```

