"""Thin async client for the Gemini API"""

import json
from enum import StrEnum, auto
from typing import Any

import httpx

from app.core.config import Settings
from app.schemas.outline import OutlineRequest, OutlineResponse
from app.schemas.rewrite import RewriteRequest, RewriteResponse

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"
TIMEOUT_SECONDS = 60.0


def _build_outline_prompt(request: OutlineRequest) -> str:
    """Build the prompt to split chapter into 3–8 structural bullets."""
    parts = [
        "You are a fiction editor. Split the following chapter into 3–8 structural "
        "bullet points that summarize the main beats or scenes.",
        "Each bullet should be one short sentence. Return only valid JSON.",
        "",
        "## Chapter",
        request.chapter.text.strip(),
    ]
    if request.chapter.tone:
        parts.append("")
        parts.append(f"Tone context: {request.chapter.tone.strip()}")
    if request.chapter.language:
        parts.append("")
        parts.append(f"Language: {request.chapter.language.strip()}")
    parts.append("")
    parts.append('Return a JSON object with a single key "bullets" (array of 3–8 strings).')
    return "\n".join(parts)


def _parse_outline_response(raw: str) -> OutlineResponse:
    """Parse Gemini response into OutlineResponse."""
    data: Any = json.loads(raw)
    return OutlineResponse.model_validate(data)


def _build_rewrite_prompt(request: RewriteRequest) -> str:
    """Build the prompt sent to Gemini for a rewrite."""
    parts = [
        "You are a fiction editor. Refactor the following chapter to match the given "
        "structural bullets.",
        "Preserve tone, character arcs, and consistency.",
        "",
        "## Chapter (original)",
        request.chapter.text.strip(),
        "",
        "## Structural bullets (refactor to match these)",
    ]
    for i, b in enumerate(request.bullets, 1):
        parts.append(f"{i}. {b.strip()}")
    if request.chapter.tone:
        parts.append("")
        parts.append(f"Tone guidance: {request.chapter.tone.strip()}")
    if request.chapter.language:
        parts.append("")
        parts.append(f"Target language: {request.chapter.language.strip()}")
    parts.append("")
    parts.append(
        "Return a JSON object with keys: chapter_text, internal_structure "
        "(bullets, scene_summaries), change_highlights."
    )
    return "\n".join(parts)


def _parse_rewrite_response(raw: str) -> RewriteResponse:
    """Parse Gemini response text into RewriteResponse."""
    data: Any = json.loads(raw)
    return RewriteResponse.model_validate(data)


class GeminiFinishReason(StrEnum):
    SAFETY = auto()
    RECITATION = auto()
    OTHER = auto()
    BLOCKLIST = auto()
    MAX_TOKENS = auto()


def _check_finish_reason(candidate: dict[str, Any]) -> None:
    """Raise if the candidate was blocked or failed."""
    finish_reason = (candidate.get("finishReason") or candidate.get("finish_reason") or "").upper()
    reasons = tuple(r.value for r in GeminiFinishReason)
    max_tokens_reason = GeminiFinishReason.MAX_TOKENS.value

    if finish_reason in reasons:
        safety_ratings = candidate.get("safetyRatings") or candidate.get("safety_ratings") or []
        msg = f"Gemini response blocked or filtered (finishReason={finish_reason})"
        if safety_ratings:
            msg += f"; ratings={safety_ratings}"
        raise ValueError(msg)
    if finish_reason == max_tokens_reason:
        raise ValueError(f"Gemini response truncated ({max_tokens_reason})")


def _extract_response_text(body: dict[str, Any]) -> str:
    """Get the first candidate's text from a generateContent response. Raises on missing/blocked."""
    candidates = body.get("candidates") or []
    if not candidates:
        prompt_feedback = body.get("promptFeedback") or body.get("prompt_feedback") or {}
        block_reason = prompt_feedback.get("blockReason") or prompt_feedback.get("block_reason")
        if block_reason:
            raise ValueError(f"Gemini request blocked: {block_reason}")
        raise ValueError("No candidates in Gemini response")

    candidate = candidates[0]
    _check_finish_reason(candidate)
    content = candidate.get("content") or {}
    parts = content.get("parts") or []
    if not parts:
        raise ValueError("No parts in Gemini response")

    text = (parts[0].get("text") or "").strip()
    if not text:
        raise ValueError("Empty text in Gemini response")
    return text


class GeminiClient:
    """Async client for Gemini generateContent REST API."""

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

        MAX_OUTPUT_TOKENS = 8192
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": RewriteResponse.model_json_schema(),
                "maxOutputTokens": MAX_OUTPUT_TOKENS,
            },
        }

        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            resp = await client.post(
                url,
                headers={"x-goog-api-key": self._api_key},
                json=payload,
            )
            resp.raise_for_status()

        body = resp.json()
        try:
            text = _extract_response_text(body)
            return _parse_rewrite_response(text)
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            raise ValueError(f"Failed to parse Gemini response: {e}") from e

    async def outline_chapter(self, request: OutlineRequest) -> OutlineResponse:
        """Call Gemini to split the chapter into 3–8 structural bullets."""
        if not self._api_key:
            raise ValueError("gemini_api_key is not set")
        prompt = _build_outline_prompt(request)
        url = f"{self._base}/models/{self._model}:generateContent"

        MAX_OUTPUT_TOKENS = 1024
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": OutlineResponse.model_json_schema(),
                "maxOutputTokens": MAX_OUTPUT_TOKENS,
            },
        }
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            resp = await client.post(
                url,
                headers={"x-goog-api-key": self._api_key},
                json=payload,
            )
            resp.raise_for_status()
        body = resp.json()
        try:
            text = _extract_response_text(body)
            return _parse_outline_response(text)
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            raise ValueError(f"Failed to parse Gemini response: {e}") from e
