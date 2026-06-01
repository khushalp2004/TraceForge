import os
import traceback
import requests
import threading
import time

_config = {}

def init(api_key: str, environment: str = "production", endpoint: str = "https://traceforge.io/api/ingest"):
    _config["api_key"] = api_key
    _config["environment"] = environment
    _config["endpoint"] = endpoint

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
        response = requests.post(endpoint, json=payload, headers=headers)
        if response.status_code >= 300:
            print(f"[TraceForge] Failed to capture exception. Server returned status {response.status_code}: {response.text}", flush=True)
    except Exception as e:
        print(f"[TraceForge] Error reporting exception: {e}", flush=True)

def capture_exception(exc: Exception, context: dict = None):
    payload = {
        "message": str(exc) or exc.__class__.__name__,
        "errorType": exc.__class__.__name__,
        "stackTrace": traceback.format_exc(),
        "language": "python",
        "environment": _config.get("environment", "production"),
        "level": "error",
        "timestamp": int(time.time() * 1000),
        "metadata": context or {}
    }
    
    # We use threading to send this synchronously in the background without blocking FastAPI
    threading.Thread(target=_send_payload, args=(payload,), daemon=True).start()

def capture_message(message: str, level: str = "info", context: dict = None):
    payload = {
        "message": message,
        "language": "python",
        "environment": _config.get("environment", "production"),
        "level": level,
        "timestamp": int(time.time() * 1000),
        "metadata": context or {}
    }
    
    threading.Thread(target=_send_payload, args=(payload,), daemon=True).start()
