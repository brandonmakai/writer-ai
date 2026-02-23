"""Writer AI backend ASGI entrypoint for FastAPI CLI.

This module exposes the FastAPI `app` instance so that commands like
`fastapi dev main.py` work as expected.
"""

from app.main import app

