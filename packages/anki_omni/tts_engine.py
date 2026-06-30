"""Local text-to-speech via Qt (no network)."""

from __future__ import annotations

import re

_tts = None


def _strip_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _get_tts():
    global _tts
    if _tts is not None:
        return _tts
    try:
        from PyQt6.QtTextToSpeech import QTextToSpeech

        _tts = QTextToSpeech()
    except Exception:
        try:
            from PyQt5.QtTextToSpeech import QTextToSpeech

            _tts = QTextToSpeech()
        except Exception:
            _tts = False
    return _tts


def speak(text: str) -> bool:
    plain = _strip_html(text)
    if not plain:
        return False
    engine = _get_tts()
    if engine and engine is not False:
        engine.say(plain)
        return True
    return _speak_fallback(plain)


def stop() -> None:
    engine = _get_tts()
    if engine and engine is not False:
        engine.stop()


def _speak_fallback(text: str) -> bool:
    import platform
    import subprocess

    system = platform.system()
    try:
        if system == "Darwin":
            subprocess.Popen(["say", text[:4000]])
            return True
        if system == "Windows":
            import win32com.client  # type: ignore

            speaker = win32com.client.Dispatch("SAPI.SpVoice")
            speaker.Speak(text[:4000])
            return True
        if system == "Linux":
            subprocess.Popen(["spd-say", text[:4000]])
            return True
    except Exception:
        pass
    return False
