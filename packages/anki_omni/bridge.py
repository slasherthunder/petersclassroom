"""JavaScript ↔ Python bridge for the reviewer webview."""

from __future__ import annotations

import json
from typing import Any

from aqt import mw
from aqt.qt import QKeySequence, QShortcut
from aqt.reviewer import Reviewer

from . import config, scanner, tts_engine

_shortcuts: list[QShortcut] = []


def _reviewer() -> Reviewer | None:
    reviewer = getattr(mw, "reviewer", None)
    return reviewer if isinstance(reviewer, Reviewer) else None


def _reviewer_web():
    reviewer = _reviewer()
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
    reviewer = _reviewer()
    if reviewer is None:
        return

    webviews: list[Any] = []
    bottom = getattr(reviewer, "bottom", None)
    if bottom is not None:
        web = getattr(bottom, "web", None)
        if web is not None:
            webviews.append(web)

    mw_bottom = getattr(mw, "bottomWeb", None)
    if mw_bottom is not None and mw_bottom not in webviews:
        webviews.append(mw_bottom)

    for web in webviews:
        try:
            if hidden:
                if hasattr(web, "hide"):
                    web.hide()
                elif hasattr(web, "setVisible"):
                    web.setVisible(False)
            elif hasattr(web, "show"):
                web.show()
            elif hasattr(web, "setVisible"):
                web.setVisible(True)
        except Exception:
            continue


def _card_html(side: str) -> str:
    reviewer = _reviewer()
    if reviewer is None or reviewer.card is None:
        return ""
    card = reviewer.card
    try:
        return card.question() if side == "question" else card.answer()
    except Exception:
        note = card.note()
        if side == "question":
            return note.fields[0] if note.fields else ""
        if len(note.fields) > 1:
            return " ".join(note.fields[1:])
        return note.fields[0] if note.fields else ""


def handle_js_message(handled: tuple[bool, Any], message: str, context: Any) -> tuple[bool, Any]:
    if not message.startswith("aoa:"):
        return handled

    if context is not None and not isinstance(context, Reviewer):
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
        tts_engine.speak(_card_html("question"))
        return (True, "ok")

    if message == "aoa:readAnswer":
        tts_engine.speak(_card_html("answer"))
        return (True, "ok")

    if message == "aoa:stopTts":
        tts_engine.stop()
        return (True, "ok")

    if message.startswith("aoa:hideDistractions:"):
        hidden = message.endswith(":1")
        try:
            _set_hide_distractions(hidden)
        except Exception:
            pass
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
        tts_engine.speak(_card_html("question"))
        return (True, "ok")

    if message == "aoa:autoReadAnswer":
        tts_engine.speak(_card_html("answer"))
        return (True, "ok")

    return handled


def _register_shortcuts() -> None:
    global _shortcuts
    for shortcut in _shortcuts:
        shortcut.deleteLater()
    _shortcuts = []

    cfg = config.load_config()
    mapping = {
        "readQuestion": lambda: tts_engine.speak(_card_html("question")),
        "readAnswer": lambda: tts_engine.speak(_card_html("answer")),
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


def on_reviewer_state(card) -> None:
    _register_shortcuts()
    _push_config()
    web = _reviewer_web()
    if web is not None:
        web.eval("window.AoaBoot && window.AoaBoot();")
    cfg = config.load_config()
    if not cfg.get("autoRead"):
        return
    reviewer = _reviewer()
    if reviewer is None:
        return
    side = "answer" if reviewer.state == "answer" else "question"
    tts_engine.speak(_card_html(side))


def on_leave_review() -> None:
    _set_hide_distractions(False)
    tts_engine.stop()
