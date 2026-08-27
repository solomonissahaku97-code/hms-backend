"""
Email Notification Provider.

Uses aiosmtplib for async SMTP delivery.
Configurable for any SMTP server (Gmail, SendGrid, AWS SES, etc.).
"""

import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from tenacity import retry, stop_after_attempt, wait_exponential
import structlog

from app.services.providers.base import BaseProvider, ProviderResult
from app.config import get_settings

logger = structlog.get_logger()
settings = get_settings()


class EmailProvider(BaseProvider):
    """Email notification provider via SMTP."""

    name = "email"

    async def send(
        self,
        recipient: str,
        body: str,
        subject: Optional[str] = None,
        title: Optional[str] = None,
        **kwargs,
    ) -> ProviderResult:
        """Send an email via SMTP."""
        if not settings.EMAIL_HOST:
            logger.warning("email_provider_config_missing")
            return ProviderResult(
                success=False,
                provider="smtp",
                error_message="Email host not configured",
            )

        return await self._send_smtp(recipient, body, subject, **kwargs)

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
    async def _send_smtp(
        self,
        recipient: str,
        body: str,
        subject: Optional[str] = None,
        **kwargs,
    ) -> ProviderResult:
        """Send email via SMTP."""
        try:
            msg = MIMEMultipart("alternative")
            msg["From"] = settings.EMAIL_FROM
            msg["To"] = recipient
            msg["Subject"] = subject or "HMS Notification"

            # Plain text body
            msg.attach(MIMEText(body, "plain"))

            # HTML body if provided
            html_body = kwargs.get("html_body")
            if html_body:
                msg.attach(MIMEText(html_body, "html"))

            await aiosmtplib.send(
                msg,
                hostname=settings.EMAIL_HOST,
                port=settings.EMAIL_PORT,
                username=settings.EMAIL_USERNAME,
                password=settings.EMAIL_PASSWORD,
                use_tls=settings.EMAIL_USE_TLS,
            )

            logger.info("email_sent", recipient=recipient, subject=subject)
            return ProviderResult(
                success=True,
                provider="smtp",
            )

        except Exception as e:
            logger.error("email_send_failed", error=str(e))
            return ProviderResult(
                success=False,
                provider="smtp",
                error_code=type(e).__name__,
                error_message=str(e),
            )
