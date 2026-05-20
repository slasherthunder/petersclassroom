/*
 * EasePass — popup controller (dwell clicking).
 *
 * Persists three settings to chrome.storage.local:
 *   - enabled         (boolean, master switch)
 *   - videoDwellTime  (ms, dwell time for video thumbnails)
 *   - buttonDwellTime (ms, dwell time for buttons/controls)
 *
 * content.js listens to storage changes and applies them immediately,
 * so the active YouTube tab updates without a reload.
 *
 * The popup itself is fully keyboard navigable: tab cycles controls,
 * space/enter operate the toggle, arrows move the sliders.
 */

'use strict';

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
    const videoDwellTime    = Number(data.videoDwellTime)     || 5000;
    const buttonDwellTime   = Number(data.buttonDwellTime)    || 3000;
    const universalDwellTime = Number(data.universalDwellTime) || 3000;

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
  chrome.storage.local.set({ enabled: next });
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
  chrome.storage.local.set({ videoDwellTime: v });
});

buttonEl.addEventListener('input', () => {
  const v = parseInt(buttonEl.value, 10);
  buttonValEl.textContent = v;
  chrome.storage.local.set({ buttonDwellTime: v });
});

// ── Universal toggle ──
universalToggleEl.addEventListener('click', () => {
  const next = universalToggleEl.getAttribute('aria-checked') !== 'true';
  paintUniversalToggle(next);
  paintUniversalStatus(next);
  chrome.storage.local.set({ universalEnabled: next });
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
  chrome.storage.local.set({ universalDwellTime: v });
});

// ───────── External changes ─────────

// If another popup (or future settings page) writes to storage, mirror
// the change in this popup's UI so they don't drift.
chrome.storage.onChanged.addListener((changes, area) => {
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
  try {
    chrome.storage.local.set({ [TA_STORAGE_KEY]: taSettings });
  } catch (_) {}
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

// React to external changes (another popup window, another tab).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (!changes[TA_STORAGE_KEY]) return;
  const next = changes[TA_STORAGE_KEY].newValue;
  taSettings = next ? { ...TA_DEFAULTS, ...next } : { ...TA_DEFAULTS };
  paintTextSettings();
});

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
