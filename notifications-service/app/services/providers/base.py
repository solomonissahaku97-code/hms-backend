"""
Abstract base class for notification providers.

Every provider (SMS, Email, Push) must implement the `send` method.
New providers can be added by extending this class.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ProviderResult:
    """Result of a provider send attempt."""
    success: bool
    provider: str
    provider_message_id: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    raw_response: dict = field(default_factory=dict)


class BaseProvider(ABC):
    """
    Abstract base class for all notification providers.

    To add a new provider:
      1. Create a new file in providers/ (e.g. push.py)
      2. Extend BaseProvider
      3. Implement the `send` method
      4. Register it in the factory
    """

    name: str = "base"

    @abstractmethod
    async def send(
        self,
        recipient: str,
        body: str,
        subject: Optional[str] = None,
        title: Optional[str] = None,
        **kwargs,
    ) -> ProviderResult:
        """
        Send a notification to the recipient.

        Args:
            recipient: Phone number, email address, or user ID
            body: The message body
            subject: Subject line (email only)
            title: Title (in-app / push only)
            **kwargs: Additional provider-specific options

        Returns:
            ProviderResult with success status and metadata
        """
        raise NotImplementedError

    async def health_check(self) -> bool:
        """Optional health check for the provider."""
        return True
