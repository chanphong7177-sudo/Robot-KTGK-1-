"""
Chạy website VELA D1 trên máy.

    python chay_web.py          (hoặc nhấp đúp chay_web.bat)

Tự tìm một port còn trống (bắt đầu từ 8765), chỉ mở cho máy này (127.0.0.1),
rồi mở trình duyệt. Nhấn Ctrl+C hoặc đóng cửa sổ để tắt.
"""
import functools
import http.server
import os
import socket
import sys
import threading
import webbrowser

HOST = "127.0.0.1"
FIRST_PORT = 8765
ROOT = os.path.dirname(os.path.abspath(__file__))


def port_is_free(port):
    """Port phải trống trên cả IPv4 và IPv6, nếu không trình duyệt có thể gặp nhầm chương trình khác."""
    for family, addr in ((socket.AF_INET, "127.0.0.1"), (socket.AF_INET6, "::1")):
        with socket.socket(family, socket.SOCK_STREAM) as s:
            s.settimeout(0.3)
            if s.connect_ex((addr, port)) == 0:      # đã có chương trình nghe ở port này
                return False
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind((HOST, port))
        return True
    except OSError:
        return False


def find_port():
    for port in range(FIRST_PORT, FIRST_PORT + 100):
        if port_is_free(port):
            return port
    raise SystemExit("Không tìm được port trống từ %d đến %d." % (FIRST_PORT, FIRST_PORT + 99))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".py": "text/plain; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")   # sửa file xong chỉ cần F5
        super().end_headers()

    def log_message(self, fmt, *args):
        pass                                             # giữ cửa sổ gọn


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    port = find_port()
    url = "http://%s:%d/index.html" % (HOST, port)
    server = http.server.ThreadingHTTPServer((HOST, port), functools.partial(Handler, directory=ROOT))
    print("GUGUGAGAA:", url)
    print("Đóng cửa sổ này hoặc nhấn Ctrl+C để tắt.")
    threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nĐã tắt máy chủ.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
