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
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const typingDockRef = useRef<HTMLFormElement>(null);
  const wheelDeltaRef = useRef(0);
  const wheelTimerRef = useRef<number | null>(null);
  const wheelPointRef = useRef({ x: 360, y: 640 });
  const swipeInFlightRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const suppressNextClickRef = useRef(false);

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

  useEffect(() => {
    document
      .querySelector('meta[name="viewport"]')
      ?.setAttribute(
        "content",
        "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
      );
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const keepTypingVisible = () => {
      if (document.activeElement !== textInputRef.current) return;
      window.requestAnimationFrame(() => {
        typingDockRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    };

    viewport.addEventListener("resize", keepTypingVisible);
    viewport.addEventListener("scroll", keepTypingVisible);
    return () => {
      viewport.removeEventListener("resize", keepTypingVisible);
      viewport.removeEventListener("scroll", keepTypingVisible);
    };
  }, []);

  useEffect(() => () => {
    if (wheelTimerRef.current !== null) {
      window.clearTimeout(wheelTimerRef.current);
    }
  }, []);

  const refreshScreenBurst = () => {
    [180, 500, 950].forEach((delay) => {
      window.setTimeout(
        () => setScreenVersion((version) => version + 1),
        delay,
      );
    });
  };

  const handleScreenClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - bounds.left) / bounds.width) * 720);
    const y = Math.round(((event.clientY - bounds.top) / bounds.height) * 1280);
    setLastTap({ x, y });
    setNotice(`แตะตำแหน่ง ${x}, ${y}`);
    await sendCommand("/api/input/tap", { x, y });
    refreshScreenBurst();
  };

  const sendScreenSwipe = async (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    label: string,
  ) => {
    if (swipeInFlightRef.current) return;
    swipeInFlightRef.current = true;
    setNotice(label);
    await sendCommand("/api/input/swipe", {
      x1: Math.round(Math.max(0, Math.min(720, x1))),
      y1: Math.round(Math.max(0, Math.min(1280, y1))),
      x2: Math.round(Math.max(0, Math.min(720, x2))),
      y2: Math.round(Math.max(0, Math.min(1280, y2))),
      duration: 280,
    });
    refreshScreenBurst();
    swipeInFlightRef.current = false;
  };

  const handleScreenWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    wheelPointRef.current = {
      x: ((event.clientX - bounds.left) / bounds.width) * 720,
      y: ((event.clientY - bounds.top) / bounds.height) * 1280,
    };
    wheelDeltaRef.current += event.deltaY;

    if (wheelTimerRef.current !== null) {
      window.clearTimeout(wheelTimerRef.current);
    }

    wheelTimerRef.current = window.setTimeout(async () => {
      const delta = wheelDeltaRef.current;
      wheelDeltaRef.current = 0;
      wheelTimerRef.current = null;
      if (Math.abs(delta) < 8 || swipeInFlightRef.current) return;

      const scrollDown = delta > 0;
      const { x, y } = wheelPointRef.current;
      const distance = Math.max(280, Math.min(520, Math.abs(delta) * 1.4));
      await sendScreenSwipe(
        x,
        y + (scrollDown ? distance / 2 : -distance / 2),
        x,
        y + (scrollDown ? -distance / 2 : distance / 2),
        scrollDown ? "เลื่อนหน้าจอลง" : "เลื่อนหน้าจอขึ้น",
      );
    }, 70);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerStartRef.current = {
      x: ((event.clientX - bounds.left) / bounds.width) * 720,
      y: ((event.clientY - bounds.top) / bounds.height) * 1280,
      pointerId: event.pointerId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const end = {
      x: ((event.clientX - bounds.left) / bounds.width) * 720,
      y: ((event.clientY - bounds.top) / bounds.height) * 1280,
    };
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    if (distance < 35) return;
    suppressNextClickRef.current = true;
    void sendScreenSwipe(
      start.x,
      start.y,
      end.x,
      end.y,
      end.y < start.y ? "ลากหน้าจอขึ้น" : "ลากหน้าจอลง",
    );
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
              <Resource label="CPU" value="1 core" fill={50} />
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
                onWheel={handleScreenWheel}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerCancel={() => { pointerStartRef.current = null; }}
                role="application"
                aria-label="คลิกเพื่อควบคุม และใช้ล้อเมาส์เลื่อนหน้าจอ Android"
                title="ใช้ล้อเมาส์เลื่อนขึ้นหรือลง"
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
              <p className="scroll-help">↕ หมุนล้อเมาส์ หรือลากบนจอเพื่อเลื่อน</p>
            </div>

            <form
              className="text-command typing-dock"
              onSubmit={handleText}
              ref={typingDockRef}
            >
              <div className="typing-title">
                <span aria-hidden="true">⌨</span>
                <div>
                  <label htmlFor="android-text">พิมพ์เข้าเครื่องนี้</label>
                  <p>แตะช่องในจอ Android ก่อน แล้วพิมพ์ตรงนี้</p>
                </div>
              </div>
              <textarea
                id="android-text"
                ref={textInputRef}
                value={commandText}
                onChange={(event) => setCommandText(event.target.value)}
                onFocus={() => {
                  window.setTimeout(() => {
                    typingDockRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }, 250);
                }}
                placeholder="แคปชัน หรือลิงก์สินค้า..."
                rows={2}
                enterKeyHint="send"
              />
              <button className="primary-button" type="submit">
                ส่งข้อความ
                <span aria-hidden="true">→</span>
              </button>
            </form>
          </div>
        </section>

        <aside className="control-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">QUICK CONTROL</p>
              <h2>ส่งคำสั่ง</h2>
            </div>
          </div>

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
