/*
 * EasePass — background service worker (Manifest V3).
 *
 * Minimal responsibility:
 *   - On install, seed chrome.storage.local with default settings.
 *   - Provide a PING channel so popup/content can verify the worker
 *     is alive when troubleshooting.
 *
 * All real work runs in content.js on youtube.com. The popup writes
 * settings; content.js reads them and reacts via storage.onChanged.
 */

'use strict';

// Default settings — only written if the key is absent so we don't clobber
// the user's existing preferences on extension update.
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(
    ['enabled', 'videoDwellTime', 'buttonDwellTime'],
    (data) => {
      const updates = {};
      if (data.enabled === undefined)         updates.enabled = true;
      if (data.videoDwellTime === undefined)  updates.videoDwellTime = 5000;
      if (data.buttonDwellTime === undefined) updates.buttonDwellTime = 3000;
      if (Object.keys(updates).length) chrome.storage.local.set(updates);
    }
  );
});

// Lightweight message channel for diagnostics.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return;
  if (message.type === 'PING') {
    sendResponse({ ok: true, ts: Date.now() });
    return false;
  }
});
