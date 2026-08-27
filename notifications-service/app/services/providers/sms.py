"""
SMS Notification Provider.

Supports Twilio, Termii, or custom SMS gateways.
Currently implements a logging stub — replace with real provider SDK.
"""

import httpx
from typing import Optional
from tenacity import retry, stop_after_attempt, wait_exponential
import structlog

from app.services.providers.base import BaseProvider, ProviderResult
from app.config import get_settings

logger = structlog.get_logger()
settings = get_settings()


class SMSProvider(BaseProvider):
    """SMS notification provider — routes to the configured SMS gateway."""

    name = "sms"

    async def send(
        self,
        recipient: str,
        body: str,
        subject: Optional[str] = None,
        title: Optional[str] = None,
        **kwargs,
    ) -> ProviderResult:
        """Send an SMS via the configured provider."""
        provider = settings.SMS_PROVIDER.lower()

        if provider == "twilio":
            return await self._send_twilio(recipient, body, **kwargs)
        elif provider == "termii":
            return await self._send_termii(recipient, body, **kwargs)
        else:
            return await self._send_custom(recipient, body, **kwargs)

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
    async def _send_twilio(self, recipient: str, body: str, **kwargs) -> ProviderResult:
        """Send SMS via Twilio API."""
        if not settings.SMS_API_KEY or not settings.SMS_API_SECRET:
            logger.warning("sms_provider_config_missing", provider="twilio")
            return ProviderResult(
                success=False,
                provider="twilio",
                error_message="Twilio credentials not configured",
            )

        url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.SMS_API_KEY}/Messages.json"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                auth=(settings.SMS_API_KEY, settings.SMS_API_SECRET),
                data={
                    "To": recipient,
                    "From": settings.SMS_SENDER_ID,
                    "Body": body,
                },
                timeout=30,
            )

            if response.status_code in (200, 201):
                data = response.json()
                return ProviderResult(
                    success=True,
                    provider="twilio",
                    provider_message_id=data.get("sid"),
                    raw_response=data,
                )
            else:
                return ProviderResult(
                    success=False,
                    provider="twilio",
                    error_code=str(response.status_code),
                    error_message=response.text,
                )

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
    async def _send_termii(self, recipient: str, body: str, **kwargs) -> ProviderResult:
        """Send SMS via Termii API."""
        if not settings.SMS_API_KEY:
            logger.warning("sms_provider_config_missing", provider="termii")
            return ProviderResult(
                success=False,
                provider="termii",
                error_message="Termii API key not configured",
            )

        url = "https://api.termii.com/api/sms/send"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json={
                    "api_key": settings.SMS_API_KEY,
                    "to": recipient,
                    "from": settings.SMS_SENDER_ID,
                    "sms": body,
                    "type": "plain",
                    "channel": "generic",
                },
                timeout=30,
            )

            if response.status_code in (200, 201):
                data = response.json()
                return ProviderResult(
                    success=True,
                    provider="termii",
                    provider_message_id=data.get("message_id"),
                    raw_response=data,
                )
            else:
                return ProviderResult(
                    success=False,
                    provider="termii",
                    error_code=str(response.status_code),
                    error_message=response.text,
                )

    async def _send_custom(self, recipient: str, body: str, **kwargs) -> ProviderResult:
        """Custom SMS provider — logs the attempt (replace with your gateway)."""
        logger.info(
            "sms_send_custom",
            recipient=recipient,
            body_length=len(body),
        )
        # TODO: Implement your custom SMS gateway here
        return ProviderResult(
            success=True,
            provider="custom",
            provider_message_id="custom-stub",
        )
