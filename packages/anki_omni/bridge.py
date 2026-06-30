"""JavaScript ↔ Python bridge for the reviewer webview."""

from __future__ import annotations

import json
from typing import Any

from aqt import mw
from aqt.qt import QKeySequence, QShortcut

from . import config, scanner, tts_engine

_shortcuts: list[QShortcut] = []


def _addon_package() -> str:
    return mw.addonManager.addonFromModule(__name__.rsplit(".", 1)[0])


def _reviewer_web():
    reviewer = getattr(mw, "reviewer", None)
    if reviewer is None:
        return None
    return getattr(reviewer, "web", None)


def _push_config() -> None:
    web = _reviewer_web()
    if web is None:
        return
    payload = json.dumps(config.load_config())
    web.eval(f"window.AoaBridge && window.AoaBridge.applyConfig({payload});")


def _set_hide_distractions(hidden: bool) -> None:
    reviewer = getattr(mw, "reviewer", None)
    if reviewer is None:
        return
    bottom = getattr(reviewer, "bottom", None)
    if bottom is not None:
        bottom.setVisible(not hidden)
    for attr in ("web",):
        widget = getattr(reviewer, attr, None)
        if widget is not None and hasattr(widget, "page"):
            pass


def _card_plain_text(side: str) -> str:
    reviewer = getattr(mw, "reviewer", None)
    if reviewer is None or reviewer.card is None:
        return ""
    card = reviewer.card
    note = card.note()
    if side == "question":
        idx = card.ord if hasattr(card, "ord") else 0
        if idx < len(note.fields):
            return note.fields[idx]
        return note.fields[0] if note.fields else ""
    parts = []
    for field in note.fields:
        parts.append(field)
    return " ".join(parts)


def handle_js_message(handled: tuple[bool, Any], message: str, context: Any) -> tuple[bool, Any]:
    if not message.startswith("aoa:"):
        return handled

    web = _reviewer_web()

    if message == "aoa:getConfig":
        return (True, json.dumps(config.load_config()))

    if message.startswith("aoa:saveConfig:"):
        try:
            data = json.loads(message[len("aoa:saveConfig:") :])
            config.save_config(data)
            _register_shortcuts()
            return (True, "ok")
        except Exception as exc:
            return (True, json.dumps({"error": str(exc)}))

    if message == "aoa:readQuestion":
        tts_engine.speak(_card_plain_text("question"))
        return (True, "ok")

    if message == "aoa:readAnswer":
        tts_engine.speak(_card_plain_text("answer"))
        return (True, "ok")

    if message == "aoa:stopTts":
        tts_engine.stop()
        return (True, "ok")

    if message.startswith("aoa:hideDistractions:"):
        hidden = message.endswith(":1")
        _set_hide_distractions(hidden)
        return (True, "ok")

    if message == "aoa:scanDeck":

        def task() -> dict[str, Any]:
            return scanner.scan_deck()

        def on_done(result: dict[str, Any]) -> None:
            if web is None:
                return
            encoded = json.dumps(result)
            web.eval(f"window.AoaBridge && window.AoaBridge.onScanResult({encoded});")

        mw.taskman.run_in_background(task, on_done)
        return (True, "pending")

    if message == "aoa:autoReadQuestion":
        tts_engine.speak(_card_plain_text("question"))
        return (True, "ok")

    if message == "aoa:autoReadAnswer":
        tts_engine.speak(_card_plain_text("answer"))
        return (True, "ok")

    return handled


def _register_shortcuts() -> None:
    global _shortcuts
    for shortcut in _shortcuts:
        shortcut.deleteLater()
    _shortcuts = []

    cfg = config.load_config()
    mapping = {
        "readQuestion": lambda: tts_engine.speak(_card_plain_text("question")),
        "readAnswer": lambda: tts_engine.speak(_card_plain_text("answer")),
        "toggleToolbar": _toggle_toolbar,
    }

    for key_name, handler in mapping.items():
        seq = cfg.get("shortcuts", {}).get(key_name)
        if not seq:
            continue
        shortcut = QShortcut(QKeySequence(seq), mw)
        shortcut.activated.connect(handler)
        _shortcuts.append(shortcut)


def _toggle_toolbar() -> None:
    web = _reviewer_web()
    if web is None:
        return
    web.eval("window.AoaBridge && window.AoaBridge.toggleToolbar();")


def on_reviewer_state() -> None:
    _register_shortcuts()
    _push_config()
    cfg = config.load_config()
    if cfg.get("autoRead"):
        side = "answer" if getattr(mw.reviewer, "state", "") == "answer" else "question"
        tts_engine.speak(_card_plain_text(side))
