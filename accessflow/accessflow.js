(function () {
  'use strict';

  function getScriptBase() {
    var s = document.currentScript;
    if (s && s.src) return s.src.replace(/[^\/]+$/, '');
    var q = document.querySelector('script[src*="accessflow.js"]');
    if (q && q.src) return q.src.replace(/[^\/]+$/, '');
    return './';
  }
  var pageConfig = window.AccessFlowConfig || {};
  var BASE = pageConfig.baseUrl || getScriptBase();
  var STORAGE_KEY = pageConfig.storageKey || 'accessflow-settings-v1';
  var root = document.documentElement;

  var toggleBtn = document.getElementById('a11yToggle');
  var panel = document.getElementById('a11yPanel');
  var overlay = document.getElementById('a11yOverlay');
  var closeBtn = document.getElementById('a11yClose');
  var resetBtn = document.getElementById('a11yReset');
  var toolbarRoot = document.getElementById('axoloAssistToolbarRoot');

  if (!toggleBtn || !panel || !overlay || !closeBtn || !resetBtn || !toolbarRoot) {
    return;
  }

  var iconUrl = pageConfig.iconUrl || BASE + 'accessibility.png';
  var fontBaseUrl = pageConfig.fontBaseUrl || BASE + 'fonts/';
  var accentColor = pageConfig.accentColor || '#B03060';

  var icon = toggleBtn.querySelector('img');
  if (icon) {
    icon.src = iconUrl;
  }

  if (pageConfig.position) {
    toolbarRoot.setAttribute('data-position', pageConfig.position);
  }

  function hexToRgb(hex) {
    hex = String(hex).replace('#', '');
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    return (
      parseInt(hex.substring(0, 2), 16) +
      ', ' +
      parseInt(hex.substring(2, 4), 16) +
      ', ' +
      parseInt(hex.substring(4, 6), 16)
    );
  }

  function applyAccent(color) {
    var rgb = hexToRgb(color);
    var styleId = 'accessflow-accent-vars';
    var existing = document.getElementById(styleId);
    if (existing) {
      existing.remove();
    }
    var style = document.createElement('style');
    style.id = styleId;
    style.textContent =
      '.axolo-toolbar-root{--aat-accent:' +
      color +
      ';--aat-accent-deep:' +
      color +
      ';--aat-accent-rgb:' +
      rgb +
      ';--aat-accent-tint:rgba(' +
      rgb +
      ',0.12);--aat-accent-tint2:rgba(' +
      rgb +
      ',0.28);}';
    document.head.appendChild(style);
  }

  applyAccent(accentColor);

  var featureMap = {
    textSize: 'text_size',
    lineSpacing: 'line_spacing',
    letterSpacing: 'letter_spacing',
    wordSpacing: 'word_spacing',
    font: 'font',
    textAlign: 'text_align',
    contrast: 'contrast',
    colorFilter: 'color_filter',
    readableWidth: 'readable_width',
    linkHighlight: 'link_highlight',
    underlineLinks: 'underline_links',
    enhancedFocus: 'enhanced_focus',
    highlightHeadings: 'highlight_headings',
    readingGuide: 'reading_guide',
    keyboardNav: 'keyboard_nav',
    reduceMotion: 'reduce_motion',
    pauseAnimations: 'pause_animations',
    bigCursor: 'big_cursor'
  };

  function applyFeatureVisibility(features) {
    if (!features || typeof features !== 'object') {
      return;
    }
    Object.keys(featureMap).forEach(function (key) {
      if (features[key] === false) {
        toolbarRoot
          .querySelectorAll('[data-feature="' + featureMap[key] + '"]')
          .forEach(function (el) {
            el.classList.add('aaf-hidden');
          });
      }
    });
  }

  applyFeatureVisibility(pageConfig.features);

  var fontStyleId = 'accessflow-dyslexia-fonts';
  if (!document.getElementById(fontStyleId)) {
    var fontStyle = document.createElement('style');
    fontStyle.id = fontStyleId;
    fontStyle.textContent =
      "@font-face{font-family:'OpenDyslexic';font-style:normal;font-weight:400;font-display:swap;src:url('" +
      fontBaseUrl +
      "opendyslexic-7.woff') format('woff');}" +
      "@font-face{font-family:'OpenDyslexic';font-style:normal;font-weight:700;font-display:swap;src:url('" +
      fontBaseUrl +
      "opendyslexic-8.woff') format('woff');}";
    document.head.appendChild(fontStyle);
  }

  var defaults = {
    'text-size': 'default',
    'line-spacing': 'default',
    'letter-spacing': 'default',
    'word-spacing': 'default',
    font: 'default',
    'text-align': 'default',
    'readable-width': 'default',
    contrast: 'default',
    saturation: 'default',
    'underline-links': 'off',
    'enhanced-focus': 'off',
    'highlight-headings': 'off',
    'reading-guide': 'off',
    'link-highlight': 'off',
    'keyboard-nav': 'off',
    'reduce-motion': 'off',
    'pause-animations': 'off',
    'big-cursor': 'off'
  };

  var settings;
  try {
    settings = Object.assign({}, defaults, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
  } catch (e) {
    settings = Object.assign({}, defaults);
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (err) {
      /* ignore */
    }
  }

  function apply() {
    Object.keys(defaults).forEach(function (key) {
      var val = settings[key];
      if (val === 'default' || val === 'off' || val === undefined) {
        root.removeAttribute('data-' + key);
      } else {
        root.setAttribute('data-' + key, val);
      }
    });
    setupReadingGuide();
  }

  function syncUI() {
    document.querySelectorAll('.a11y-btn[data-setting]').forEach(function (btn) {
      var active = settings[btn.dataset.setting] === btn.dataset.value;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    document.querySelectorAll('.a11y-switch[data-toggle]').forEach(function (sw) {
      sw.setAttribute('aria-checked', settings[sw.dataset.toggle] === 'on' ? 'true' : 'false');
    });
  }

  function checkBadge() {
    var count = 0;
    Object.keys(defaults).forEach(function (key) {
      if (settings[key] !== defaults[key]) {
        count += 1;
      }
    });
    if (count > 0) {
      toggleBtn.classList.add('aat-has-settings');
    } else {
      toggleBtn.classList.remove('aat-has-settings');
    }
  }

  function afterChange() {
    save();
    apply();
    syncUI();
    checkBadge();
  }

  document.querySelectorAll('.a11y-btn[data-setting]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      settings[btn.dataset.setting] = btn.dataset.value;
      afterChange();
    });
  });

  document.querySelectorAll('.a11y-switch[data-toggle]').forEach(function (sw) {
    sw.addEventListener('click', function () {
      var key = sw.dataset.toggle;
      settings[key] = settings[key] === 'on' ? 'off' : 'on';
      afterChange();
    });
  });

  resetBtn.addEventListener('click', function () {
    settings = Object.assign({}, defaults);
    afterChange();
    var orig = resetBtn.textContent;
    resetBtn.textContent = '✓ All reset';
    resetBtn.disabled = true;
    setTimeout(function () {
      resetBtn.textContent = orig;
      resetBtn.disabled = false;
    }, 1500);
  });

  function openPanel() {
    panel.classList.add('open');
    overlay.classList.add('open');
    root.classList.add('a11y-locked');
    toggleBtn.setAttribute('aria-expanded', 'true');
    overlay.setAttribute('aria-hidden', 'false');
    setTimeout(function () {
      panel.focus();
    }, 50);
  }

  function closePanel() {
    panel.classList.remove('open');
    overlay.classList.remove('open');
    root.classList.remove('a11y-locked');
    toggleBtn.setAttribute('aria-expanded', 'false');
    overlay.setAttribute('aria-hidden', 'true');
    toggleBtn.focus();
  }

  toggleBtn.addEventListener('click', function () {
    if (panel.classList.contains('open')) {
      closePanel();
    } else {
      openPanel();
    }
  });

  closeBtn.addEventListener('click', closePanel);
  overlay.addEventListener('click', closePanel);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel.classList.contains('open')) {
      closePanel();
    }
    if (e.key !== 'Tab' || !panel.classList.contains('open')) {
      return;
    }
    var focusable = Array.prototype.slice
      .call(
        panel.querySelectorAll(
          'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      )
      .filter(function (el) {
        return !el.disabled;
      });
    if (!focusable.length) {
      return;
    }
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  var guideEl = null;

  function moveGuide(e) {
    if (guideEl) {
      guideEl.style.top = e.clientY - 22 + 'px';
    }
  }

  function setupReadingGuide() {
    if (settings['reading-guide'] === 'on') {
      if (!guideEl) {
        guideEl = document.createElement('div');
        guideEl.className = 'a11y-reading-guide';
        guideEl.setAttribute('aria-hidden', 'true');
        document.body.appendChild(guideEl);
        document.addEventListener('mousemove', moveGuide);
      }
    } else if (guideEl) {
      document.removeEventListener('mousemove', moveGuide);
      guideEl.remove();
      guideEl = null;
    }
  }

  apply();
  syncUI();
  checkBadge();

  setTimeout(function () {
    toggleBtn.classList.add('aat-loaded');
  }, 600);
})();
