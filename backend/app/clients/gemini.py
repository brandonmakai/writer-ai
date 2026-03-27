"""Thin async client for the Gemini API"""

import asyncio
import json
from enum import StrEnum, auto
from typing import Any

import httpx

from app.core.config import Settings
from app.core.logging import get_logger
from app.schemas.edit import EditRequest, EditResponse, LLMEditPayload
from app.schemas.outline import OutlineRequest, OutlineResponse
from app.schemas.rewrite import ChangeHighlight, RewriteRequest, RewriteResponse

logger = get_logger(__name__)

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"
TIMEOUT_SECONDS = 60.0
# Retry 429 (rate limit) with exponential backoff
MAX_RETRIES_429 = 3
INITIAL_BACKOFF_SECONDS = 2.0
# Retry outline parse failures (e.g. malformed JSON from Gemini)
MAX_OUTLINE_PARSE_ATTEMPTS = 3
RAW_RESPONSE_LOG_LIMIT = 2000


async def _post_with_retry(
    client: httpx.AsyncClient,
    url: str,
    headers: dict[str, str],
    payload: dict[str, Any],
    log_label: str,
) -> httpx.Response:
    """POST once or retry on 429 with exponential backoff."""
    last_response: httpx.Response | None = None
    backoff = INITIAL_BACKOFF_SECONDS
    for attempt in range(MAX_RETRIES_429 + 1):
        resp = await client.post(url, headers=headers, json=payload)
        last_response = resp
        if resp.status_code == 429:
            # Log full response so we can see which limit is hit (RPM, RPD, etc.)
            body_preview = resp.text if resp.text else "(empty)"
            retry_after = resp.headers.get("Retry-After", "")
            logger.warning(
                "%s: 429 Too Many Requests — body=%s%s",
                log_label,
                body_preview[:1500],
                (f" Retry-After={retry_after}") if retry_after else "",
            )
            if attempt < MAX_RETRIES_429:
                logger.warning(
                    "%s: retry %s/%s in %.1fs",
                    log_label,
                    attempt + 1,
                    MAX_RETRIES_429,
                    backoff,
                )
                await asyncio.sleep(backoff)
            backoff *= 2
            continue
        break
    if last_response and not last_response.is_success:
        logger.error(
            "%s non-OK: status=%s body=%s",
            log_label,
            last_response.status_code,
            (last_response.text[:2000] if last_response.text else "(empty)"),
        )
    if last_response:
        last_response.raise_for_status()
    return last_response  # type: ignore[return-value]


def _build_outline_prompt(request: OutlineRequest) -> str:
    """Build the prompt to split chapter into 3–8 structural bullets with anchor text."""
    parts = [
        "You are a fiction editor. Split the following chapter into 3–8 structural "
        "bullet points that summarize the main beats or scenes.",
        "Each bullet must have two fields: content (one short summary sentence) and "
        "anchor_text (one exact verbatim sentence from the chapter that this bullet addresses).",
        "For anchor_text use either the first occurrence of that idea in the chapter, or the "
        "single most significant sentence that led to the insight. Return only valid JSON.",
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
    parts.append(
        'Return a JSON object with two keys: "bullets" (array of 3–8 objects, each with '
        '"content" (string) and "anchor_text" (string, verbatim from the chapter)), and '
        '"suggested_index" (integer, 0-based index into bullets of the one beat most impactful '
        "to edit first, or the pivot beat)."
    )
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
        "Return a JSON object with keys: chapter_text, internal_structure, change_highlights. "
        "internal_structure must have bullets (array of objects with content and anchor_text) "
        "and scene_summaries. For each bullet, anchor_text must be one exact verbatim sentence "
        "or phrase from your refactored chapter_text that the bullet addresses (for UI tethers)."
    )
    return "\n".join(parts)


def _parse_rewrite_response(raw: str) -> RewriteResponse:
    """Parse Gemini response text into RewriteResponse."""
    data: Any = json.loads(raw)
    return RewriteResponse.model_validate(data)


