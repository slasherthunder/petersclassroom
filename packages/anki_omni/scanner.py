"""Deck accessibility scanner — heuristic scoring per card and deck."""

from __future__ import annotations

import re
from html.parser import HTMLParser
from typing import Any

from aqt import mw


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.images: list[dict[str, str | None]] = []

    def handle_data(self, data: str) -> None:
        if data.strip():
            self.parts.append(data.strip())

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "img":
            return
        attr_map = {k: v for k, v in attrs}
        self.images.append({"src": attr_map.get("src"), "alt": attr_map.get("alt")})


def _plain_text(html: str) -> str:
    parser = _TextExtractor()
    try:
        parser.feed(html or "")
    except Exception:
        return re.sub(r"<[^>]+>", " ", html or "")
    return " ".join(parser.parts)


def _avg_sentence_words(text: str) -> float:
    sentences = re.split(r"[.!?]+", text)
    sentences = [s.strip() for s in sentences if s.strip()]
    if not sentences:
        return 0.0
    counts = [len(s.split()) for s in sentences]
    return sum(counts) / len(counts)


def _formatting_density(html: str) -> int:
    tags = re.findall(r"<(/?)(\w+)", html or "")
    return len(tags)


def score_note_html(fields_html: list[str]) -> tuple[int, list[str]]:
    combined_html = " ".join(fields_html)
    combined_text = _plain_text(combined_html)
    parser = _TextExtractor()
    try:
        parser.feed(combined_html)
    except Exception:
        pass

    score = 100
    issues: list[str] = []

    if len(combined_text) > 2000:
        score -= 15
        issues.append("Overly long card text")
    elif len(combined_text) > 1200:
        score -= 8
        issues.append("Long card text")

    avg_words = _avg_sentence_words(combined_text)
    if avg_words > 28:
        score -= 12
        issues.append("Low readability (very long sentences)")
    elif avg_words > 22:
        score -= 6
        issues.append("Moderate readability (long sentences)")

    images = parser.images
    if images and len(combined_text) < 20:
        score -= 25
        issues.append("Image-only or near image-only card")

    missing_alt = [img for img in images if not (img.get("alt") or "").strip()]
    if missing_alt:
        penalty = min(20, len(missing_alt) * 8)
        score -= penalty
        issues.append(f"Missing text alternatives on {len(missing_alt)} image(s)")

    density = _formatting_density(combined_html)
    if density > 80:
        score -= 10
        issues.append("Dense HTML formatting")
    elif density > 45:
        score -= 5
        issues.append("Heavy formatting")

    if not combined_text and not images:
        score -= 30
        issues.append("Empty card")

    return max(0, min(100, score)), issues


def scan_deck(deck_id: int | None = None) -> dict[str, Any]:
    col = mw.col
    if col is None:
        return {"deckScore": 0, "deckName": "", "totalCards": 0, "issues": []}

    did = deck_id if deck_id is not None else col.decks.selected()
    deck_name = col.decks.name(did)
    card_ids = col.find_cards(f"did:{did}")

    card_results: list[dict[str, Any]] = []
    scores: list[int] = []

    for cid in card_ids:
        card = col.get_card(cid)
        note = card.note()
        fields_html = [note.fields[i] for i in range(len(note.fields))]
        card_score, issues = score_note_html(fields_html)
        scores.append(card_score)
        if issues:
            preview = _plain_text(fields_html[0] if fields_html else "")[:120]
            card_results.append(
                {
                    "cardId": cid,
                    "score": card_score,
                    "issues": issues,
                    "preview": preview,
                }
            )

    card_results.sort(key=lambda item: item["score"])
    deck_score = round(sum(scores) / len(scores)) if scores else 100

    return {
        "deckName": deck_name,
        "deckScore": deck_score,
        "totalCards": len(card_ids),
        "flaggedCards": len(card_results),
        "issues": card_results[:80],
    }
