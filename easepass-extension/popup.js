/*
 * Accessibility Surfer — popup controller (dwell clicking + text accessibility).
 *
 * Persists to chrome.storage.local:
 *   - enabled            (boolean, YouTube dwell master switch)
 *   - universalEnabled   (boolean, every-other-site dwell switch)
 *   - videoDwellTime     (ms, dwell time for video thumbnails)
 *   - buttonDwellTime    (ms, dwell time for buttons/controls)
 *   - universalDwellTime (ms, dwell time on non-YouTube sites)
 *   - easepass-text-settings (object: font / size / spacing / line-height)
 *
 * Dwell times are floored at DWELL_FLOOR_MS so a momentary cursor pause
 * can never trigger a click — important for the motor-impaired users who
 * are the primary audience.
 *
 * content.js listens to storage changes and applies them immediately,
 * so every open tab updates without a reload. Each save flashes a brief
 * "Saved ✓" confirmation (also announced to screen readers).
 *
 * The popup itself is fully keyboard navigable: tab cycles controls,
 * space/enter operate the toggles, arrows move the sliders.
 */

'use strict';

// Hard floor for every dwell slider. Mirrors the min= on the range inputs
// in popup.html; also enforced here so any older stored value below it is
// clamped up on load.
const DWELL_FLOOR_MS = 1000;

// Write to local storage and flash the "Saved ✓" confirmation. Centralizes
// every persistence path so feedback is consistent and a dead/invalidated
// extension context can't throw.
function saveLocal(obj) {
  try {
    chrome.storage.local.set(obj, () => {
      if (chrome.runtime && chrome.runtime.lastError) return;
      showSaved();
    });
  } catch (_) {}
}

// ── YouTube section ──
const toggleEl    = document.getElementById('toggle');
const statusEl    = document.getElementById('status');
const videoEl     = document.getElementById('videoSpeed');
const videoValEl  = document.getElementById('videoVal');
const buttonEl    = document.getElementById('buttonSpeed');
const buttonValEl = document.getElementById('buttonVal');

// ── Universal (every other site) section ──
const universalToggleEl = document.getElementById('universalToggle');
const universalStatusEl = document.getElementById('universalStatus');
const universalSpeedEl  = document.getElementById('universalSpeed');
const universalValEl    = document.getElementById('universalVal');

// ───────── Initial load ─────────

// Pull saved state and paint the UI.
chrome.storage.local.get(
  ['enabled', 'universalEnabled', 'videoDwellTime', 'buttonDwellTime', 'universalDwellTime'],
  (data) => {
    const enabled           = data.enabled !== false;
    const universalEnabled  = data.universalEnabled !== false;
    const clampDwell = (v, dflt) => Math.max(DWELL_FLOOR_MS, Number(v) || dflt);
    const videoDwellTime     = clampDwell(data.videoDwellTime,     5000);
    const buttonDwellTime    = clampDwell(data.buttonDwellTime,    3000);
    const universalDwellTime = clampDwell(data.universalDwellTime, 3000);

    // Persist any value we had to clamp up from a pre-floor stored setting
    // so content.js never reads an unsafe sub-floor dwell time. Only rewrite
    // keys that were actually stored below the floor — never write defaults
    // on a fresh install where nothing is stored yet.
    const clamped = {};
    const belowFloor = (raw) => {
      const n = Number(raw);
      return Number.isFinite(n) && n < DWELL_FLOOR_MS;
    };
    if (belowFloor(data.videoDwellTime))     clamped.videoDwellTime     = videoDwellTime;
    if (belowFloor(data.buttonDwellTime))    clamped.buttonDwellTime    = buttonDwellTime;
    if (belowFloor(data.universalDwellTime)) clamped.universalDwellTime = universalDwellTime;
    if (Object.keys(clamped).length) {
      try { chrome.storage.local.set(clamped); } catch (_) {}
    }

    // YouTube section
    paintToggle(enabled);
    paintStatus(enabled);
    videoEl.value         = videoDwellTime;
    videoValEl.textContent = videoDwellTime;
    buttonEl.value        = buttonDwellTime;
    buttonValEl.textContent = buttonDwellTime;

    // Universal section
    paintUniversalToggle(universalEnabled);
    paintUniversalStatus(universalEnabled);
    universalSpeedEl.value = universalDwellTime;
    universalValEl.textContent = universalDwellTime;
  }
);

