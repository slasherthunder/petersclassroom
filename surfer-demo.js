/*
 * Accessibility Surfer — live marketing-site demo engine.
 *
 * Gives visitors a REAL try of the extension's two headline features right
 * on the website, without installing anything:
 *   - Dwell clicking: hover any link/button, watch the ring fill, it clicks.
 *   - Reading mode: a genuine distraction-free overlay of the page content.
 *
 * The dwell engine is a self-contained port of the extension's content.js
 * universal-mode logic (same ring visuals, same target rules, same Space
 * toggle). Reading mode reuses the extension's actual reading-mode.js +
 * reading-mode.css so the demo can never drift from the real thing.
 *
 * Everything runs locally. No chrome.* APIs are required — reading-mode.js
 * degrades gracefully when the extension runtime is absent.
 *
 * If the real extension is installed it already provides dwell clicking and
 * reading mode on this page, so this demo stands down to avoid double rings.
 *
 * Exposes window.SurferDemo for script.js to drive from the popup preview.
 */
(function () {
  'use strict';

  if (window.SurferDemo) return; // already loaded

  // ───────── Constants (mirror content.js) ─────────
  var COMPLETE_FLASH_MS = 380;   // green flash + ripple before the click
  var FADE_OUT_MS = 180;         // ring fade-out on cursor leave
  var RESUME_WINDOW_MS = 1000;   // resume-on-return grace period
  var RING_BOX = 56;
  var RING_RADIUS = 26;
  var RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
  var UNIVERSAL_MIN_W = 22;
  var UNIVERSAL_MIN_H = 18;
  var UNIVERSAL_SELECTOR = [
    'a[href]:not([href="#"]):not([href^="javascript:"])',
    'button:not([disabled]):not([aria-hidden="true"])',
    '[role="button"]:not([aria-disabled="true"]):not([aria-hidden="true"])',
    'input:not([type="hidden"]):not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'summary',
    'label',
    '[role="link"]',
    '[role="menuitem"]',
    '[role="menuitemcheckbox"]',
    '[role="menuitemradio"]',
    '[role="tab"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="switch"]',
    '[role="option"]',
    '[contenteditable="true"]',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  // ───────── State ─────────
  var enabled = false;       // live dwell on/off (driven by the preview toggle)
  var dwellTime = 3000;      // ms, from the preview "Dwell time" slider
  var active = null;         // current dwell session
  var lastSession = null;    // resume-on-return memory
  var statusEl = null;
  var statusState = null;

  // True when the real extension is running on this page — detected by the
  // panel buttons it injects. Checked lazily so a late-injecting extension
  // still wins. When present, this demo never starts a dwell of its own.
  function extensionActive() {
    return !!(document.getElementById('easepass-popup-btn') ||
              document.getElementById('easepass-aa-btn'));
  }

  // ───────── Styles ─────────
  // Copied verbatim from content.css so the demo ring/status/toast look
  // identical to the installed extension.
  function injectStyles() {
    if (document.getElementById('surfer-demo-style')) return;
    var css = [
      '.easepass-ring-container{position:fixed!important;pointer-events:none!important;z-index:2147483630!important;width:56px!important;height:56px!important;transform:translate(-50%,-50%) scale(0.88)!important;opacity:0!important;transition:opacity .1s ease,transform .14s cubic-bezier(.34,1.56,.64,1)!important;will-change:transform,opacity,left,top!important;}',
      '.easepass-ring-container.easepass-visible{opacity:1!important;transform:translate(-50%,-50%) scale(1)!important;}',
      '.easepass-ring-halo{position:absolute!important;inset:4px!important;border-radius:50%!important;background:radial-gradient(circle,rgba(255,255,255,.92) 0%,rgba(255,255,255,.78) 45%,rgba(255,255,255,0) 90%)!important;box-shadow:0 4px 14px rgba(0,102,255,.18),0 2px 6px rgba(0,0,0,.1)!important;pointer-events:none!important;}',
      '.easepass-ring-ripple{position:absolute!important;inset:0!important;border-radius:50%!important;border:3px solid #22C55E!important;opacity:0!important;pointer-events:none!important;}',
      '.easepass-ring-svg{position:absolute!important;top:0!important;left:0!important;width:100%!important;height:100%!important;overflow:visible!important;filter:drop-shadow(0 0 6px rgba(0,102,255,.35))!important;}',
      '.easepass-ring-track{fill:none!important;stroke:rgba(15,20,25,.2)!important;stroke-width:3!important;}',
      '.easepass-ring-progress{fill:none!important;stroke:#0066FF!important;stroke-width:5!important;stroke-linecap:round!important;transition:stroke-dashoffset 50ms linear,stroke .1s ease!important;}',
      '.easepass-ring-progress.easepass-complete{stroke:#22C55E!important;}',
      '.easepass-ring-count{position:absolute!important;top:50%!important;left:50%!important;transform:translate(-50%,-50%)!important;font-family:"Lexend",-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif!important;font-weight:800!important;font-size:18px!important;line-height:1!important;color:#0066FF!important;text-align:center!important;text-shadow:0 0 6px rgba(255,255,255,.85),0 0 2px rgba(255,255,255,.9)!important;pointer-events:none!important;user-select:none!important;transition:color .1s ease,transform .18s cubic-bezier(.34,1.56,.64,1)!important;}',
      '.easepass-ring-count.easepass-complete{color:#22C55E!important;transform:translate(-50%,-50%) scale(1.15)!important;}',
      '.easepass-ring-container.easepass-completing{transform:translate(-50%,-50%) scale(1.18)!important;}',
      '.easepass-ring-container.easepass-completing .easepass-ring-ripple{animation:easepass-ripple 380ms ease-out forwards!important;}',
      '@keyframes easepass-ripple{0%{transform:scale(1);opacity:.9;border-width:4px;}60%{opacity:.45;border-width:2px;}100%{transform:scale(1.9);opacity:0;border-width:1px;}}',
      '.easepass-status{position:fixed!important;top:24px!important;left:50%!important;transform:translateX(-50%) translateY(-8px)!important;z-index:2147483639!important;display:inline-flex!important;align-items:center!important;gap:9px!important;padding:8px 16px 8px 14px!important;background:rgba(15,20,25,.92)!important;color:#fff!important;font-family:"Lexend",-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif!important;font-weight:600!important;font-size:13px!important;line-height:1!important;letter-spacing:.01em!important;white-space:nowrap!important;border-radius:999px!important;box-shadow:0 6px 20px rgba(0,0,0,.25),0 0 0 1px rgba(255,255,255,.06) inset!important;opacity:0!important;pointer-events:none!important;transition:opacity .22s ease,transform .22s ease,background .22s ease!important;}',
      '.easepass-status.easepass-status-visible{opacity:1!important;transform:translateX(-50%) translateY(0)!important;}',
      '.easepass-status-dot{width:9px!important;height:9px!important;border-radius:50%!important;background:#94a3b8!important;display:inline-block!important;flex-shrink:0!important;transition:background .22s ease,transform .22s ease!important;}',
      '.easepass-status-idle .easepass-status-dot{background:#94a3b8!important;}',
      '.easepass-status-something{background:rgba(28,21,14,.94)!important;}',
      '.easepass-status-something .easepass-status-dot{background:#F59E0B!important;}',
      '.easepass-status-engaged{background:rgba(0,102,255,.96)!important;}',
      '.easepass-status-engaged .easepass-status-dot{background:#fff!important;animation:easepass-status-pulse 900ms ease-in-out infinite alternate!important;}',
      '@keyframes easepass-status-pulse{from{transform:scale(.85);opacity:.65;}to{transform:scale(1.15);opacity:1;}}',
      '.easepass-toast{position:fixed!important;top:24px!important;left:50%!important;transform:translateX(-50%) translateY(-12px)!important;z-index:2147483640!important;padding:12px 22px!important;background:rgba(15,20,25,.94)!important;color:#fff!important;font-family:"Lexend",-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif!important;font-weight:600!important;font-size:15px!important;line-height:1!important;letter-spacing:.01em!important;white-space:nowrap!important;border-radius:999px!important;box-shadow:0 6px 24px rgba(0,0,0,.28),0 0 0 1px rgba(255,255,255,.06) inset!important;opacity:0!important;pointer-events:none!important;transition:opacity .22s ease,transform .22s cubic-bezier(.34,1.56,.64,1)!important;}',
      '.easepass-toast.easepass-toast-visible{opacity:1!important;transform:translateX(-50%) translateY(0)!important;}',
      '@media (prefers-reduced-motion: reduce){.easepass-ring-container,.easepass-ring-container.easepass-visible,.easepass-ring-container.easepass-completing{transition:opacity .1s ease!important;transform:translate(-50%,-50%) scale(1)!important;}.easepass-ring-count,.easepass-ring-count.easepass-complete{transform:translate(-50%,-50%)!important;transition:none!important;}.easepass-ring-progress{transition:stroke .1s ease!important;}.easepass-ring-container.easepass-completing .easepass-ring-ripple{animation:none!important;opacity:0!important;}.easepass-toast{transition:opacity .15s ease!important;transform:translateX(-50%)!important;}.easepass-toast.easepass-toast-visible{transform:translateX(-50%)!important;}.easepass-status-engaged .easepass-status-dot{animation:none!important;transform:scale(1)!important;}}'
    ].join('');
    var style = document.createElement('style');
    style.id = 'surfer-demo-style';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  // ───────── Ring rendering ─────────
  function createRing() {
    var center = RING_BOX / 2;
    var wrap = document.createElement('div');
    wrap.className = 'easepass-ring-container';
    wrap.innerHTML =
      '<div class="easepass-ring-halo"></div>' +
      '<div class="easepass-ring-ripple"></div>' +
      '<svg class="easepass-ring-svg" viewBox="0 0 ' + RING_BOX + ' ' + RING_BOX + '" aria-hidden="true">' +
        '<circle class="easepass-ring-track" cx="' + center + '" cy="' + center + '" r="' + RING_RADIUS + '"></circle>' +
        '<circle class="easepass-ring-progress" cx="' + center + '" cy="' + center + '" r="' + RING_RADIUS + '"' +
        ' transform="rotate(-90 ' + center + ' ' + center + ')"' +
        ' stroke-dasharray="' + RING_CIRCUMFERENCE.toFixed(2) + '"' +
        ' stroke-dashoffset="' + RING_CIRCUMFERENCE.toFixed(2) + '"></circle>' +
      '</svg>' +
      '<div class="easepass-ring-count"></div>';
    return wrap;
  }

  function positionRing(ring, x, y) {
    ring.style.left = x + 'px';
    ring.style.top = y + 'px';
  }

  function paintRing(ring, ratio, msRemaining) {
    var progress = ring.querySelector('.easepass-ring-progress');
    var count = ring.querySelector('.easepass-ring-count');
    var offset = RING_CIRCUMFERENCE * (1 - ratio);
    progress.setAttribute('stroke-dashoffset', offset.toFixed(2));
    var secs = Math.max(0, Math.ceil(msRemaining / 1000));
    count.textContent = secs > 0 ? String(secs) : '';
  }

  function getElementCenter(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // ───────── Status pill ─────────
  function ensureStatus() {
    if (statusEl && document.documentElement.contains(statusEl)) return;
    statusEl = document.createElement('div');
    statusEl.className = 'easepass-status easepass-status-idle';
    statusEl.innerHTML = '<span class="easepass-status-dot"></span><span class="easepass-status-text">Dwell ready</span>';
    try { document.documentElement.appendChild(statusEl); } catch (_) {}
  }

  function setStatus(state, text) {
    if (!enabled) return;
    ensureStatus();
    if (!statusEl) return;
    if (state !== statusState) {
      statusEl.className = 'easepass-status easepass-status-' + state + ' easepass-status-visible';
      statusState = state;
    }
    var t = statusEl.querySelector('.easepass-status-text');
    if (t && typeof text === 'string') t.textContent = text;
  }

  function showStatus() {
    ensureStatus();
    if (statusEl) requestAnimationFrame(function () { statusEl.classList.add('easepass-status-visible'); });
  }

  function hideStatus() {
    if (statusEl) {
      statusEl.classList.remove('easepass-status-visible');
      statusState = null;
    }
  }

  // ───────── Toast ─────────
  function showToast(text) {
    var existing = document.querySelectorAll('.easepass-toast');
    for (var i = 0; i < existing.length; i++) existing[i].remove();
    var toast = document.createElement('div');
    toast.className = 'easepass-toast';
    toast.textContent = text;
    try { document.documentElement.appendChild(toast); } catch (_) { return; }
    requestAnimationFrame(function () { toast.classList.add('easepass-toast-visible'); });
    setTimeout(function () {
      toast.classList.remove('easepass-toast-visible');
      setTimeout(function () { toast.remove(); }, 250);
    }, 1400);
  }

  // ───────── Target detection ─────────
  function deepTarget(e) {
    if (typeof e.composedPath === 'function') {
      var p = e.composedPath();
      if (p && p.length > 0) return p[0];
    }
    return e.target;
  }

  function findInteractive(el) {
    if (!el || !el.closest) return null;
    return el.closest(
      'a, button, input, select, textarea, summary, label, ' +
      '[role="button"], [role="link"], [role="checkbox"], ' +
      '[role="menuitem"], [role="tab"], ' +
      '[tabindex]:not([tabindex="-1"])'
    );
  }

  function findUniversalTarget(el) {
    if (!el || !el.closest) return null;
    var hit = el.closest(UNIVERSAL_SELECTOR);
    if (!hit) return null;
    var r = hit.getBoundingClientRect();
    if (r.width < UNIVERSAL_MIN_W || r.height < UNIVERSAL_MIN_H) return null;
    return { el: hit, clickTarget: hit, type: 'universal' };
  }

  function formatSecondsLabel(secs) {
    return secs + (secs === 1 ? ' second' : ' seconds');
  }

  function formatCountdown(msRemaining) {
    var secs = Math.max(0, Math.ceil(msRemaining / 1000));
    return secs > 0 ? 'Click in ' + formatSecondsLabel(secs) : 'Clicking…';
  }

  // ───────── Click helper ─────────
  function triggerClick(el) {
    var tag = (el.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      el.focus();
      el.click();
      return;
    }
    var opts = { bubbles: true, cancelable: true, view: window };
    try {
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
    } catch (_) {}
    el.click();
  }

  // ───────── Dwell lifecycle ─────────
  var domObserver = new MutationObserver(function () {
    if (active && active.el && !document.body.contains(active.el)) cancelDwell();
  });

  function startDwell(target) {
    var elapsedAtStart = 0;
    if (lastSession && lastSession.el === target.el &&
        Date.now() - lastSession.leftAt < RESUME_WINDOW_MS) {
      elapsedAtStart = lastSession.elapsed;
    }
    lastSession = null;

    var ring = createRing();
    document.documentElement.appendChild(ring);
    var c = getElementCenter(target.el);
    positionRing(ring, c.x, c.y);
    requestAnimationFrame(function () { ring.classList.add('easepass-visible'); });

    active = {
      el: target.el,
      clickTarget: target.clickTarget,
      type: target.type,
      ring: ring,
      startTime: Date.now() - elapsedAtStart,
      elapsed: elapsedAtStart,
      dwellTime: dwellTime,
      rafId: 0
    };
    domObserver.observe(document.body, { childList: true, subtree: true });
    tickDwell();
  }

  function tickDwell() {
    if (!active) return;
    if (active.ring) {
      var c = getElementCenter(active.el);
      positionRing(active.ring, c.x, c.y);
    }
    var elapsed = Date.now() - active.startTime;
    active.elapsed = elapsed;
    var msRemaining = active.dwellTime - elapsed;
    var ratio = Math.min(1, elapsed / active.dwellTime);
    if (active.ring) paintRing(active.ring, ratio, msRemaining);
    setStatus('engaged', formatCountdown(msRemaining));
    if (ratio >= 1) completeDwell();
    else active.rafId = requestAnimationFrame(tickDwell);
  }

  function completeDwell() {
    if (!active) return;
    var ring = active.ring;
    var clickTarget = active.clickTarget;
    if (ring) {
      var progress = ring.querySelector('.easepass-ring-progress');
      var count = ring.querySelector('.easepass-ring-count');
      progress.classList.add('easepass-complete');
      count.classList.add('easepass-complete');
      count.textContent = '✓';
      ring.classList.add('easepass-completing');
    }
    setStatus('engaged', 'Clicked!');
    cancelAnimationFrame(active.rafId);
    domObserver.disconnect();
    active = null;
    lastSession = null;
    setTimeout(function () {
      if (ring) ring.remove();
      try { triggerClick(clickTarget); } catch (_) {}
    }, COMPLETE_FLASH_MS);
  }

  function cancelDwell() {
    if (!active) return;
    var ring = active.ring;
    cancelAnimationFrame(active.rafId);
    domObserver.disconnect();
    lastSession = { el: active.el, elapsed: active.elapsed, leftAt: Date.now() };
    active = null;
    if (ring) {
      ring.classList.remove('easepass-visible');
      setTimeout(function () { if (ring.parentNode) ring.remove(); }, FADE_OUT_MS);
    }
  }

  function isTypingTarget(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  // ───────── Event handlers ─────────
  document.addEventListener('mouseover', function (e) {
    if (!enabled || extensionActive()) return;
    var raw = deepTarget(e);
    var target = findUniversalTarget(raw);
    if (target) {
      if (active && active.el === target.el) return;
      if (active) cancelDwell();
      setStatus('engaged', formatCountdown(dwellTime));
      startDwell(target);
      return;
    }
    if (findInteractive(raw)) setStatus('something', 'Hover a button or link');
    else setStatus('idle', 'Dwell ready');
  }, true);

  document.addEventListener('mouseout', function (e) {
    if (!active) return;
    var next = e.relatedTarget;
    if (!next) { cancelDwell(); setStatus('idle', 'Dwell ready'); return; }
    if (active.el.contains(next)) return;
    cancelDwell();
    if (findInteractive(next)) setStatus('something', 'Hover a button or link');
    else setStatus('idle', 'Dwell ready');
  }, true);

  document.addEventListener('click', function () {
    if (active) cancelDwell();
  }, true);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && active) cancelDwell();
  });

  // Space toggles the live demo on/off (unless typing).
  document.addEventListener('keydown', function (e) {
    if (e.code !== 'Space' || e.repeat) return;
    if (isTypingTarget(e.target)) return;
    if (extensionActive()) return;
    e.preventDefault();
    e.stopPropagation();
    setDwellEnabled(!enabled);
    showToast(enabled ? 'Dwell clicking on' : 'Dwell clicking off');
    notifyDwellChanged();
  }, true);

  // ───────── Reading mode (reuses the real extension module) ─────────
  var rmLoading = false;
  var rmQueue = [];

  function ensureReadingMode(cb) {
    if (window.AccessibilitySurferReadingMode) { cb(true); return; }
    rmQueue.push(cb);
    if (rmLoading) return;
    rmLoading = true;

    if (!document.getElementById('surfer-demo-rm-css')) {
      var link = document.createElement('link');
      link.id = 'surfer-demo-rm-css';
      link.rel = 'stylesheet';
      link.href = 'easepass-extension/reading-mode.css';
      document.head.appendChild(link);
    }
    var script = document.createElement('script');
    script.src = 'easepass-extension/reading-mode.js';
    script.onload = function () { flushRmQueue(!!window.AccessibilitySurferReadingMode); };
    script.onerror = function () { flushRmQueue(false); };
    document.head.appendChild(script);
  }

  function flushRmQueue(ok) {
    rmLoading = false;
    var q = rmQueue.slice();
    rmQueue.length = 0;
    for (var i = 0; i < q.length; i++) { try { q[i](ok); } catch (_) {} }
  }

  function launchReadingMode() {
    ensureReadingMode(function (ok) {
      if (!ok) { showToast('Could not load reading mode'); return; }
      try { window.AccessibilitySurferReadingMode.enable({}); } catch (_) {}
    });
  }

  function closeReadingMode() {
    try {
      var rm = window.AccessibilitySurferReadingMode;
      if (rm && rm.isActive && rm.isActive()) rm.disable();
    } catch (_) {}
  }

  function readingModeActive() {
    try {
      var rm = window.AccessibilitySurferReadingMode;
      return !!(rm && rm.isActive && rm.isActive());
    } catch (_) { return false; }
  }

  // ───────── Public control surface ─────────
  function setDwellEnabled(on) {
    enabled = !!on;
    if (!enabled) {
      cancelDwell();
      hideStatus();
    } else {
      injectStyles();
      ensureStatus();
      setStatus('idle', 'Dwell ready');
      showStatus();
    }
  }

  function setDwellTime(ms) {
    var n = Number(ms);
    if (!isNaN(n) && n > 0) {
      dwellTime = n;
      if (active && active.type === 'universal') active.dwellTime = n;
    }
  }

  function notifyDwellChanged() {
    try {
      window.dispatchEvent(new CustomEvent('surfer-demo-dwell-changed', { detail: { enabled: enabled } }));
    } catch (_) {}
  }

  injectStyles();

  // Let the real reading-mode module read live dwell state for its
  // advance-hint logic — but never clobber the extension's own object.
  if (!window.AccessibilitySurferDwell) {
    window.AccessibilitySurferDwell = {
      isEnabled: function () { return enabled && !extensionActive(); },
      get universalDwellTime() { return dwellTime; }
    };
  }

  window.SurferDemo = {
    setDwellEnabled: setDwellEnabled,
    setDwellTime: setDwellTime,
    isDwellEnabled: function () { return enabled; },
    launchReadingMode: launchReadingMode,
    closeReadingMode: closeReadingMode,
    readingModeActive: readingModeActive,
    extensionActive: extensionActive
  };
})();
