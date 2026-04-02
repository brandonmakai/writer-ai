"""BetterStack heartbeat — pings the configured URL every 15 minutes."""

import asyncio
import logging

import httpx

logger = logging.getLogger(__name__)

_INTERVAL_SECONDS = 420  # 7 minutes — two pings per BetterStack beat window


async def _heartbeat_loop(url: str) -> None:
    async with httpx.AsyncClient(timeout=10) as client:
        while True:
            try:
                await client.get(url)
                logger.info("BetterStack heartbeat sent.")
            except Exception as exc:
                logger.warning("BetterStack heartbeat failed: %s", exc)
            await asyncio.sleep(_INTERVAL_SECONDS)


def start_heartbeat(url: str) -> asyncio.Task:  # type: ignore[type-arg]
    """Schedule the heartbeat loop as a background asyncio task.

    Must be called from within a running event loop (e.g. FastAPI lifespan).
    """
    return asyncio.create_task(_heartbeat_loop(url))
