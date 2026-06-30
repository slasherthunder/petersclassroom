"""Persistent add-on configuration."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from aqt import mw

DEFAULT_CONFIG: dict[str, Any] = {
    "fontSize": 100,
    "fontFamily": "default",
    "lineSpacing": 1.5,
    "letterSpacing": 0,
    "wordSpacing": 0,
    "contrast": "default",
    "largeUi": False,
    "focusMode": False,
    "readingRuler": False,
    "rulerFollow": "cursor",
    "progressiveReveal": False,
    "hideDistractions": False,
    "dwellClick": False,
    "dwellMs": 800,
    "largeButtons": False,
    "keyboardNav": True,
    "autoRead": False,
    "toolbarX": 12,
    "toolbarY": 12,
    "shortcuts": {
        "readQuestion": "Alt+Q",
        "readAnswer": "Alt+A",
        "toggleToolbar": "Alt+Shift+A",
    },
}


def _addon_name() -> str:
    return __name__.split(".")[0]


def load_config() -> dict[str, Any]:
    mgr = mw.addonManager
    name = _addon_name()
    stored = mgr.getConfig(name)
    if not stored:
        return deepcopy(DEFAULT_CONFIG)
    merged = deepcopy(DEFAULT_CONFIG)
    merged.update(stored)
    if isinstance(stored.get("shortcuts"), dict):
        merged["shortcuts"] = {**DEFAULT_CONFIG["shortcuts"], **stored["shortcuts"]}
    return merged


def save_config(config: dict[str, Any]) -> None:
    mw.addonManager.writeConfig(_addon_name(), config)