def _build_edit_prompt(request: EditRequest) -> str:
    """Build the prompt for a micro-edit (search-replace pairs)."""
    parts = [
        "You are a fiction editor. The user wants to make a specific edit to their chapter.",
        "",
        "RULES:",
        "- Return ONLY search-replace pairs for text that must change.",
        '- "search" must be an EXACT substring from the original chapter (copy-paste precision).',
        '- "search" should be long enough to be unique in the chapter (full sentence preferred).',
        '- "replace" is the edited version of that exact text.',
        "- Only include edits necessary to fulfill the instruction.",
        "- Update the bullets to reflect the edited chapter.",
        "",
        "## Chapter (original)",
        request.chapter.text.strip(),
        "",
        "## Current structural beats",
    ]
    for i, b in enumerate(request.bullets, 1):
        parts.append(f"{i}. {b.strip()}")
    parts.append("")
    parts.append("## Edit instruction")
    parts.append(request.instruction.strip())
    if request.chapter.tone:
        parts.append("")
        parts.append(f"Tone guidance: {request.chapter.tone.strip()}")
    if request.chapter.language:
        parts.append("")
        parts.append(f"Target language: {request.chapter.language.strip()}")
    parts.append("")
    parts.append(
        'Return a JSON object with keys: "edits" (array of {search, replace} pairs) '
        'and "bullets" (array of {label, content, anchor_text} reflecting the edited chapter). '
        '"label" is a short, evocative title for the beat (2–5 words, e.g. "Confrontation", '
        '"The Turning Point"). anchor_text must be verbatim from the EDITED chapter.'
    )
    return "\n".join(parts)


