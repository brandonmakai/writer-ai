"""Thin async client for the Gemini API (rewrite-from-outline)."""

import json
from typing import Any

import httpx

from app.core.config import Settings
from app.schemas.rewrite import RewriteRequest, RewriteResponse


GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"


def _build_rewrite_prompt(request: RewriteRequest) -> str:
    """Build the prompt sent to Gemini for a rewrite."""
    parts = [
        "You are a fiction editor. Refactor the following chapter to match the given structural bullets.",
        "Preserve tone, character arcs, and consistency. Return only valid JSON.",
        "",
        "## Chapter (original)",
        request.chapter_text.strip(),
        "",
        "## Structural bullets (refactor to match these)",
    ]
    for i, b in enumerate(request.bullets, 1):
        parts.append(f"{i}. {b.strip()}")
    if request.tone:
        parts.append("")
        parts.append(f"Tone guidance: {request.tone.strip()}")
    if request.language:
        parts.append("")
        parts.append(f"Target language: {request.language.strip()}")
    parts.append("")
    parts.append(
        "Return a JSON object with keys: chapter_text (string), internal_structure (object with bullets and scene_summaries), change_highlights (array of {original, updated})."
    )
    return "\n".join(parts)


def _parse_rewrite_response(raw: str) -> RewriteResponse:
    """Parse Gemini response text into RewriteResponse."""
    data: Any = json.loads(raw)
    return RewriteResponse.model_validate(data)


class GeminiClient:
    """Async client for Gemini generateContent API."""

    def __init__(self, settings: Settings) -> None:
        self._api_key = settings.gemini_api_key or ""
        self._model = settings.gemini_model
        self._base = GEMINI_BASE

    async def rewrite_chapter(self, request: RewriteRequest) -> RewriteResponse:
        """Call Gemini to refactor the chapter according to the bullets."""
        if not self._api_key:
            raise ValueError("gemini_api_key is not set")
        prompt = _build_rewrite_prompt(request)
        url = f"{self._base}/models/{self._model}:generateContent"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.7,
                "maxOutputTokens": 8192,
            },
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                url,
                params={"key": self._api_key},
                json=payload,
            )
            resp.raise_for_status()
        body = resp.json()
        try:
            candidates = body.get("candidates") or []
            if not candidates:
                raise ValueError("No candidates in Gemini response")
            parts = (candidates[0].get("content") or {}).get("parts") or []
            if not parts:
                raise ValueError("No parts in Gemini response")
            text = (parts[0].get("text") or "").strip()
            if not text:
                raise ValueError("Empty text in Gemini response")
            return _parse_rewrite_response(text)
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            raise ValueError(f"Failed to parse Gemini response: {e}") from e
