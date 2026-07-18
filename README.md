# PocketDock

หน้าเว็บควบคุม Android บน Oracle Cloud สำหรับงานอัปโหลดวิดีโอแบบใช้คนควบคุมก่อน แล้วค่อยต่อระบบจัดคิวและ automation หลังผ่านการทดสอบกับแอปจริง

## โครงสร้าง

- `apps/web` — หน้า dashboard สำหรับ Cloudflare
- `apps/gateway` — API บน Oracle ที่รับภาพหน้าจอและส่งคำสั่ง ADB
- `infra/oracle` — ไฟล์ติดตั้ง service บน Ubuntu

Android ตัวทดลองใช้ ReDroid Android 12 แบบ ARM64-only ที่ 720×1280, 15 FPS,
RAM สูงสุด 2 GB และ CPU สูงสุด 1 คอร์ โดย ADB ถูกผูกไว้กับ localhost เท่านั้น

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

## เริ่ม Android บน Oracle

หลังติดตั้ง Docker, ADB และ `linux-modules-extra-$(uname -r)` แล้ว:

```bash
sudo modprobe binder_linux devices=binder,hwbinder,vndbinder
bash infra/oracle/run-redroid.sh
adb connect 127.0.0.1:5555
```

## ตรวจโค้ด

```powershell
cd "apps\web"
$env:WRANGLER_LOG_PATH=".wrangler/wrangler.log"
npx vinext build

cd "..\gateway"
npm run check
```

## การยกช่องกรอกเหนือคีย์บอร์ด Android

Oracle เครื่องปัจจุบันใช้ Frida Server 17.16.0 แบบ ARM64 และ
`pocketdock-soft-input.service` เพื่อบังคับ Aurora Store กับ Shopee ให้ใช้
`SOFT_INPUT_ADJUST_RESIZE` ขณะคีย์บอร์ดเปิด ไฟล์ service และตัวเฝ้ากระบวนการอยู่ที่
`infra/oracle/` ติดตั้งซ้ำได้จาก root ของ repository ด้วย:

```bash
bash infra/oracle/install-soft-input.sh
```

หลังติดตั้งบนเซิร์ฟเวอร์แล้วตรวจสถานะด้วย:

```bash
sudo systemctl status pocketdock-soft-input.service
```