// ───────── Toggle ─────────

toggleEl.addEventListener('click', () => {
  const next = toggleEl.getAttribute('aria-checked') !== 'true';
  paintToggle(next);
  paintStatus(next);
  saveLocal({ enabled: next });
});

// Space / Enter activates the role="switch" button.
toggleEl.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    toggleEl.click();
  }
});

// ───────── Sliders ─────────

videoEl.addEventListener('input', () => {
  const v = parseInt(videoEl.value, 10);
  videoValEl.textContent = v;
  saveLocal({ videoDwellTime: v });
});

buttonEl.addEventListener('input', () => {
  const v = parseInt(buttonEl.value, 10);
  buttonValEl.textContent = v;
  saveLocal({ buttonDwellTime: v });
});

// ── Universal toggle ──
universalToggleEl.addEventListener('click', () => {
  const next = universalToggleEl.getAttribute('aria-checked') !== 'true';
  paintUniversalToggle(next);
  paintUniversalStatus(next);
  saveLocal({ universalEnabled: next });
});
universalToggleEl.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    universalToggleEl.click();
  }
});

// ── Universal dwell-time slider ──
universalSpeedEl.addEventListener('input', () => {
  const v = parseInt(universalSpeedEl.value, 10);
  universalValEl.textContent = v;
  saveLocal({ universalDwellTime: v });
});

// ───────── External changes ─────────

// If another popup (or another tab) writes to storage, mirror the change
// in this popup's UI so they don't drift. One listener covers every key —
// dwell settings and the text-settings object both flow through here.
chrome.storage.onChanged.addListener((changes, area) => {
  try {
    if (area !== 'local') return;
    if (changes.enabled) {
      const v = changes.enabled.newValue !== false;
      paintToggle(v);
      paintStatus(v);
    }
    if (changes.universalEnabled) {
      const v = changes.universalEnabled.newValue !== false;
      paintUniversalToggle(v);
      paintUniversalStatus(v);
    }
    if (changes.videoDwellTime) {
      const v = Number(changes.videoDwellTime.newValue) || 5000;
      videoEl.value = v;
      videoValEl.textContent = v;
    }
    if (changes.buttonDwellTime) {
      const v = Number(changes.buttonDwellTime.newValue) || 3000;
      buttonEl.value = v;
      buttonValEl.textContent = v;
    }
    if (changes.universalDwellTime) {
      const v = Number(changes.universalDwellTime.newValue) || 3000;
      universalSpeedEl.value = v;
      universalValEl.textContent = v;
    }
    if (changes[TA_STORAGE_KEY]) {
      const next = changes[TA_STORAGE_KEY].newValue;
      taSettings = next ? { ...TA_DEFAULTS, ...next } : { ...TA_DEFAULTS };
      paintTextSettings();
    }
  } catch (_) {}
});

// ───────── Text accessibility (all inline in this popup) ─────────
// All controls write to chrome.storage.local under the same key the
// content script listens on. When the content script's storage.onChanged
// handler fires, it re-applies the page-level CSS instantly.

const TA_STORAGE_KEY = 'easepass-text-settings';
const TA_DEFAULTS = {
  fontFamily:    'default',
  textSize:      100,
  letterSpacing: 'normal',
  wordSpacing:   'normal',
  lineHeight:    'normal'
};

let taSettings = { ...TA_DEFAULTS };

