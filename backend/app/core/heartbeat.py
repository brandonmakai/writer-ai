"""BetterStack heartbeat — pings the configured URL every 7 minutes.

When Gemini billing credits are exhausted, the interval drops to 1 minute so
BetterStack receives a continuous stream of pings while the outage lasts.
Call signal_out_of_credits() / clear_out_of_credits() to toggle this state.
"""

import asyncio
import logging

import httpx

logger = logging.getLogger(__name__)

_INTERVAL_SECONDS = 420  # 7 minutes — two pings per BetterStack beat window
_ALERT_INTERVAL_SECONDS = 60  # 1 minute — aggressive ping during outage

# Simple flag; safe in asyncio's single-threaded event loop.
_out_of_credits: bool = False


def signal_out_of_credits() -> None:
    """Mark Gemini as out of credits; heartbeat switches to alert cadence."""
    global _out_of_credits
    if not _out_of_credits:
        _out_of_credits = True
        logger.error("Gemini credits exhausted — heartbeat alert cadence activated.")


def clear_out_of_credits() -> None:
    """Mark Gemini credits as restored; heartbeat returns to normal cadence."""
    global _out_of_credits
    if _out_of_credits:
        _out_of_credits = False
        logger.info("Gemini credits restored — heartbeat returned to normal cadence.")


async def _heartbeat_loop(url: str) -> None:
    async with httpx.AsyncClient(timeout=10) as client:
        while True:
            try:
                await client.get(url)
                if _out_of_credits:
                    logger.warning("BetterStack alert heartbeat sent (Gemini out of credits).")
                else:
                    logger.info("BetterStack heartbeat sent.")
            except Exception as exc:
                logger.warning("BetterStack heartbeat failed: %s", exc)
            await asyncio.sleep(_ALERT_INTERVAL_SECONDS if _out_of_credits else _INTERVAL_SECONDS)


def start_heartbeat(url: str) -> asyncio.Task:  # type: ignore[type-arg]
    """Schedule the heartbeat loop as a background asyncio task.

    Must be called from within a running event loop (e.g. FastAPI lifespan).
    """
    return asyncio.create_task(_heartbeat_loop(url))
