/**
 * Anki Omni Accessibility — reviewer toolbar & features
 * Axol Assist · https://axolassist.com/anki-omni/
 */
(function () {
  'use strict';

  if (window.__aoaLoaded) return;
  window.__aoaLoaded = true;

  var STORAGE_KEY = 'aoa-settings-v1';

  var defaults = {
    fontSize: 100,
    fontFamily: 'default',
    lineSpacing: 1.5,
    letterSpacing: 0,
    wordSpacing: 0,
    contrast: 'default',
    largeUi: false,
    focusMode: false,
    readingRuler: false,
    rulerFollow: 'cursor',
    progressiveReveal: false,
    hideDistractions: false,
    dwellClick: false,
    dwellMs: 800,
    largeButtons: false,
    keyboardNav: true,
    autoRead: false,
    toolbarX: -1,
    toolbarY: -1,
    activePanel: null,
    panelOpen: false,
  };

  var state = Object.assign({}, defaults);
  var root, rulerEl, dwellSession, scanCache, lastHideDistractions;
  var assetBase = '';

  function resolveAssetBase() {
    if (window.AOA_ASSET_BASE) return window.AOA_ASSET_BASE;
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || '';
      if (src.indexOf('reviewer.js') !== -1) {
        return src.replace(/reviewer\.js(?:\?.*)?$/, '');
      }
    }
    return '';
  }

  function pycmd(msg) {
    if (typeof window.pycmd === 'function') return window.pycmd(msg);
    return null;
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
    pycmd('aoa:saveConfig:' + JSON.stringify(state));
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        Object.assign(state, defaults, parsed);
      }
    } catch (_) {}
  }

  function qs(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }

  function qsa(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }

  function cardRoot() {
    return qs('#qa') || qs('.card') || document.body;
  }

  function questionEl() {
    return qs('#qarea') || qs('.question') || qs('#question') || cardRoot();
  }

  function answerEl() {
    return qs('#answer') || qs('.answer') || null;
  }

  function ensurePosition() {
    if (state.toolbarX < 0 || state.toolbarY < 0) {
      state.toolbarX = Math.max(16, window.innerWidth - 76);
      state.toolbarY = Math.max(16, window.innerHeight - 76);
    }
  }

  function stripHtml(html) {
    var d = document.createElement('div');
    d.innerHTML = html || '';
    return (d.textContent || d.innerText || '').trim();
  }

  /* ── Visual accessibility ── */
  function applyVisual() {
    var html = document.documentElement;
    html.setAttribute('data-aoa-font-size', String(state.fontSize));
    html.setAttribute('data-aoa-font-family', state.fontFamily);
    html.setAttribute('data-aoa-line-spacing', String(state.lineSpacing));
    html.setAttribute('data-aoa-letter-spacing', String(state.letterSpacing));
    html.setAttribute('data-aoa-word-spacing', String(state.wordSpacing));
    html.setAttribute('data-aoa-contrast', state.contrast);
    html.style.setProperty('--aoa-font-size', String(state.fontSize));
    html.style.setProperty('--aoa-line-height', String(state.lineSpacing));
    html.style.setProperty('--aoa-letter', String(state.letterSpacing));
    html.style.setProperty('--aoa-word', String(state.wordSpacing));
    html.style.fontSize = (state.fontSize / 100 * 16) + 'px';
    html.toggleAttribute('data-aoa-large-ui', !!state.largeUi);
    html.toggleAttribute('data-aoa-large-buttons', !!state.largeButtons);
    html.toggleAttribute('data-aoa-keyboard-nav', !!state.keyboardNav);
  }

  /* ── Focus + reading modes ── */
  function applyFocusMode() {
    document.documentElement.toggleAttribute('data-aoa-focus-mode', !!state.focusMode);
  }

  function applyReadingRuler() {
    if (state.readingRuler) {
      if (!rulerEl) {
        rulerEl = document.createElement('div');
        rulerEl.className = 'aoa-reading-ruler';
        rulerEl.setAttribute('aria-hidden', 'true');
        document.body.appendChild(rulerEl);
      }
      if (state.rulerFollow === 'center') {
        var h = window.innerHeight;
        rulerEl.style.top = Math.round(h / 2 - 2) + 'px';
      }
    } else if (rulerEl) {
      rulerEl.remove();
      rulerEl = null;
    }
  }

  function onRulerMove(e) {
    if (!state.readingRuler || !rulerEl || state.rulerFollow !== 'cursor') return;
    rulerEl.style.top = (e.clientY - 2) + 'px';
  }

  function applyProgressiveReveal() {
    var answer = answerEl();
    if (!answer) return;
    if (!state.progressiveReveal) {
      qsa('.aoa-reveal-step', answer).forEach(function (el) {
        el.classList.remove('aoa-reveal-hidden');
      });
      return;
    }
    if (answer.getAttribute('data-aoa-reveal-ready')) return;
    var steps = [];
    qsa('p, li, div, h1, h2, h3, h4, blockquote, tr', answer).forEach(function (el) {
      if (el.closest('.aoa-toolbar-root')) return;
      if (stripHtml(el.innerHTML).length < 2) return;
      steps.push(el);
    });
    if (!steps.length) {
      steps = [answer];
    }
    steps.forEach(function (el, i) {
      el.classList.add('aoa-reveal-step');
      if (i > 0) el.classList.add('aoa-reveal-hidden');
    });
    answer.setAttribute('data-aoa-reveal-ready', '1');
    answer.addEventListener('click', onRevealClick);
  }

  function onRevealClick(e) {
    if (!state.progressiveReveal) return;
    var hidden = qsa('.aoa-reveal-hidden', answerEl() || document);
    if (hidden.length) {
      hidden[0].classList.remove('aoa-reveal-hidden');
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function applyHideDistractions() {
    document.documentElement.toggleAttribute('data-aoa-hide-distractions', !!state.hideDistractions);
    if (lastHideDistractions === state.hideDistractions) return;
    lastHideDistractions = state.hideDistractions;
    pycmd('aoa:hideDistractions:' + (state.hideDistractions ? '1' : '0'));
  }

  /* ── Motor: dwell clicking ── */
  function isDwellTarget(el) {
    if (!el || el.closest('.aoa-toolbar-root')) return false;
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'a' || tag === 'button' || el.getAttribute('role') === 'button') return true;
    if (el.onclick || el.getAttribute('tabindex') === '0') return true;
    return false;
  }

  function cancelDwell() {
    if (!dwellSession) return;
    if (dwellSession.ring) dwellSession.ring.remove();
    if (dwellSession.raf) cancelAnimationFrame(dwellSession.raf);
    dwellSession = null;
  }

  function startDwell(el) {
    cancelDwell();
    var ring = document.createElement('div');
    ring.className = 'aoa-dwell-ring';
    var rect = el.getBoundingClientRect();
    ring.style.left = rect.left + 'px';
    ring.style.top = rect.top + 'px';
    ring.style.width = rect.width + 'px';
    ring.style.height = rect.height + 'px';
    document.body.appendChild(ring);
    var start = performance.now();
    var duration = Math.max(400, Number(state.dwellMs) || 800);

    function tick(now) {
      var p = Math.min(1, (now - start) / duration);
      ring.style.setProperty('--aoa-dwell-progress', String(p));
      if (p >= 1) {
        cancelDwell();
        el.click();
        return;
      }
      dwellSession.raf = requestAnimationFrame(tick);
    }
    dwellSession = { el: el, ring: ring, raf: requestAnimationFrame(tick) };
  }

  function onDwellMove(e) {
    if (!state.dwellClick) return;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!isDwellTarget(el)) {
      cancelDwell();
      return;
    }
    if (dwellSession && dwellSession.el === el) return;
    startDwell(el);
  }

  /* ── TTS triggers ── */
  function readQuestion() {
    pycmd('aoa:readQuestion');
  }

  function readAnswer() {
    pycmd('aoa:readAnswer');
  }

  /* ── Scanner UI ── */
  function renderScanResults(data) {
    scanCache = data;
    var section = qs('[data-panel="scanner"] .aoa-panel-body', root);
    if (!section) return;
    var body = qs('.aoa-scan-results', section) || section;
    if (!data) {
      body.innerHTML = '<p class="aoa-muted">Run a scan to analyze the current deck.</p>';
      return;
    }
    var html = '';
    html += '<div class="aoa-scan-summary">';
    html += '<div class="aoa-score-ring" data-score="' + data.deckScore + '">';
    html += '<span class="aoa-score-value">' + data.deckScore + '</span>';
    html += '<span class="aoa-score-label">Deck score</span></div>';
    html += '<div><strong>' + escapeHtml(data.deckName || 'Deck') + '</strong>';
    html += '<p class="aoa-muted">' + data.totalCards + ' cards · ' + (data.flaggedCards || 0) + ' with issues</p></div></div>';
    if (data.issues && data.issues.length) {
      html += '<ul class="aoa-issue-list">';
      data.issues.forEach(function (item) {
        html += '<li><span class="aoa-issue-score">' + item.score + '</span>';
        html += '<div><div class="aoa-issue-title">' + escapeHtml(item.preview || 'Card #' + item.cardId) + '</div>';
        html += '<ul class="aoa-issue-tags">';
        (item.issues || []).forEach(function (tag) {
          html += '<li>' + escapeHtml(tag) + '</li>';
        });
        html += '</ul></div></li>';
      });
      html += '</ul>';
    } else {
      html += '<p class="aoa-muted">No major issues detected in this deck.</p>';
    }
    body.innerHTML = html;
  }

  function runScan() {
    var section = qs('[data-panel="scanner"] .aoa-panel-body', root);
    var body = section ? (qs('.aoa-scan-results', section) || section) : null;
    if (body) body.innerHTML = '<p class="aoa-muted">Scanning deck…</p>';
    pycmd('aoa:scanDeck');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Toolbar markup ── */
  function toolbarMarkup() {
    return (
      '<div class="aoa-toolbar-root" role="region" aria-label="Anki Omni Accessibility">' +
      '<button type="button" class="aoa-fab" data-aoa-drag-handle aria-label="Open accessibility settings" aria-expanded="false" aria-controls="aoaPanel">' +
      '<img src="" alt="" width="60" height="60" class="aoa-fab-icon" aria-hidden="true" />' +
      '</button>' +
      '<div class="aoa-overlay" aria-hidden="true"></div>' +
      '<aside class="aoa-drawer" id="aoaPanel" role="dialog" aria-modal="true" aria-labelledby="aoaTitle" hidden tabindex="-1">' +
      '<header class="aoa-drawer-header">' +
      '<div class="aoa-drawer-heading">' +
      '<p class="aoa-drawer-kicker">Anki Omni</p>' +
      '<h2 id="aoaTitle">Accessibility</h2>' +
      '<p class="aoa-drawer-subtitle">Adjust reading, focus, speech, and motor tools for your review session.</p>' +
      '</div>' +
      '<button type="button" class="aoa-panel-close" data-action="close-panel" aria-label="Close accessibility settings">×</button>' +
      '</header>' +
      '<nav class="aoa-tabs" role="tablist" aria-label="Accessibility features">' +
      tabBtn('font', 'Font') +
      tabBtn('spacing', 'Spacing') +
      tabBtn('contrast', 'Contrast') +
      tabBtn('focus', 'Focus') +
      tabBtn('scanner', 'Scanner') +
      tabBtn('tts', 'TTS') +
      tabBtn('motor', 'Motor') +
      '</nav>' +
      '<div class="aoa-panel">' +
      panelSection('font', fontPanel()) +
      panelSection('spacing', spacingPanel()) +
      panelSection('contrast', contrastPanel()) +
      panelSection('focus', focusPanel()) +
      panelSection('scanner', scannerPanel()) +
      panelSection('tts', ttsPanel()) +
      panelSection('motor', motorPanel()) +
      '</div>' +
      '<p class="aoa-powered">Powered by <a href="https://axolassist.com/anki-omni/" target="_blank" rel="noopener">Axol Assist</a></p>' +
      '</aside></div>'
    );
  }

  function tabBtn(id, label) {
    return '<button type="button" class="aoa-tab" role="tab" data-panel="' + id + '" aria-selected="false" aria-controls="aoa-section-' + id + '">' + label + '</button>';
  }

  function panelSection(id, body) {
    return (
      '<section class="aoa-panel-section" id="aoa-section-' + id + '" data-panel="' + id + '" role="tabpanel" hidden>' +
      '<div class="aoa-panel-body">' + body + '</div></section>'
    );
  }

  function sectionIntro(text) {
    return '<p class="aoa-section-intro">' + text + '</p>';
  }

  function settingCard(title, content) {
    return '<div class="aoa-card">' + (title ? '<h3 class="aoa-card-title">' + title + '</h3>' : '') + content + '</div>';
  }

  function rangeField(id, label, settingKey, min, max, step, suffix) {
    suffix = suffix || '';
    return (
      '<div class="aoa-field">' +
      '<label class="aoa-label" for="' + id + '">' + label +
      ' <span class="aoa-value" data-val="' + settingKey + '"></span>' + suffix + '</label>' +
      '<input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" data-setting="' + settingKey + '" aria-valuemin="' + min + '" aria-valuemax="' + max + '">' +
      '</div>'
    );
  }

  function fontPanel() {
    return (
      sectionIntro('Make card text easier to read with scalable type and dyslexia-friendly options.') +
      settingCard('Text size', rangeField('aoa-font-size', 'Font size', 'fontSize', 80, 200, 5, '%')) +
      settingCard('Typeface', '<div class="aoa-btn-row" role="group" aria-label="Font family">' +
      optionBtn('fontFamily', 'default', 'Default') +
      optionBtn('fontFamily', 'sans', 'Sans') +
      optionBtn('fontFamily', 'serif', 'Serif') +
      optionBtn('fontFamily', 'dyslexia', 'Dyslexia') +
      '</div>')
    );
  }

  function spacingPanel() {
    return (
      sectionIntro('Loosen lines and letters when dense card templates feel hard to scan.') +
      settingCard('Line spacing', rangeField('aoa-line-spacing', 'Line spacing', 'lineSpacing', 1, 2.5, 0.1, '')) +
      settingCard('Letter spacing', rangeField('aoa-letter-spacing', 'Letter spacing', 'letterSpacing', 0, 6, 0.5, 'px')) +
      settingCard('Word spacing', rangeField('aoa-word-spacing', 'Word spacing', 'wordSpacing', 0, 12, 1, 'px'))
    );
  }

  function contrastPanel() {
    return (
      sectionIntro('Tune contrast and target size without leaving the reviewer.') +
      settingCard('Color mode', '<div class="aoa-btn-row" role="group" aria-label="Contrast mode">' +
      optionBtn('contrast', 'default', 'Normal') +
      optionBtn('contrast', 'high', 'High') +
      optionBtn('contrast', 'dark', 'Dark') +
      optionBtn('contrast', 'light', 'Light') +
      '</div>') +
      settingCard('Display size', toggleRow('largeUi', 'Large UI mode', 'Increases control and label sizes in this panel.') +
      toggleRow('largeButtons', 'Large answer buttons', 'Expands tappable targets inside the card area.'))
    );
  }

  function focusPanel() {
    return (
      sectionIntro('Reduce visual noise and reveal answer content at a comfortable pace.') +
      settingCard('Attention', toggleRow('focusMode', 'Focus mode', 'Dims everything outside the active card.') +
      toggleRow('hideDistractions', 'Hide distractions', 'Minimizes extra chrome while you study.')) +
      settingCard('Reading support', toggleRow('readingRuler', 'Reading ruler', 'Highlights the line you are reading.') +
      '<div class="aoa-btn-row" role="group" aria-label="Ruler follow mode">' +
      optionBtn('rulerFollow', 'cursor', 'Follow cursor') +
      optionBtn('rulerFollow', 'center', 'Center line') +
      '</div>' +
      toggleRow('progressiveReveal', 'Progressive reveal', 'Shows multi-step answers one section at a time.'))
    );
  }

  function scannerPanel() {
    return (
      sectionIntro('Review deck-wide accessibility signals such as length, readability, and missing image descriptions.') +
      settingCard('Deck analysis', '<p class="aoa-hint">Runs locally on your collection. No data leaves your device.</p>' +
      '<button type="button" class="aoa-primary" data-action="scan-deck">Scan current deck</button>' +
      '<div class="aoa-scan-results"></div>')
    );
  }

  function ttsPanel() {
    return (
      sectionIntro('Hear the current question or answer with your device voice.') +
      settingCard('Read aloud', '<p class="aoa-hint">Uses local text-to-speech only — nothing is sent online.</p>' +
      '<div class="aoa-btn-row">' +
      '<button type="button" class="aoa-secondary" data-action="read-question">Read question</button>' +
      '<button type="button" class="aoa-secondary" data-action="read-answer">Read answer</button>' +
      '</div>' +
      toggleRow('autoRead', 'Auto-read cards', 'Speaks each side automatically when it appears.'))
    );
  }

  function motorPanel() {
    return (
      sectionIntro('Support pointer and keyboard control during review.') +
      settingCard('Pointer access', toggleRow('dwellClick', 'Dwell clicking', 'Hover over a target to activate it without pressing.') +
      rangeField('aoa-dwell-ms', 'Dwell duration', 'dwellMs', 400, 2500, 100, 'ms')) +
      settingCard('Keyboard', toggleRow('keyboardNav', 'Focus highlights', 'Makes keyboard focus easier to see.') +
      '<p class="aoa-hint">Shortcuts: Alt+Q read question · Alt+A read answer · Alt+Shift+A toggle panel.</p>')
    );
  }

  function optionBtn(key, value, label) {
    return '<button type="button" class="aoa-opt" data-option="' + key + '" data-value="' + value + '">' + label + '</button>';
  }

  function toggleRow(key, label, hint) {
    var id = 'aoa-sw-' + key;
    return (
      '<div class="aoa-toggle-row">' +
      '<div class="aoa-toggle-copy">' +
      '<span class="aoa-toggle-label" id="' + id + '-label">' + label + '</span>' +
      (hint ? '<span class="aoa-hint">' + hint + '</span>' : '') +
      '</div>' +
      '<button type="button" class="aoa-switch" role="switch" id="' + id + '" data-toggle="' + key + '" aria-labelledby="' + id + '-label" aria-checked="false"></button>' +
      '</div>'
    );
  }

  /* ── Toolbar interactions ── */
  function syncControls() {
    if (!root) return;
    qsa('[data-setting]', root).forEach(function (input) {
      var key = input.getAttribute('data-setting');
      if (input.type === 'range') input.value = state[key];
      var val = qs('[data-val="' + key + '"]', root);
      if (val) val.textContent = state[key];
    });
    qsa('[data-option]', root).forEach(function (btn) {
      var key = btn.getAttribute('data-option');
      var value = btn.getAttribute('data-value');
      btn.setAttribute('aria-pressed', String(state[key] === value));
    });
    qsa('[data-toggle]', root).forEach(function (btn) {
      var key = btn.getAttribute('data-toggle');
      var on = !!state[key];
      btn.setAttribute('aria-checked', String(on));
      btn.classList.toggle('is-on', on);
    });

    var fab = qs('.aoa-fab', root);
    var drawer = qs('.aoa-drawer', root);
    var overlay = qs('.aoa-overlay', root);
    var isOpen = !!state.panelOpen;

    if (fab) {
      fab.setAttribute('aria-expanded', String(isOpen));
      fab.classList.toggle('is-open', isOpen);
    }
    if (drawer) drawer.hidden = !isOpen;
    if (overlay) {
      overlay.classList.toggle('is-open', isOpen);
      overlay.setAttribute('aria-hidden', String(!isOpen));
    }
    root.classList.toggle('is-open', isOpen);
    root.classList.toggle('aoa-large-ui', !!state.largeUi);

    ensurePosition();
    root.style.left = state.toolbarX + 'px';
    root.style.top = state.toolbarY + 'px';

    qsa('.aoa-tab', root).forEach(function (btn) {
      var id = btn.getAttribute('data-panel');
      var selected = isOpen && state.activePanel === id;
      btn.setAttribute('aria-selected', String(selected));
      btn.classList.toggle('is-active', selected);
    });
    qsa('.aoa-panel-section', root).forEach(function (sec) {
      sec.hidden = !(isOpen && sec.getAttribute('data-panel') === state.activePanel);
    });
  }

  function openPanel(id) {
    state.panelOpen = true;
    state.activePanel = id || state.activePanel || 'font';
    syncControls();
    if (state.activePanel === 'scanner' && scanCache) renderScanResults(scanCache);
    var drawer = qs('.aoa-drawer', root);
    if (drawer) drawer.focus();
    saveState();
  }

  function closePanel() {
    state.panelOpen = false;
    state.activePanel = null;
    syncControls();
    var fab = qs('.aoa-fab', root);
    if (fab) fab.focus();
    saveState();
  }

  function togglePanel() {
    if (state.panelOpen) closePanel();
    else openPanel(state.activePanel || 'font');
  }

  function applyAll() {
    applyVisual();
    applyFocusMode();
    applyReadingRuler();
    applyProgressiveReveal();
    applyHideDistractions();
    syncControls();
  }

  function bindToolbar() {
    root.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;

      if (btn.classList.contains('aoa-fab')) {
        togglePanel();
        return;
      }

      if (!root.contains(btn)) return;

      if (btn.getAttribute('data-action') === 'close-panel') {
        closePanel();
        return;
      }
      if (btn.getAttribute('data-action') === 'scan-deck') {
        runScan();
        return;
      }
      if (btn.getAttribute('data-action') === 'read-question') {
        readQuestion();
        return;
      }
      if (btn.getAttribute('data-action') === 'read-answer') {
        readAnswer();
        return;
      }
      var panelId = btn.getAttribute('data-panel');
      if (panelId && btn.classList.contains('aoa-tab')) {
        openPanel(panelId);
        return;
      }
      var optKey = btn.getAttribute('data-option');
      if (optKey) {
        state[optKey] = btn.getAttribute('data-value');
        applyAll();
        saveState();
        return;
      }
      var toggleKey = btn.getAttribute('data-toggle');
      if (toggleKey) {
        state[toggleKey] = !state[toggleKey];
        applyAll();
        saveState();
      }
    });

    root.addEventListener('input', function (e) {
      var input = e.target;
      if (!input.matches('[data-setting]')) return;
      var key = input.getAttribute('data-setting');
      state[key] = input.type === 'range' ? Number(input.value) : input.value;
      applyAll();
      saveState();
    });

    var overlay = qs('.aoa-overlay', root);
    if (overlay) {
      overlay.addEventListener('click', function () {
        closePanel();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (!state.panelOpen || !root) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closePanel();
      }
    });

    var handle = qs('[data-aoa-drag-handle]', root);
    var dragging = false;
    var offsetX = 0;
    var offsetY = 0;

    handle.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      dragging = true;
      offsetX = e.clientX - root.offsetLeft;
      offsetY = e.clientY - root.offsetTop;
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      state.toolbarX = Math.max(0, Math.min(window.innerWidth - 80, e.clientX - offsetX));
      state.toolbarY = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - offsetY));
      root.style.left = state.toolbarX + 'px';
      root.style.top = state.toolbarY + 'px';
    });
    document.addEventListener('mouseup', function () {
      if (dragging) saveState();
      dragging = false;
    });
  }

  function initToolbar() {
    if (qs('.aoa-toolbar-root')) return;
    assetBase = resolveAssetBase();
    loadState();
    var wrap = document.createElement('div');
    wrap.innerHTML = toolbarMarkup();
    root = wrap.firstElementChild;
    document.body.appendChild(root);

    var icon = qs('.aoa-fab-icon', root);
    if (icon) {
      icon.src = (assetBase || window.AOA_ASSET_BASE || '') + 'accessibility.png';
      icon.onerror = function () {
        icon.style.display = 'none';
        var fab = qs('.aoa-fab', root);
        if (fab) fab.classList.add('aoa-fab-fallback');
      };
    }

    bindToolbar();
    applyAll();
    if (state.panelOpen && state.activePanel) syncControls();

    var fab = qs('.aoa-fab', root);
    if (fab) fab.classList.add('is-ready');

    document.addEventListener('mousemove', onRulerMove);
    document.addEventListener('mousemove', onDwellMove);
    document.addEventListener('mouseleave', cancelDwell);

    var resp = pycmd('aoa:getConfig');
    if (resp) {
      try {
        Object.assign(state, defaults, JSON.parse(resp));
        applyAll();
      } catch (_) {}
    }

    requestAnimationFrame(function () {
      ensurePosition();
      if (root) {
        root.style.left = state.toolbarX + 'px';
        root.style.top = state.toolbarY + 'px';
      }
    });
  }

  function boot() {
    initToolbar();
    if (root && window.AoaBridge) window.AoaBridge.onCardShown();
  }

  /* ── Bridge API (Python callbacks) ── */
  window.AoaBridge = {
    applyConfig: function (cfg) {
      Object.assign(state, defaults, cfg || {});
      applyAll();
    },
    onScanResult: function (data) {
      renderScanResults(data);
    },
    toggleToolbar: function () {
      if (!root) return;
      if (root.classList.contains('aoa-hidden')) {
        root.classList.remove('aoa-hidden');
        return;
      }
      togglePanel();
    },
    resetCardState: function () {
      var answer = answerEl();
      if (answer) {
        answer.removeAttribute('data-aoa-reveal-ready');
        qsa('.aoa-reveal-step', answer).forEach(function (el) {
          el.classList.remove('aoa-reveal-step', 'aoa-reveal-hidden');
        });
      }
      applyVisual();
      applyFocusMode();
      applyReadingRuler();
      syncControls();
    },
    onCardShown: function () {
      if (state.progressiveReveal) applyProgressiveReveal();
    },
    refreshCard: function () {
      this.resetCardState();
      this.onCardShown();
    },
  };

  window.AoaBoot = boot;

  if (typeof onUpdateHook !== 'undefined') {
    onUpdateHook.push(function () {
      if (window.AoaBridge) window.AoaBridge.resetCardState();
    });
  }
  if (typeof onShownHook !== 'undefined') {
    onShownHook.push(function () {
      boot();
      if (window.AoaBridge) window.AoaBridge.onCardShown();
    });
  }

  boot();
})();
