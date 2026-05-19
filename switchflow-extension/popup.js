/*
 * SwitchFlow — popup controller (dwell clicking).
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

const toggleEl   = document.getElementById('toggle');
const statusEl   = document.getElementById('status');
const videoEl    = document.getElementById('videoSpeed');
const videoValEl = document.getElementById('videoVal');
const buttonEl   = document.getElementById('buttonSpeed');
const buttonValEl = document.getElementById('buttonVal');

// ───────── Initial load ─────────

// Pull saved state and paint the UI.
chrome.storage.local.get(
  ['enabled', 'videoDwellTime', 'buttonDwellTime'],
  (data) => {
    const enabled         = data.enabled !== false;
    const videoDwellTime  = Number(data.videoDwellTime)  || 5000;
    const buttonDwellTime = Number(data.buttonDwellTime) || 3000;

    paintToggle(enabled);
    paintStatus(enabled);

    videoEl.value = videoDwellTime;
    videoValEl.textContent = videoDwellTime;

    buttonEl.value = buttonDwellTime;
    buttonValEl.textContent = buttonDwellTime;
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

// ───────── External changes ─────────

// If another popup (or future settings page) writes to storage, mirror
// the change in this popup's UI so they don't drift.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.enabled) {
    const enabled = changes.enabled.newValue !== false;
    paintToggle(enabled);
    paintStatus(enabled);
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
