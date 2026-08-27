"""
Service-to-Service Authentication.

HMS Backend authenticates to the Notifications Service using a shared
secret that is signed with HMAC. This avoids sending raw passwords
over the network and allows rotation without redeployment.

Protocol:
  HMS Backend sends header:
    X-Service-Auth: <hmac_signature>
    X-Service-Name: hms-backend
    X-Timestamp: <unix_timestamp>

  The notifications service verifies:
    1. Timestamp is within 5 minutes (replay protection)
    2. HMAC signature matches: HMAC-SHA256(secret, f"{service_name}:{timestamp}")
"""

import time
import hmac
import hashlib
from fastapi import Request, HTTPException, status
from app.config import get_settings

settings = get_settings()

# Maximum age of a request in seconds (5 minutes)
MAX_REQUEST_AGE = 300


def sign_request(service_name: str, secret: str) -> tuple[str, str]:
    """
    Generate an HMAC signature for a service-to-service request.
    Returns (signature, timestamp_str).

    Usage from HMS Backend:
        from app.auth import sign_request
        sig, ts = sign_request("hms-backend", SERVICE_AUTH_SECRET)
        headers = {
            "X-Service-Auth": sig,
            "X-Service-Name": "hms-backend",
            "X-Timestamp": ts,
        }
    """
    timestamp = str(int(time.time()))
    message = f"{service_name}:{timestamp}"
    signature = hmac.new(
        secret.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return signature, timestamp


def verify_request(request: Request) -> bool:
    """
    Verify a service-to-service authentication header.
    Raises HTTPException if verification fails.
    """
    auth_header = request.headers.get("X-Service-Auth")
    service_name = request.headers.get("X-Service-Name")
    timestamp_str = request.headers.get("X-Timestamp")

    if not all([auth_header, service_name, timestamp_str]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing service authentication headers",
        )

    # ── Verify timestamp (replay protection) ──────────────────────
    try:
        timestamp = int(timestamp_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid timestamp format",
        )

    age = abs(int(time.time()) - timestamp)
    if age > MAX_REQUEST_AGE:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Request timestamp too old",
        )

    # ── Verify HMAC signature ─────────────────────────────────────
    expected_message = f"{service_name}:{timestamp}"
    expected_signature = hmac.new(
        settings.SERVICE_AUTH_SECRET.encode("utf-8"),
        expected_message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(auth_header, expected_signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid service authentication",
        )

    return True
