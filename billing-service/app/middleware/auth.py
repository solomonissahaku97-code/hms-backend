"""Authentication middleware for the billing service."""

from typing import Optional
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import get_settings

settings = get_settings()
security = HTTPBearer(auto_error=False)


class AuthUser:
    """Represents an authenticated user/service."""
    def __init__(self, id: str, institution_id: Optional[str] = None, role: str = "user"):
        self.id = id
        self.institution_id = institution_id
        self.role = role


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_service_key: Optional[str] = Header(None, alias="X-Service-Key"),
    x_service_user_id: Optional[str] = Header(None, alias="X-Service-User-Id"),
    x_service_institution_id: Optional[str] = Header(None, alias="X-Service-Institution-Id"),
) -> AuthUser:
    """
    Authenticate the current request.
    Accepts:
    1. JWT bearer token (from users)
    2. X-Service-Key header (inter-service calls)
    """
    # Inter-service authentication
    if x_service_key and x_service_key == settings.hms_backend_api_key:
        return AuthUser(
            id=x_service_user_id or "system",
            institution_id=x_service_institution_id,
            role="service",
        )

    # JWT authentication
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        user_id = payload.get("sub") or payload.get("id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject",
            )
        return AuthUser(
            id=user_id,
            institution_id=payload.get("institution_id"),
            role=payload.get("role", "user"),
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )


def require_institution(
    institution_id: Optional[str] = None,
    user: AuthUser = Depends(get_current_user),
) -> AuthUser:
    """Ensure the user has access to the specified institution."""
    if user.role == "service":
        return user
    if user.institution_id and institution_id and user.institution_id != institution_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: institution mismatch",
        )
    return user
