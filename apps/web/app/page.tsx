"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ConnectionState = "connecting" | "online" | "offline" | "demo";

const GATEWAY_URL = (process.env.NEXT_PUBLIC_GATEWAY_URL ?? "").replace(/\/$/, "");

const deviceKeys = [
  { label: "ย้อนกลับ", key: "BACK", symbol: "‹" },
  { label: "หน้าหลัก", key: "HOME", symbol: "●" },
  { label: "แอปล่าสุด", key: "APP_SWITCH", symbol: "▢" },
];

export default function Home() {
  const [connection, setConnection] = useState<ConnectionState>(
    GATEWAY_URL ? "connecting" : "demo",
  );
  const [screenVersion, setScreenVersion] = useState(0);
  const [commandText, setCommandText] = useState("");
  const [lastTap, setLastTap] = useState<{ x: number; y: number } | null>(null);
  const [notice, setNotice] = useState(
    GATEWAY_URL
      ? "กำลังเชื่อมต่อ Android บน Oracle"
      : "โหมดตัวอย่าง — รอเชื่อม Android บน Oracle",
  );
  const screenRef = useRef<HTMLDivElement>(null);

  const screenUrl = useMemo(
    () => (GATEWAY_URL ? `${GATEWAY_URL}/api/screen?v=${screenVersion}` : ""),
    [screenVersion],
  );

  const sendCommand = useCallback(async (path: string, body: object) => {
    if (!GATEWAY_URL) {
      setNotice("รับคำสั่งแล้ว — จะส่งเข้า Android เมื่อ gateway ออนไลน์");
      return false;
    }

    try {
      const response = await fetch(`${GATEWAY_URL}${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`Gateway returned ${response.status}`);
      setConnection("online");
      return true;
    } catch {
      setConnection("offline");
      setNotice("ส่งคำสั่งไม่สำเร็จ — ตรวจการเชื่อมต่อ Oracle");
      return false;
    }
  }, []);

  useEffect(() => {
    if (!GATEWAY_URL) return;

    const checkHealth = async () => {
      try {
        const response = await fetch(`${GATEWAY_URL}/health`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Gateway unavailable");
        setConnection("online");
        setNotice("Android พร้อมรับคำสั่ง");
      } catch {
        setConnection("offline");
        setNotice("ยังเชื่อมต่อ Android ไม่ได้");
      }
    };

    void checkHealth();
    const healthTimer = window.setInterval(checkHealth, 10_000);
    const screenTimer = window.setInterval(
      () => setScreenVersion((version) => version + 1),
      3_000,
    );

    return () => {
      window.clearInterval(healthTimer);
      window.clearInterval(screenTimer);
    };
  }, []);

  const handleScreenClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - bounds.left) / bounds.width) * 720);
    const y = Math.round(((event.clientY - bounds.top) / bounds.height) * 1280);
    setLastTap({ x, y });
    setNotice(`แตะตำแหน่ง ${x}, ${y}`);
    await sendCommand("/api/input/tap", { x, y });
  };

  const handleKey = async (key: string) => {
    setNotice(`ส่งปุ่ม ${key}`);
    await sendCommand("/api/input/key", { key });
  };

  const handleText = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = commandText.trim();
    if (!text) return;
    const sent = await sendCommand("/api/input/text", { text });
    if (sent || !GATEWAY_URL) setCommandText("");
    setNotice("ส่งข้อความเข้า Android แล้ว");
  };

  const statusLabel = {
    connecting: "กำลังเชื่อมต่อ",
    online: "ออนไลน์",
    offline: "ออฟไลน์",
    demo: "โหมดตัวอย่าง",
  }[connection];

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">P</div>
          <div>
            <p className="eyebrow">ORACLE ANDROID CONTROL</p>
            <h1>PocketDock</h1>
          </div>
        </div>
        <div className={`connection-pill ${connection}`}>
          <span className="status-dot" aria-hidden="true" />
          {statusLabel}
        </div>
      </header>

      <section className="workspace">
        <aside className="device-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">DEVICE 01</p>
              <h2>Android สำหรับอัปโหลด</h2>
            </div>
            <button className="icon-button" type="button" aria-label="รีเฟรชหน้าจอ" onClick={() => setScreenVersion((v) => v + 1)}>
              ↻
            </button>
          </div>

          <div className="device-card">
            <div className="device-meta">
              <span>Android 12 · ARM64</span>
              <span>720 × 1280 · 15 FPS</span>
            </div>
            <div className="resource-row">
              <Resource label="CPU" value="0.5 core" fill={25} />
              <Resource label="RAM" value="2 GB" fill={30} />
              <Resource label="Disk" value="24 GB" fill={28} />
            </div>
          </div>

          <div className="activity-card">
            <div className="activity-icon" aria-hidden="true">↑</div>
            <div>
              <strong>ระบบอัปโหลด</strong>
              <p>พร้อมทดสอบหนึ่งงานต่อครั้ง</p>
            </div>
            <span className="activity-state">เตรียมพร้อม</span>
          </div>

          <div className="notice-card">
            <p className="eyebrow">สถานะล่าสุด</p>
            <p>{notice}</p>
          </div>
        </aside>

        <section className="viewer-panel" aria-label="หน้าจอ Android">
          <div className="phone-wrap">
            <div className="phone-frame">
              <div className="phone-speaker" aria-hidden="true" />
              <div
                className="phone-screen"
                ref={screenRef}
                onClick={handleScreenClick}
                role="application"
                aria-label="คลิกเพื่อควบคุมหน้าจอ Android"
                data-testid="phone-screen"
              >
                {GATEWAY_URL ? (
                  <img
                    className="live-screen"
                    src={screenUrl}
                    alt="หน้าจอ Android จาก Oracle"
                    draggable={false}
                    onLoad={() => setConnection("online")}
                    onError={() => setConnection("offline")}
                  />
                ) : (
                  <DemoPhoneScreen />
                )}
                {lastTap && (
                  <span
                    className="tap-marker"
                    style={{
                      left: `${(lastTap.x / 720) * 100}%`,
                      top: `${(lastTap.y / 1280) * 100}%`,
                    }}
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="device-controls" aria-label="ปุ่มควบคุม Android">
                {deviceKeys.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleKey(item.key)}
                    aria-label={item.label}
                  >
                    {item.symbol}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <aside className="control-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">QUICK CONTROL</p>
              <h2>ส่งคำสั่ง</h2>
            </div>
          </div>

          <form className="text-command" onSubmit={handleText}>
            <label htmlFor="android-text">พิมพ์ข้อความเข้า Android</label>
            <textarea
              id="android-text"
              value={commandText}
              onChange={(event) => setCommandText(event.target.value)}
              placeholder="แคปชัน หรือลิงก์สินค้า..."
              rows={4}
            />
            <button className="primary-button" type="submit">
              ส่งข้อความ
              <span aria-hidden="true">→</span>
            </button>
          </form>

          <div className="queue-card">
            <div className="card-title-row">
              <h3>คิวงาน</h3>
              <span>0 งาน</span>
            </div>
            <div className="empty-queue">
              <div aria-hidden="true">＋</div>
              <strong>ยังไม่มีวิดีโอในคิว</strong>
              <p>ระบบจัดคิวจะเพิ่มหลังทดสอบอัปโหลดผ่าน</p>
            </div>
          </div>

          <div className="safety-note">
            <span aria-hidden="true">●</span>
            <p>หน้า Control จะถูกล็อกด้วย Cloudflare Access ก่อนเปิดใช้งานจริง</p>
          </div>
        </aside>
      </section>
    </main>
  );
}

function Resource({
  label,
  value,
  fill,
}: {
  label: string;
  value: string;
  fill: number;
}) {
  return (
    <div className="resource">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="meter" aria-hidden="true">
        <span style={{ width: `${fill}%` }} />
      </div>
    </div>
  );
}

function DemoPhoneScreen() {
  return (
    <div className="demo-phone">
      <div className="android-status">
        <span>17:48</span>
        <span>◒  5G  ▰</span>
      </div>
      <div className="demo-appbar">
        <button type="button" tabIndex={-1}>‹</button>
        <strong>สร้างวิดีโอ</strong>
        <span />
      </div>
      <div className="demo-body">
        <div className="video-placeholder">
          <span>▶</span>
          <p>ตัวอย่างหน้าจอ Android</p>
        </div>
        <div className="demo-field">
          <span>คำบรรยายวิดีโอ</span>
          <p>เพิ่มแคปชันของคุณ...</p>
        </div>
        <div className="demo-field compact">
          <span>ลิงก์สินค้า</span>
          <strong>＋ เพิ่มสินค้า</strong>
        </div>
        <button className="demo-submit" type="button" tabIndex={-1}>
          โพสต์วิดีโอ
        </button>
      </div>
    </div>
  );
}
