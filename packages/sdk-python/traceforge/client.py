import os
import traceback
import requests
import threading
import sys

_config = {}
_setup_handshake_sent = False

def init(api_key: str = None, endpoint: str = None, auto_capture: bool = True):
    api_key = api_key or os.environ.get("TRACEFORGE_API_KEY")
    endpoint = endpoint or os.environ.get("TRACEFORGE_INGEST_URL", "http://localhost:3001/ingest")

    if not api_key:
        raise ValueError("TraceForge.init() failed: Missing API Key. Set TRACEFORGE_API_KEY environment variable or pass it to init().")
    
    _config["api_key"] = api_key
    _config["endpoint"] = endpoint

    # Send setup handshake
    threading.Thread(target=_send_setup_handshake, daemon=True).start()

    if auto_capture:
        _setup_auto_capture()

def _get_setup_endpoint() -> str:
    base = _config.get("endpoint", "").rstrip("/")
    if base.endswith("/setup"):
        return base
    return f"{base}/setup"

def _send_setup_handshake():
    global _setup_handshake_sent
    if _setup_handshake_sent or not _config.get("api_key"):
        return
    
    try:
        res = requests.post(
            _get_setup_endpoint(),
            json={"environment": "python"},
            headers={
                "Content-Type": "application/json",
                "X-Traceforge-Key": _config["api_key"]
            },
            timeout=5
        )
        if res.status_code < 400:
            _setup_handshake_sent = True
    except Exception:
        pass

def _send_payload(payload):
    api_key = _config.get("api_key")
    endpoint = _config.get("endpoint")
    if not api_key or not endpoint:
        return

    headers = {
        "X-Traceforge-Key": api_key,
        "Content-Type": "application/json"
    }
    
    try:
        requests.post(endpoint, json=payload, headers=headers, timeout=5)
    except Exception as e:
        pass

def capture_exception(exc: Exception, tags: dict = None, payload: dict = None):
    if not _config.get("api_key"):
        return

    message = str(exc) or exc.__class__.__name__
    
    try:
        stack_trace = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    except Exception:
        stack_trace = traceback.format_exc()

    event = {
        "message": message,
        "stackTrace": stack_trace,
        "environment": "python",
        "tags": tags or {},
        "payload": payload or {}
    }
    
    # We use threading to send this synchronously in the background
    threading.Thread(target=_send_payload, args=(event,), daemon=True).start()

def capture_message(message: str, level: str = "info", context: dict = None):
    # Backward compatibility
    pass

def _setup_auto_capture():
    # Hook into sys.excepthook to catch all unhandled exceptions
    original_excepthook = sys.excepthook

    def traceforge_excepthook(exc_type, exc_value, exc_traceback):
        if exc_value:
            capture_exception(exc_value, tags={"uncaught": "true"})
        # Call the original excepthook to not break default behavior
        original_excepthook(exc_type, exc_value, exc_traceback)

    sys.excepthook = traceforge_excepthook