def _parse_edit_response(raw: str) -> LLMEditPayload:
    """Parse Gemini response text into LLMEditPayload."""
    data: Any = json.loads(raw)
    return LLMEditPayload.model_validate(data)


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
        self._structured_output = settings.gemini_structured_output
        self._dev_log = settings.debug

    async def rewrite_chapter(self, request: RewriteRequest) -> RewriteResponse:
        """Call Gemini to refactor the chapter according to the bullets."""
        if not self._api_key:
            raise ValueError("gemini_api_key is not set")

        prompt = _build_rewrite_prompt(request)
        url = f"{self._base}/models/{self._model}:generateContent"

        MAX_OUTPUT_TOKENS = 8192
        generation_config: dict[str, Any] = {"maxOutputTokens": MAX_OUTPUT_TOKENS}
        if self._structured_output:
            generation_config["responseMimeType"] = "application/json"
            generation_config["responseJsonSchema"] = RewriteResponse.model_json_schema()
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": generation_config,
        }

        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            resp = await _post_with_retry(
                client,
                url,
                headers={"x-goog-api-key": self._api_key},
                payload=payload,
                log_label="Gemini rewrite_chapter",
            )

        body = resp.json()
        try:
            text = _extract_response_text(body)
            result = _parse_rewrite_response(text)
            if self._dev_log:
                logger.info(
                    "rewrite_chapter response (dev): %s",
                    json.dumps(result.model_dump(), indent=2),
                )
            return result
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            raise ValueError(f"Failed to parse Gemini response: {e}") from e

    async def edit_chapter(self, request: EditRequest) -> EditResponse:
        """Call Gemini to produce search-replace pairs, then apply them to the original text."""
        if not self._api_key:
            raise ValueError("gemini_api_key is not set")

        prompt = _build_edit_prompt(request)
        url = f"{self._base}/models/{self._model}:generateContent"

        MAX_OUTPUT_TOKENS = 2048
        MAX_EDIT_PARSE_ATTEMPTS = 3
        generation_config: dict[str, Any] = {"maxOutputTokens": MAX_OUTPUT_TOKENS}
        if self._structured_output:
            generation_config["responseMimeType"] = "application/json"
            generation_config["responseJsonSchema"] = LLMEditPayload.model_json_schema()
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": generation_config,
        }

        llm_result: LLMEditPayload | None = None
        for attempt in range(MAX_EDIT_PARSE_ATTEMPTS):
            async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
                resp = await _post_with_retry(
                    client,
                    url,
                    headers={"x-goog-api-key": self._api_key},
                    payload=payload,
                    log_label="Gemini edit_chapter",
                )
            body = resp.json()
            raw: str | None = None
            try:
                raw = _extract_response_text(body)
                llm_result = _parse_edit_response(raw)
                if self._dev_log:
                    logger.info(
                        "edit_chapter response (dev): %s",
                        json.dumps(llm_result.model_dump(), indent=2),
                    )
                break
            except (KeyError, IndexError, json.JSONDecodeError, ValueError) as e:
                raw_preview: str = (
                    (raw[:RAW_RESPONSE_LOG_LIMIT] + "... [truncated]")
                    if raw and len(raw) > RAW_RESPONSE_LOG_LIMIT
                    else (raw or "(extract failed)")
                )
                is_final = attempt == MAX_EDIT_PARSE_ATTEMPTS - 1
                if is_final:
                    logger.error(
                        "Gemini edit_chapter parse failed (final): %s; raw: %s",
                        e,
                        raw_preview,
                    )
                    raise ValueError(f"Failed to parse Gemini response: {e}") from e
                logger.warning(
                    "Gemini edit_chapter parse failed, retrying: %s; raw: %s",
                    e,
                    raw_preview,
                )

        assert llm_result is not None  # loop raises or breaks with result

        # Apply search-replace edits to the original chapter text
        chapter_text = request.chapter.text
        highlights: list[ChangeHighlight] = []
        applied = 0
        for edit in llm_result.edits:
            if edit.search in chapter_text:
                chapter_text = chapter_text.replace(edit.search, edit.replace, 1)
                highlights.append(ChangeHighlight(original=edit.search, updated=edit.replace))
                applied += 1
            else:
                logger.warning("Edit search text not found in chapter: %.100s", edit.search)

        from app.schemas.rewrite import InternalStructure

        return EditResponse(
            chapter_text=chapter_text,
            change_highlights=highlights,
            internal_structure=InternalStructure(
                bullets=llm_result.bullets,
                scene_summaries=[],
            ),
            edits_applied=applied,
        )

    async def outline_chapter(self, request: OutlineRequest) -> OutlineResponse:
        """Call Gemini to split the chapter into 3–8 structural bullets."""
        if not self._api_key:
            raise ValueError("gemini_api_key is not set")
        prompt = _build_outline_prompt(request)
        url = f"{self._base}/models/{self._model}:generateContent"

        MAX_OUTPUT_TOKENS = 4096
        generation_config: dict[str, Any] = {"maxOutputTokens": MAX_OUTPUT_TOKENS}
        if self._structured_output:
            generation_config["responseMimeType"] = "application/json"
            generation_config["responseJsonSchema"] = OutlineResponse.model_json_schema()
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": generation_config,
        }
        for attempt in range(MAX_OUTLINE_PARSE_ATTEMPTS):
            async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
                resp = await _post_with_retry(
                    client,
                    url,
                    headers={"x-goog-api-key": self._api_key},
                    payload=payload,
                    log_label="Gemini outline_chapter",
                )
            body = resp.json()
            text: str | None = None
            try:
                text = _extract_response_text(body)
                result = _parse_outline_response(text)
                if self._dev_log:
                    logger.info(
                        "outline_chapter response (dev): %s",
                        json.dumps(result.model_dump(), indent=2),
                    )
                return result
            except (KeyError, IndexError, json.JSONDecodeError) as e:
                raw_preview: str = (
                    (text[:RAW_RESPONSE_LOG_LIMIT] + "... [truncated]")
                    if text and len(text) > RAW_RESPONSE_LOG_LIMIT
                    else (text or "(extract failed)")
                )
                is_final = attempt == MAX_OUTLINE_PARSE_ATTEMPTS - 1
                if is_final:
                    logger.error(
                        "Gemini outline_chapter parse failed (final): %s; raw (truncated): %s",
                        e,
                        raw_preview,
                    )
                else:
                    logger.warning(
                        "Gemini outline_chapter parse failed, retrying: %s; raw (truncated): %s",
                        e,
                        raw_preview,
                    )
                if is_final:
                    raise ValueError(f"Failed to parse Gemini response: {e}") from e
        raise AssertionError("unreachable")  # loop always returns or raises
