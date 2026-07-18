import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 8787);
const adbPath = process.env.ADB_PATH ?? "adb";
const adbSerial = process.env.ADB_SERIAL ?? "127.0.0.1:5555";
const requireAccessHeader = process.env.REQUIRE_ACCESS_HEADER === "true";
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

function adbArgs(...args) {
  return adbSerial ? ["-s", adbSerial, ...args] : args;
}

async function runAdb(args, options = {}) {
  const commandOptions = {
    timeout: 15_000,
    maxBuffer: 12 * 1024 * 1024,
    ...options,
  };

  try {
    return await execFileAsync(adbPath, adbArgs(...args), commandOptions);
  } catch (error) {
    if (!adbSerial.includes(":")) throw error;
    await execFileAsync(adbPath, ["connect", adbSerial], {
      timeout: 10_000,
      encoding: "utf8",
    });
    return execFileAsync(adbPath, adbArgs(...args), commandOptions);
  }
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32 * 1024) throw new Error("Request body too large");
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function isAuthorized(req) {
  if (!requireAccessHeader) return true;
  return Boolean(req.headers["cf-access-authenticated-user-email"]);
}

const server = http.createServer(async (req, res) => {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!isAuthorized(req)) {
    sendJson(res, 401, { ok: false, error: "Cloudflare Access required" });
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      const { stdout } = await runAdb(["get-state"], { encoding: "utf8" });
      sendJson(res, 200, {
        ok: stdout.trim() === "device",
        device: adbSerial,
        state: stdout.trim(),
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/screen") {
      const { stdout } = await runAdb(["exec-out", "screencap", "-p"], {
        encoding: null,
      });
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Content-Length": stdout.length,
      });
      res.end(stdout);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/input/tap") {
      const body = await readJson(req);
      const x = Number(body.x);
      const y = Number(body.y);
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x > 720 || y < 0 || y > 1280) {
        sendJson(res, 400, { ok: false, error: "Invalid coordinates" });
        return;
      }
      await runAdb(["shell", "input", "tap", String(x), String(y)]);
      sendJson(res, 200, { ok: true, x, y });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/input/swipe") {
      const body = await readJson(req);
      const values = [body.x1, body.y1, body.x2, body.y2, body.duration].map(Number);
      const [x1, y1, x2, y2, duration] = values;
      const coordinatesValid = values.slice(0, 4).every(Number.isInteger)
        && x1 >= 0 && x1 <= 720
        && x2 >= 0 && x2 <= 720
        && y1 >= 0 && y1 <= 1280
        && y2 >= 0 && y2 <= 1280;
      if (!coordinatesValid || !Number.isInteger(duration) || duration < 100 || duration > 1_000) {
        sendJson(res, 400, { ok: false, error: "Invalid swipe" });
        return;
      }
      await runAdb([
        "shell",
        "input",
        "swipe",
        String(x1),
        String(y1),
        String(x2),
        String(y2),
        String(duration),
      ]);
      sendJson(res, 200, { ok: true, x1, y1, x2, y2, duration });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/input/key") {
      const body = await readJson(req);
      const allowedKeys = new Set(["BACK", "HOME", "APP_SWITCH", "POWER"]);
      if (!allowedKeys.has(body.key)) {
        sendJson(res, 400, { ok: false, error: "Unsupported key" });
        return;
      }
      await runAdb(["shell", "input", "keyevent", body.key]);
      sendJson(res, 200, { ok: true, key: body.key });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/input/text") {
      const body = await readJson(req);
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (!text || text.length > 500) {
        sendJson(res, 400, { ok: false, error: "Text must contain 1–500 characters" });
        return;
      }
      const adbText = text.replaceAll("%", "%25").replaceAll(" ", "%s");
      await runAdb(["shell", "input", "text", adbText]);
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 404, { ok: false, error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown gateway error";
    sendJson(res, 503, { ok: false, error: message });
  }
});

server.listen(port, host, () => {
  console.log(`PocketDock gateway listening on http://${host}:${port}`);
  console.log(`ADB device: ${adbSerial}`);
});
