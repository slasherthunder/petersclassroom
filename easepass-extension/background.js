/*
 * EasePass — background service worker (Manifest V3).
 *
 * Responsibilities:
 *   - Seed default settings on install.
 *   - Paint a toolbar badge that reflects whether dwell-click is
 *     active in the CURRENT tab's context. YouTube tabs follow the
 *     `enabled` flag; every other tab follows `universalEnabled`.
 *     Badge shows a ✓ when active, blank when off.
 *   - Provide a PING channel for diagnostics.
 */

'use strict';

// ───────── Defaults ─────────

const DEFAULTS = {
  enabled:            true,   // YouTube dwell-click
  universalEnabled:   true,   // every other site
  videoDwellTime:     5000,
  buttonDwellTime:    3000,
  universalDwellTime: 3000
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(Object.keys(DEFAULTS), (data) => {
    const updates = {};
    for (const k of Object.keys(DEFAULTS)) {
      if (data[k] === undefined) updates[k] = DEFAULTS[k];
    }
    if (Object.keys(updates).length) chrome.storage.local.set(updates);
    repaintBadgeForActiveTab();
  });
});

// ───────── Toolbar badge ─────────

function isYouTubeUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return /(^|\.)youtube\.com$/i.test(u.hostname);
  } catch (_) { return false; }
}

// Pick the right toggle for this tab, then paint the badge.
function repaintBadge(tab) {
  if (!tab || tab.id === undefined) return;
  chrome.storage.local.get(['enabled', 'universalEnabled'], (data) => {
    if (chrome.runtime.lastError) return;
    const active = isYouTubeUrl(tab.url)
      ? data.enabled !== false
      : data.universalEnabled !== false;

    const tabId = tab.id;
    try {
      if (active) {
        chrome.action.setBadgeText({ text: '✓', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#22C55E', tabId });
        if (chrome.action.setBadgeTextColor) {
          chrome.action.setBadgeTextColor({ color: '#ffffff', tabId });
        }
      } else {
        chrome.action.setBadgeText({ text: '', tabId });
      }
    } catch (_) {}
  });
}

function repaintBadgeForActiveTab() {
  try {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) return;
      repaintBadge(tabs && tabs[0]);
    });
  } catch (_) {}
}

// Tab focus changes.
chrome.tabs.onActivated.addListener(({ tabId }) => {
  try {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) return;
      repaintBadge(tab);
    });
  } catch (_) {}
});

// URL changes (SPA-style navigation, full reloads).
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;
  repaintBadge(tab);
});

if (chrome.windows && chrome.windows.onFocusChanged) {
  chrome.windows.onFocusChanged.addListener(() => repaintBadgeForActiveTab());
}

// Toggles changed via popup, content script, or another tab.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (!changes.enabled && !changes.universalEnabled) return;
  repaintBadgeForActiveTab();
});

// Initial paint after worker startup.
repaintBadgeForActiveTab();

// ───────── Diagnostic ping ─────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return;
  if (message.type === 'PING') {
    sendResponse({ ok: true, ts: Date.now() });
    return false;
  }
  if (message.type === 'OPEN_EXTENSION_PAGE' && typeof message.url === 'string') {
    chrome.tabs.create({ url: message.url }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ ok: true });
    });
    return true;
  }
});
