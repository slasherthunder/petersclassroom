/*
 * Accessibility Surfer — Reading Mode trigger.
 *
 * Tiny bootstrap that runs after content.js + reading-mode.js: offers the
 * "reading mode available" pill on remembered article domains and binds the
 * Alt+R shortcut. Toggling is delegated to content.js via a same-frame event
 * (content.js owns the dwell-aware coordination).
 */

(function () {
  'use strict';

  function isAlive() {
    try { return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id; }
    catch (_) { return false; }
  }

  // Article-like if there's an <article>, or > 400 words of paragraph text.
  function looksLikeArticle() {
    if (document.querySelector('article')) return true;
    var ps = document.querySelectorAll('p');
    var words = 0;
    for (var i = 0; i < ps.length; i++) {
      words += (ps[i].textContent || '').split(/\s+/).length;
      if (words > 400) return true;
    }
    return false;
  }

  // Alt+R toggles reading mode (works on any page).
  document.addEventListener('keydown', function (e) {
    if (e.altKey && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      try { window.dispatchEvent(new CustomEvent('easepass-rm-toggle')); } catch (_) {}
    }
  }, true);

  if (!looksLikeArticle() || !isAlive() || !window.EasePassReadingMode) return;

  // Offer the pill on remembered domains, unless site memory is turned off.
  try {
    chrome.storage.local.get(['easepass-reading-mode-memory'], function (data) {
      try {
        if (chrome.runtime && chrome.runtime.lastError) return;
        if (data && data['easepass-reading-mode-memory'] === false) return;
        window.EasePassReadingMode.maybeShowPill();
      } catch (_) {}
    });
  } catch (_) {}
})();
