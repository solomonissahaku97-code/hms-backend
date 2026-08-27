"""
Structured logging configuration.
Uses structlog for machine-readable, human-friendly log output.

Sensitive data (API keys, passwords) is NEVER logged.
"""

import structlog
import logging
import sys


def add_service_context(logger, method_name, event_dict):
    """Add service name to every log entry."""
    event_dict["service"] = "notifications-service"
    return event_dict


def mask_sensitive_fields(logger, method_name, event_dict):
    """Redact sensitive fields before they reach the log output."""
    sensitive_keys = {
        "api_key", "api_secret", "password", "secret",
        "token", "authorization", "sms_api_secret",
        "email_password", "service_auth_secret",
    }
    for key in list(event_dict.keys()):
        if any(s in key.lower() for s in sensitive_keys):
            event_dict[key] = "***REDACTED***"
    return event_dict


def configure_logging(debug: bool = False):
    """Set up structured logging for the service."""
    log_level = logging.DEBUG if debug else logging.INFO

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            add_service_context,
            mask_sensitive_fields,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.dev.ConsoleRenderer() if debug else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )


# ── Log Events ────────────────────────────────────────────────────────
# Use these structured event names across the service for consistency.

class LogEvents:
    """Centralized log event names."""
    NOTIFICATION_REQUESTED = "notification_requested"
    NOTIFICATION_QUEUED = "notification_queued"
    NOTIFICATION_PROCESSING = "notification_processing"
    NOTIFICATION_SENT = "notification_sent"
    NOTIFICATION_FAILED = "notification_failed"
    NOTIFICATION_SKIPPED = "notification_skipped"
    PROVIDER_ERROR = "provider_error"
    RETRY_ATTEMPT = "retry_attempt"
    QUEUE_CONSUMED = "queue_consumed"
    QUEUE_ERROR = "queue_error"
    AUTH_SUCCESS = "auth_success"
    AUTH_FAILURE = "auth_failure"
    HEALTH_CHECK = "health_check"
    STARTUP = "startup"
    SHUTDOWN = "shutdown"
