"""Start the SumTalk server (API + built web app).

    python run.py                    http://localhost:8000
    python run.py --reload           auto-reload while developing the backend
    python run.py --https --lan      https://<your-LAN-IP>:8443 - open it on a phone on the same Wi-Fi.
                                     Browsers only allow the microphone on https (or localhost), so a
                                     self-signed certificate is created; accept the warning on the phone.
    python run.py --parent-watch     used by the desktop app (desktop/): stop when it closes our stdin.

This file is also the entry point of the packaged desktop backend (sumtalk-server.exe, PyInstaller).
"""

import argparse
import datetime
import ipaddress
import multiprocessing
import os
import socket
import sys
import threading
from pathlib import Path

import uvicorn

FROZEN = bool(getattr(sys, "frozen", False))
BACKEND_DIR = Path(__file__).resolve().parent
if not FROZEN and str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def lan_addresses() -> list[str]:
    found = set()
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))  # no packet is sent; picks the interface used for the internet
            found.add(s.getsockname()[0])
    except OSError:
        pass
    try:
        found.update(info[4][0] for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET))
    except OSError:
        pass
    return sorted(ip for ip in found if not ip.startswith("127."))


def ensure_certificate(folder: Path) -> tuple[Path, Path]:
    cert_path, key_path = folder / "cert.pem", folder / "key.pem"
    if cert_path.exists() and key_path.exists():
        return cert_path, key_path

    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.x509.oid import NameOID

    key = ec.generate_private_key(ec.SECP256R1())
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "SumTalk local")])
    hosts = [x509.DNSName("localhost"), x509.DNSName(socket.gethostname())]
    ips = [x509.IPAddress(ipaddress.ip_address(ip)) for ip in ["127.0.0.1", *lan_addresses()]]
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=365))
        .add_extension(x509.SubjectAlternativeName(hosts + ips), critical=False)
        .sign(key, hashes.SHA256())
    )
    folder.mkdir(parents=True, exist_ok=True)
    key_path.write_bytes(
        key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    )
    cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    return cert_path, key_path


def watch_parent(server: uvicorn.Server) -> None:
    """The desktop app keeps our stdin open and never writes to it. End of input means it quit or
    crashed: shut down cleanly instead of being left running in the background."""
    stdin = sys.stdin.buffer if sys.stdin else None
    if stdin is None:
        print("--parent-watch: no stdin, cannot watch the desktop app", file=sys.stderr, flush=True)
        return

    def wait_for_eof() -> None:
        try:
            stdin.read()
        except (OSError, ValueError):
            pass
        print("Desktop app closed - shutting down", flush=True)
        server.should_exit = True
        # Safety net if the graceful shutdown hangs (daemon: does not delay a normal exit).
        timer = threading.Timer(10.0, lambda: os._exit(0))
        timer.daemon = True
        timer.start()

    threading.Thread(target=wait_for_eof, name="parent-watch", daemon=True).start()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the SumTalk server")
    parser.add_argument("--lan", action="store_true", help="listen on all interfaces (other devices on the network)")
    parser.add_argument("--https", action="store_true", help="serve over https with a self-signed certificate")
    parser.add_argument("--port", type=int, default=None, help="default 8000 (http) / 8443 (https)")
    parser.add_argument("--reload", action="store_true", help="restart when backend code changes")
    parser.add_argument("--parent-watch", action="store_true", help="exit when stdin closes (desktop app)")
    args = parser.parse_args()

    if args.parent_watch:
        # Output goes to the desktop app's log file through a pipe: UTF-8, one line at a time.
        for stream in (sys.stdout, sys.stderr):
            if stream is not None and hasattr(stream, "reconfigure"):
                stream.reconfigure(encoding="utf-8", errors="backslashreplace", line_buffering=True)

    from app.config import get_settings

    host = "0.0.0.0" if args.lan else "127.0.0.1"
    port = args.port or (8443 if args.https else 8000)
    scheme = "https" if args.https else "http"
    ssl = {}
    if args.https:
        cert, key = ensure_certificate(get_settings().data_dir / "certs")
        ssl = {"ssl_certfile": str(cert), "ssl_keyfile": str(key)}

    print(f"\n  SumTalk  ->  {scheme}://localhost:{port}", flush=True)
    if args.lan:
        for ip in lan_addresses():
            print(f"  On your network  ->  {scheme}://{ip}:{port}", flush=True)
    print(flush=True)

    if args.reload and not FROZEN:
        uvicorn.run(
            "app.main:app",
            host=host,
            port=port,
            reload=True,
            reload_dirs=[str(BACKEND_DIR / "app")],
            app_dir=str(BACKEND_DIR),
            **ssl,
        )
        return

    from app.main import app  # imported directly (not "app.main:app") so PyInstaller bundles it

    server = uvicorn.Server(uvicorn.Config(app, host=host, port=port, **ssl))
    if args.parent_watch:
        watch_parent(server)
    server.run()


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