const taFontBtns       = document.querySelectorAll('.ta-font-btn');
const taSizeSlider     = document.getElementById('ta-text-size');
const taSizeValue      = document.getElementById('ta-text-size-value');
const taSizeResetLink  = document.querySelector('.ta-reset-link[data-reset="textSize"]');
const taLetterBtns     = document.querySelectorAll('.ta-pill-btn[data-letter]');
const taWordBtns       = document.querySelectorAll('.ta-pill-btn[data-word]');
const taLineBtns       = document.querySelectorAll('.ta-pill-btn[data-line]');
const taResetAllBtn    = document.getElementById('ta-reset-all');

// Load saved text settings into the UI.
chrome.storage.local.get([TA_STORAGE_KEY], (data) => {
  if (chrome.runtime.lastError) return;
  const stored = data[TA_STORAGE_KEY];
  if (stored && typeof stored === 'object') {
    taSettings = { ...TA_DEFAULTS, ...stored };
  }
  paintTextSettings();
});

// Persist + repaint after any change.
function commitTextSettings() {
  saveLocal({ [TA_STORAGE_KEY]: taSettings });
  paintTextSettings();
}

// Reflect taSettings back into every control's pressed/value state.
function paintTextSettings() {
  taFontBtns.forEach(b =>
    b.setAttribute('aria-pressed',
      b.dataset.font === taSettings.fontFamily ? 'true' : 'false'));

  if (taSizeSlider) taSizeSlider.value = String(taSettings.textSize);
  if (taSizeValue)  taSizeValue.textContent = String(taSettings.textSize);

  taLetterBtns.forEach(b =>
    b.setAttribute('aria-pressed',
      b.dataset.letter === taSettings.letterSpacing ? 'true' : 'false'));

  taWordBtns.forEach(b =>
    b.setAttribute('aria-pressed',
      b.dataset.word === taSettings.wordSpacing ? 'true' : 'false'));

  taLineBtns.forEach(b =>
    b.setAttribute('aria-pressed',
      b.dataset.line === taSettings.lineHeight ? 'true' : 'false'));
}

// ── Font picker ──
taFontBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    taSettings.fontFamily = btn.dataset.font;
    commitTextSettings();
  });
});

// ── Size slider ──
if (taSizeSlider) {
  taSizeSlider.addEventListener('input', () => {
    taSettings.textSize = Number(taSizeSlider.value);
    commitTextSettings();
  });
}
if (taSizeResetLink) {
  taSizeResetLink.addEventListener('click', () => {
    taSettings.textSize = TA_DEFAULTS.textSize;
    commitTextSettings();
  });
}

// ── Letter / word / line pills ──
taLetterBtns.forEach(b => b.addEventListener('click', () => {
  taSettings.letterSpacing = b.dataset.letter;
  commitTextSettings();
}));
taWordBtns.forEach(b => b.addEventListener('click', () => {
  taSettings.wordSpacing = b.dataset.word;
  commitTextSettings();
}));
taLineBtns.forEach(b => b.addEventListener('click', () => {
  taSettings.lineHeight = b.dataset.line;
  commitTextSettings();
}));

// ── Reset all ──
if (taResetAllBtn) {
  taResetAllBtn.addEventListener('click', () => {
    taSettings = { ...TA_DEFAULTS };
    commitTextSettings();
  });
}

// (External text-setting changes are handled by the single
// storage.onChanged listener above, alongside the dwell settings.)

// ───────── Save confirmation ─────────

// Flash the "Saved ✓" pill. Debounced so dragging a slider (which fires
// many input events) shows one steady confirmation that clears ~1s after
// the last change rather than strobing.
const saveToastEl = document.getElementById('saveToast');
let saveToastTimer = null;
function showSaved() {
  if (!saveToastEl) return;
  saveToastEl.classList.add('visible');
  saveToastEl.setAttribute('aria-hidden', 'false');
  clearTimeout(saveToastTimer);
  saveToastTimer = setTimeout(() => {
    saveToastEl.classList.remove('visible');
    saveToastEl.setAttribute('aria-hidden', 'true');
  }, 1100);
}

// ───────── Paint helpers ─────────

