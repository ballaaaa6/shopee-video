# PocketDock Web

หน้า dashboard สำหรับดูหน้าจอ Android และส่ง touch, key และ text commands ไปยัง PocketDock Gateway บน Oracle Cloud

## Development

```bash
npm install
npm run dev
```

ถ้าไม่ได้กำหนด `NEXT_PUBLIC_GATEWAY_URL` หน้าเว็บจะทำงานในโหมดตัวอย่าง

## Cloudflare

โปรเจกต์ใช้ vinext และ Cloudflare Workers:

```bash
npm run build
npm run deploy
```

สำหรับ Git integration ให้ตั้ง Root directory เป็น `apps/web`, Build command เป็น `npm run build` และ Deploy command เป็น `npm run deploy`

