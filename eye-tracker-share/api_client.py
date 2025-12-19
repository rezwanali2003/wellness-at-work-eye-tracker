# api_client.py  (desktop-app folder, next to main.py)

import os
import requests


# Base URL: prefer env var for cloud, fallback to local dev
API_BASE = os.getenv("WAW_API_BASE", "http://16.171.137.237")


class ApiError(Exception):
    pass


def api_login(email: str, password: str) -> str:
    """
    Call FastAPI /auth/login and return access_token string.
    """
    try:
        resp = requests.post(
            f"{API_BASE}/auth/login",
            json={"email": email, "password": password},
            timeout=5,
        )
    except requests.RequestException as e:
        raise ApiError(f"Cannot reach server: {e}")

    if resp.status_code != 200:
        try:
            detail = resp.json().get("detail", "Login failed")
        except Exception:
            detail = f"Login failed ({resp.status_code})"
        raise ApiError(detail)

    data = resp.json()
    token = data.get("access_token")
    if not token:
        raise ApiError("Invalid response from server, no access_token")
    return token


def api_submit_blinks(token: str, events: list[dict]) -> None:
    """
    POST /api/blinks/batch with Authorization: Bearer <token>.
    events: list of {"timestamp": str, "blink_delta": int, "session_id": str}
    """
    if not events:
        return

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(
            f"{API_BASE}/api/blinks/batch",
            json={"events": events},
            headers=headers,
            timeout=5,
        )
    except requests.RequestException as e:
        raise ApiError(f"Sync failed (network): {e}")

    if resp.status_code != 200:
        try:
            detail = resp.json().get("detail", f"Status {resp.status_code}")
        except Exception:
            detail = f"Sync failed ({resp.status_code})"
        raise ApiError(detail)
