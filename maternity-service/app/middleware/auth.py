from fastapi import Depends, HTTPException, Header
from app.config import settings
import jwt

async def authenticate(authorization: str = Header(None), x_service_key: str = Header(None)):
    if x_service_key and x_service_key == settings.HMS_SERVICE_KEY:
        return {"id": "system", "role": "service"}
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        return jwt.decode(authorization.split(" ")[1], settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
