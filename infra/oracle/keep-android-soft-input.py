#!/usr/bin/env python3
import signal
import subprocess
import time

ADB = ["adb", "-s", "127.0.0.1:5555"]
PACKAGES = ("com.aurora.store", "com.shopee.th")
FRIDA = "/opt/pocketdock/frida/venv/bin/frida"
SCRIPT = "/opt/pocketdock/frida/android-soft-input.js"
sessions: dict[str, tuple[int, subprocess.Popen[str]]] = {}
running = True
server_ready = False


def stop(*_: object) -> None:
    global running
    running = False


def adb(*args: str) -> str:
    return subprocess.run(
        [*ADB, *args],
        check=False,
        capture_output=True,
        text=True,
        timeout=15,
    ).stdout.strip()


def ensure_server() -> None:
    global server_ready
    if server_ready:
        return
    if "uid=0(root)" not in adb("shell", "id"):
        adb("root")
        time.sleep(2)
    adb("shell", "pkill", "-f", "/data/local/tmp/frida-server")
    launcher = subprocess.Popen(
        [*ADB, "shell", "/data/local/tmp/frida-server", "-D"],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(2)
    launcher.terminate()
    server_ready = True


def current_pid(package: str) -> int | None:
    value = adb("shell", "pidof", package).split()
    return int(value[0]) if value and value[0].isdigit() else None


def attach(package: str, pid: int) -> None:
    process = subprocess.Popen(
        [
            FRIDA,
            "-D",
            "127.0.0.1:5555",
            "-p",
            str(pid),
            "-l",
            SCRIPT,
            "--eternalize",
            "-q",
        ],
        stdin=subprocess.DEVNULL,
        text=True,
    )
    sessions[package] = (pid, process)
    print(f"keyboard-safe mode attached to {package} ({pid})", flush=True)


signal.signal(signal.SIGINT, stop)
signal.signal(signal.SIGTERM, stop)

while running:
    try:
        ensure_server()
        for package in PACKAGES:
            pid = current_pid(package)
            attached = sessions.get(package)
            failed = (
                attached
                and attached[1].poll() is not None
                and attached[1].returncode != 0
            )
            if attached and (attached[0] != pid or failed):
                if attached[1].poll() is None:
                    attached[1].terminate()
                sessions.pop(package, None)
            if pid and package not in sessions:
                attach(package, pid)
    except Exception as error:
        print(f"soft-input watcher retrying: {error}", flush=True)
    time.sleep(2)

for _, process in sessions.values():
    process.terminate()
