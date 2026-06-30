"""Anki GUI hook registration."""

from __future__ import annotations

from aqt import gui_hooks, mw

from . import bridge, config


def _on_webview_will_set_content(webview, context) -> None:
    if context.context != "reviewer":
        return
    package = mw.addonManager.addonFromModule(__name__.split(".")[0])
    base = f"/_addons/{package}/web"
    context.css.append(f"{base}/reviewer.css")
    context.js.append(f"{base}/reviewer.js")


def _open_config() -> None:
    from aqt.utils import showInfo

    cfg = config.load_config()
    showInfo(
        "Anki Omni Accessibility stores settings in the reviewer toolbar.\n\n"
        f"Current font size: {cfg.get('fontSize', 100)}%\n"
        f"Dwell click: {'on' if cfg.get('dwellClick') else 'off'}\n\n"
        "Use Tools → Anki Omni Accessibility → Reset settings to restore defaults."
    )


def _reset_config() -> None:
    from copy import deepcopy

    from aqt.utils import askUser

    if askUser("Reset all Anki Omni Accessibility settings to defaults?"):
        config.save_config(deepcopy(config.DEFAULT_CONFIG))
        bridge._push_config()


def _setup_menu() -> None:
    from aqt.qt import QAction

    menu = mw.form.menuTools
    submenu = menu.addMenu("Anki Omni Accessibility")
    act_config = QAction("About settings…", mw)
    act_config.triggered.connect(_open_config)
    submenu.addAction(act_config)
    act_reset = QAction("Reset settings to defaults", mw)
    act_reset.triggered.connect(_reset_config)
    submenu.addAction(act_reset)


def register_hooks() -> None:
    mw.addonManager.setWebExports(__name__.split(".")[0], r"web/.*\.(js|css|woff|woff2)")
    gui_hooks.webview_will_set_content.append(_on_webview_will_set_content)
    gui_hooks.webview_did_receive_js_message.append(bridge.handle_js_message)
    gui_hooks.reviewer_did_show_question.append(lambda _card: bridge.on_reviewer_state())
    gui_hooks.reviewer_did_show_answer.append(lambda _card: bridge.on_reviewer_state())
    gui_hooks.main_window_did_init.append(lambda _mw: _setup_menu())
    gui_hooks.main_window_did_init.append(lambda _mw: bridge._register_shortcuts())
