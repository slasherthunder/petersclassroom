# Anki Omni Accessibility

Complete accessibility toolbar for [Anki](https://apps.ankiweb.net/) — visual, focus, motor, local text-to-speech, and deck scanner. Built by [Axol Assist](https://axolassist.com/anki-omni/).

**Offline-first.** TTS uses your device voice only. No network calls.

## Features

### Visual accessibility
- Font size increase/decrease
- Font family switcher (default, sans, serif, OpenDyslexic bundled locally)
- Line, letter, and word spacing controls (injected into reviewer HTML)
- High contrast, dark, and light modes
- Large UI and large button modes

### Focus + reading modes
- Focus mode — dims everything except the card
- Reading ruler — horizontal highlight following cursor or fixed center line
- Progressive reveal — show answer content step-by-step
- Hide distractions — minimal reviewer chrome and in-card clutter

### Motor accessibility
- Dwell clicking (hover for N ms to trigger click)
- Large button targets
- Keyboard focus highlights
- Shortcuts: **Alt+Q** read question, **Alt+A** read answer, **Alt+Shift+A** toggle toolbar

### Text-to-speech (local only)
- Qt `QTextToSpeech` with OS fallbacks (`say`, SAPI, `spd-say`)
- **Read Question** and **Read Answer** buttons
- Auto-read when each card is shown

### Accessibility scanner
Per-deck heuristic scan for:
- Overly long cards
- Low readability (sentence length)
- Image-only cards
- Missing image alt text
- Dense HTML formatting

Outputs an **Accessibility Score (0–100)** and issue list in the Scanner panel.

### Toolbar UI
Floating, draggable toolbar in the reviewer with panels: Font, Spacing, Contrast, Focus, Scanner, TTS, Motor. Designed to stay compact and not block flashcard content.

## Requirements

- Anki 2.1.45+ (Qt5 or Qt6)
- macOS, Windows, or Linux

## Install (development)

```bash
# From repo root
chmod +x packages/anki_omni/scripts/build-addon.sh
packages/anki_omni/scripts/build-addon.sh
```

Then in Anki: **Tools → Add-ons → Install from file…** and select `dist/anki_omni_accessibility-v0.1.0.ankiaddon`.

**Or symlink for live development:**

```bash
ln -sf "$(pwd)/packages/anki_omni" \
  "$HOME/Library/Application Support/Anki2/addons21/anki_omni_accessibility"
```

Restart Anki, open the reviewer, and look for the floating toolbar (top-left by default; drag to reposition).

## Project layout

```
packages/anki_omni/
  __init__.py          # Entry point
  manifest.json        # Anki add-on metadata
  config.py            # Persistent settings
  hooks.py             # gui_hooks registration
  bridge.py            # JS ↔ Python (TTS, scanner, shortcuts)
  scanner.py           # Deck scoring heuristics
  tts_engine.py        # Local TTS
  web/
    reviewer.js        # Toolbar + in-reviewer features
    reviewer.css       # Visual / focus / toolbar styles
    fonts/             # OpenDyslexic (bundled)
```

## Verify

1. Install the add-on and restart Anki
2. Open any deck in the reviewer
3. Confirm the toolbar appears and is draggable
4. Open **Font** → change size; card text should update
5. Open **Scanner** → **Scan current deck** → score and issues appear
6. Open **TTS** → **Read Question** — hear local system voice

## License

MIT · Axol Assist