// Set the role="switch" on/off visual.
function paintToggle(on) {
  toggleEl.setAttribute('aria-checked', on ? 'true' : 'false');
}

// Update the small status line under the toggle label.
function paintStatus(on) {
  statusEl.textContent = on ? 'Active on YouTube' : 'Disabled';
  statusEl.classList.toggle('on', on);
}

// Universal toggle visual.
function paintUniversalToggle(on) {
  universalToggleEl.setAttribute('aria-checked', on ? 'true' : 'false');
}

// Universal status line.
function paintUniversalStatus(on) {
  universalStatusEl.textContent = on ? 'Active everywhere' : 'Disabled';
  universalStatusEl.classList.toggle('on', on);
}

// ───────── Reading Mode ─────────
// Persists easepass-reading-mode-enabled and easepass-reading-mode-memory.
// The actual overlay lives in the content script (reading-mode.js); here we
// just store preferences and provide an immediate "open" action + a memory
// reset. Reading mode never sends page content anywhere.

const RM_ENABLED_KEY = 'easepass-reading-mode-enabled';
const RM_MEMORY_KEY  = 'easepass-reading-mode-memory';
const RM_DOMAINS_KEY = 'easepass-reading-mode-domains';

const rmToggleEl   = document.getElementById('rmToggle');
const rmStatusEl   = document.getElementById('rmStatus');
const rmMemoryEl   = document.getElementById('rmMemoryToggle');
const rmOpenEl     = document.getElementById('rmOpen');
const rmClearEl    = document.getElementById('rmClearMemory');

function paintRm(enabled, memory) {
  if (rmToggleEl) rmToggleEl.setAttribute('aria-checked', enabled ? 'true' : 'false');
  if (rmStatusEl) {
    rmStatusEl.textContent = enabled ? 'Active' : 'Off';
    rmStatusEl.classList.toggle('on', enabled);
  }
  if (rmMemoryEl) rmMemoryEl.setAttribute('aria-checked', memory ? 'true' : 'false');
}

// Load saved reading-mode prefs (memory defaults on).
chrome.storage.local.get([RM_ENABLED_KEY, RM_MEMORY_KEY], (data) => {
  try {
    if (chrome.runtime.lastError) return;
    paintRm(data[RM_ENABLED_KEY] === true, data[RM_MEMORY_KEY] !== false);
  } catch (_) {}
});

if (rmToggleEl) {
  rmToggleEl.addEventListener('click', () => {
    const next = rmToggleEl.getAttribute('aria-checked') !== 'true';
    rmToggleEl.setAttribute('aria-checked', next ? 'true' : 'false');
    if (rmStatusEl) {
      rmStatusEl.textContent = next ? 'Active' : 'Off';
      rmStatusEl.classList.toggle('on', next);
    }
    saveLocal({ [RM_ENABLED_KEY]: next });
  });
  rmToggleEl.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); rmToggleEl.click(); }
  });
}

if (rmMemoryEl) {
  rmMemoryEl.addEventListener('click', () => {
    const next = rmMemoryEl.getAttribute('aria-checked') !== 'true';
    rmMemoryEl.setAttribute('aria-checked', next ? 'true' : 'false');
    saveLocal({ [RM_MEMORY_KEY]: next });
  });
  rmMemoryEl.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); rmMemoryEl.click(); }
  });
}

// Open reading mode on the active tab immediately.
if (rmOpenEl) {
  rmOpenEl.addEventListener('click', () => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError || !tabs || !tabs[0]) return;
        try {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_READING_MODE' }, () => {
            void chrome.runtime.lastError; // ignore "no receiver" on non-content pages
          });
        } catch (_) {}
        window.close();
      });
    } catch (_) {}
  });
}

// Clear all remembered reading-mode domains.
if (rmClearEl) {
  rmClearEl.addEventListener('click', () => {
    try {
      chrome.storage.local.remove(RM_DOMAINS_KEY, () => {
        void chrome.runtime.lastError;
        showSaved();
      });
    } catch (_) {}
  });
}
