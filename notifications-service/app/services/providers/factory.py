"""
Provider Factory — returns the correct notification provider for a channel.

Adding a new provider:
  1. Create the provider class in its own file
  2. Register it in the PROVIDERS map below
"""

from typing import Dict, Type
from app.services.providers.base import BaseProvider
from app.services.providers.sms import SMSProvider
from app.services.providers.email import EmailProvider
from app.services.providers.in_app import InAppProvider


# ── Registry ───────────────────────────────────────────────────────────
PROVIDERS: Dict[str, Type[BaseProvider]] = {
    "sms": SMSProvider,
    "email": EmailProvider,
    "in_app": InAppProvider,
    # "push": PushProvider,  # Add when ready
}


def get_provider(channel: str) -> BaseProvider:
    """
    Get a notification provider instance for the given channel.

    Args:
        channel: One of "sms", "email", "in_app", "push"

    Returns:
        An instance of the appropriate provider

    Raises:
        ValueError: If the channel has no registered provider
    """
    provider_class = PROVIDERS.get(channel)
    if not provider_class:
        raise ValueError(
            f"No provider registered for channel '{channel}'. "
            f"Available channels: {', '.join(sorted(PROVIDERS.keys()))}"
        )
    return provider_class()
