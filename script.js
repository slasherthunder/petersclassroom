function handleContactSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const status = form.querySelector('#formStatus');
  const siteOrigin = (window.AXOL_SITE && window.AXOL_SITE.origin) || 'https://axolassist.com';
  const siteHost = siteOrigin.replace(/^https?:\/\//, '');

  status.textContent = '';
  status.className = 'form-status';

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const data = Object.fromEntries(new FormData(form));

  if (data.website && data.website.trim()) {
    status.textContent = 'Opening your email app...';
    status.classList.add('success');
    return;
  }

  const subject = encodeURIComponent("Inquiry from Axol Assist site: " + data.name);
  const body = encodeURIComponent(
    "Name: "  + data.name  + "\n" +
    "Email: " + data.email + "\n" +
    "Role: "  + data.role  + "\n\n" +
    "Message:\n" + data.message + "\n\n" +
    "-- Sent via " + siteHost + " contact form"
  );

  const mailtoUrl =
    "mailto:axolassist.business@gmail.com" +
    "?subject=" + subject +
    "&body="    + body;

  window.location.href = mailtoUrl;

  status.innerHTML = 'Opening your email app. Review the message and tap Send. If no app opens, email us directly at <a href="mailto:axolassist.business@gmail.com">axolassist.business@gmail.com</a>.';
  status.classList.add('success');
}

// Reveal-on-scroll
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('reveal-in');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

const revealTargets = document.querySelectorAll(
  '.mission h2, .mission p, ' +
  '.audiences h2, .audiences > p, .audience-card, ' +
  '.principles h2, .principle, ' +
  '.about-section h2, .about-section p, ' +
  '.products h2, .products > p, .product-card, .product-spotlight, ' +
  '.notify h2, .notify p, .contact-info, .contact-form'
);

revealTargets.forEach(el => {
  el.classList.add('reveal');
  revealObserver.observe(el);
});

// Stagger grid children
['.audience-grid', '.principles-grid', '.product-grid'].forEach(selector => {
  document.querySelectorAll(selector + ' > *').forEach((item, i) => {
    item.style.transitionDelay = (i * 90) + 'ms';
  });
});

/* ───────── ACCESSIBILITY TOOLBAR ───────── */
(function () {
  const STORAGE_KEY = 'axoloassist-a11y-settings-v1';
  const root = document.documentElement;

  // The toolbar markup is injected here rather than hand-copied into every
  // page's HTML — one source of truth, and it appears anywhere script.js
  // loads (index, easepass, privacy). Idempotent: bails if already present
  // (e.g. an older page that still has the static markup).
  function injectAccessibilityToolbar() {
    if (document.getElementById('a11yPanel')) return;
    const group = (heading, label, buttons) =>
      `<div class="a11y-group">
        <h3>${heading}</h3>
        <div class="a11y-options" role="group" aria-label="${label}">${buttons}</div>
      </div>`;
    const btn = (setting, value, text, pressed, style) =>
      `<button class="a11y-btn" data-setting="${setting}" data-value="${value}" aria-pressed="${pressed ? 'true' : 'false'}"${style ? ` style="${style}"` : ''}>${text}</button>`;
    const sw = (id, toggle, label, ariaLabel) =>
      `<div class="a11y-toggle-row">
        <label for="sw-${id}">${label}</label>
        <button class="a11y-switch" id="sw-${id}" data-toggle="${toggle}" role="switch" aria-checked="false" aria-label="${ariaLabel || label}"></button>
      </div>`;

    const html =
      `<button class="a11y-toggle" id="a11yToggle" aria-label="Open accessibility settings" aria-expanded="false" aria-controls="a11yPanel">
        <img src="accessibility.png" alt="" width="60" height="60" aria-hidden="true" />
      </button>
      <div class="a11y-overlay" id="a11yOverlay" aria-hidden="true"></div>
      <aside class="a11y-panel" id="a11yPanel" role="dialog" aria-labelledby="a11yTitle" aria-modal="true" tabindex="-1">
        <div class="a11y-panel-header">
          <h2 id="a11yTitle">Accessibility</h2>
          <button class="a11y-close" id="a11yClose" aria-label="Close accessibility settings">✕</button>
        </div>
        ${group('Text Size', 'Text size',
          btn('text-size', 'default', 'A', true) +
          btn('text-size', 'lg', 'A+', false, 'font-size:0.95rem;') +
          btn('text-size', 'xl', 'A++', false, 'font-size:1.05rem;') +
          btn('text-size', 'xxl', 'A+++', false, 'font-size:1.15rem;'))}
        ${group('Line Spacing', 'Line spacing',
          btn('line-spacing', 'default', 'Normal', true) +
          btn('line-spacing', 'wide', 'Wide', false) +
          btn('line-spacing', 'wider', 'Wider', false))}
        ${group('Letter Spacing', 'Letter spacing',
          btn('letter-spacing', 'default', 'Normal', true) +
          btn('letter-spacing', 'wide', 'Wide', false) +
          btn('letter-spacing', 'wider', 'Wider', false))}
        ${group('Font', 'Font choice',
          btn('font', 'default', 'Default', true) +
          btn('font', 'dyslexia', 'Dyslexia-friendly', false))}
        ${group('Contrast', 'Contrast mode',
          btn('contrast', 'default', 'Normal', true) +
          btn('contrast', 'dark', 'Dark', false) +
          btn('contrast', 'high', 'High', false))}
        ${group('Color Filter', 'Color filter',
          btn('saturation', 'default', 'None', true) +
          btn('saturation', 'grayscale', 'Gray', false) +
          btn('saturation', 'sepia', 'Muted', false) +
          btn('saturation', 'inverted', 'Invert', false))}
        <div class="a11y-group">
          <h3>Reading &amp; Motion</h3>
          ${sw('underline-links', 'underline-links', 'Underline links', 'Underline all links')}
          ${sw('enhanced-focus', 'enhanced-focus', 'Enhanced focus', 'Enhanced focus indicators')}
          ${sw('highlight-headings', 'highlight-headings', 'Highlight headings', 'Highlight headings')}
          ${sw('reading-guide', 'reading-guide', 'Reading guide', 'Reading guide bar that follows the cursor')}
          ${sw('reduce-motion', 'reduce-motion', 'Reduce motion', 'Reduce motion and animations')}
          ${sw('pause-animations', 'pause-animations', 'Pause animations', 'Pause all animations')}
          ${sw('big-cursor', 'big-cursor', 'Large cursor', 'Enlarge cursor')}
        </div>
        <button class="a11y-reset" id="a11yReset">Reset all settings</button>
      </aside>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }
  injectAccessibilityToolbar();

  const defaults = {
    'text-size': 'default',
    'line-spacing': 'default',
    'letter-spacing': 'default',
    'font': 'default',
    'contrast': 'default',
    'saturation': 'default',
    'underline-links': 'off',
    'enhanced-focus': 'off',
    'highlight-headings': 'off',
    'reading-guide': 'off',
    'reduce-motion': 'off',
    'pause-animations': 'off',
    'big-cursor': 'off'
  };

  let settings;
  try {
    settings = { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch (_) {
    settings = { ...defaults };
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (_) {}
  }

  function apply() {
    for (const [key, val] of Object.entries(settings)) {
      if (val === 'default' || val === 'off') {
        root.removeAttribute('data-' + key);
      } else {
        root.setAttribute('data-' + key, val);
      }
    }
    setupReadingGuide();
  }

  function syncUI() {
    document.querySelectorAll('.a11y-btn[data-setting]').forEach(btn => {
      const active = settings[btn.dataset.setting] === btn.dataset.value;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    document.querySelectorAll('.a11y-switch[data-toggle]').forEach(sw => {
      sw.setAttribute('aria-checked', settings[sw.dataset.toggle] === 'on' ? 'true' : 'false');
    });
  }

  document.querySelectorAll('.a11y-btn[data-setting]').forEach(btn => {
    btn.addEventListener('click', () => {
      settings[btn.dataset.setting] = btn.dataset.value;
      save(); apply(); syncUI();
    });
  });

  document.querySelectorAll('.a11y-switch[data-toggle]').forEach(sw => {
    sw.addEventListener('click', () => {
      const key = sw.dataset.toggle;
      settings[key] = settings[key] === 'on' ? 'off' : 'on';
      save(); apply(); syncUI();
    });
  });

  document.getElementById('a11yReset').addEventListener('click', () => {
    settings = { ...defaults };
    save(); apply(); syncUI();
  });

  // Panel open/close
  const toggleBtn = document.getElementById('a11yToggle');
  const panel = document.getElementById('a11yPanel');
  const overlay = document.getElementById('a11yOverlay');
  const closeBtn = document.getElementById('a11yClose');

  function openPanel() {
    panel.classList.add('open');
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    root.classList.add('a11y-locked');
    toggleBtn.setAttribute('aria-expanded', 'true');
    setTimeout(() => panel.focus(), 50);
  }
  function closePanel() {
    panel.classList.remove('open');
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    root.classList.remove('a11y-locked');
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.focus();
  }

  toggleBtn.addEventListener('click', () => {
    panel.classList.contains('open') ? closePanel() : openPanel();
  });
  closeBtn.addEventListener('click', closePanel);
  overlay.addEventListener('click', closePanel);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel.classList.contains('open')) closePanel();
    if (e.key !== 'Tab' || !panel.classList.contains('open')) return;
    const focusable = Array.from(panel.querySelectorAll(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter(el => !el.disabled);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // Reading guide bar follows cursor
  let guideEl = null;
  function moveGuide(e) {
    if (guideEl) guideEl.style.top = (e.clientY - 22) + 'px';
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

  // Initial application
  apply();
  syncUI();
})();

/* ───────── ACCESSIBILITY SURFER POPUP PREVIEW ─────────
   A bottom-left floating button (Accessibility Surfer logo) that opens a left-side
   preview of the extension's dwell-clicking controls, so visitors can see what the
   extension offers. Injected here (one source, appears on every page that
   loads script.js). The toggles and sliders are a visual demo — they update
   their own UI but don't drive dwell-clicking on this static page. (Text-
   accessibility controls live only in the extension itself, not here.) */
(function () {
  if (document.body && document.body.hasAttribute('data-skip-surfer-preview')) return;
  if (document.getElementById('epd-panel')) return;

  function formatDwellSeconds(ms) {
    const sec = Math.round(Number(ms) / 1000);
    return sec + (sec === 1 ? ' second' : ' seconds');
  }

  const slider = (id, label, min, max, step, value) =>
    `<div class="epd-slider-block">` +
      `<div class="epd-slider-label"><label for="${id}">${label}</label>` +
      `<span class="epd-value"><span id="${id}-val">${formatDwellSeconds(value)}</span></span></div>` +
      `<input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label} in seconds" />` +
    `</div>`;

  const toggle = document.createElement('button');
  toggle.id = 'epd-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Preview the Accessibility Surfer extension popup');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'epd-panel');
  toggle.innerHTML = '<img src="assistsurfer.png" alt="" aria-hidden="true" width="60" height="60" />';

  const overlay = document.createElement('div');
  overlay.id = 'epd-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const panel = document.createElement('aside');
  panel.id = 'epd-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Accessibility Surfer extension popup preview');
  panel.tabIndex = -1;
  panel.innerHTML =
    `<div class="epd-head">` +
      `<div>` +
        `<img src="assistsurfer.png" alt="" class="epd-logo" aria-hidden="true" />` +
        `<div class="epd-title">Accessibility <span class="accent">Surfer</span></div>` +
        `<div class="epd-tagline">Hover to click. No button needed.</div>` +
      `</div>` +
      `<button class="epd-close" type="button" aria-label="Close popup preview">✕</button>` +
    `</div>` +
    `<p class="epd-note">Preview of the extension's toolbar popup. <a href="${(window.AXOL_SITE && window.AXOL_SITE.chromeWebStoreUrl) || 'https://chromewebstore.google.com/detail/accessibility-surfer/pccmbliammnfaklpblehkonmhcdnedhn'}" data-chrome-install rel="noopener noreferrer">Add to Chrome</a> to use these controls for real.</p>` +

    `<h3 class="epd-section-heading">YouTube</h3>` +
    `<div class="epd-toggle-row">` +
      `<div class="epd-toggle-info"><span class="epd-label">Dwell clicking</span>` +
      `<span class="epd-status on" data-on="Active on YouTube" data-off="Disabled">Active on YouTube</span></div>` +
      `<button class="epd-switch" type="button" role="switch" aria-checked="true" aria-label="Toggle YouTube dwell clicking"></button>` +
    `</div>` +
    slider('epd-video', 'Video dwell time', 1000, 8000, 500, 5000) +
    slider('epd-button', 'Button dwell time', 1000, 5000, 250, 3000) +

    `<h3 class="epd-section-heading">Every other site</h3>` +
    `<div class="epd-toggle-row">` +
      `<div class="epd-toggle-info"><span class="epd-label">Dwell clicking</span>` +
      `<span class="epd-status" data-on="Active everywhere" data-off="Disabled">Disabled</span></div>` +
      `<button class="epd-switch" id="epd-universal-toggle" type="button" role="switch" aria-checked="false" aria-label="Toggle universal dwell clicking"></button>` +
    `</div>` +
    slider('epd-universal', 'Dwell time', 1000, 6000, 250, 3000) +

    `<div class="epd-how"><h3>How it works</h3><ol>` +
      `<li>Hover over a video or button.</li>` +
      `<li>Watch the ring fill up.</li>` +
      `<li>It clicks automatically.</li>` +
      `<li>Tap <strong>Space</strong> any time to toggle on or off.</li>` +
    `</ol></div>` +

    `<h3 class="epd-section-heading">Reading Mode</h3>` +
    `<p class="epd-ta-desc">A clean, distraction-free reading view with its own typography, focus mode, fatigue compensation, word simplification, and progress tracking. Page content stays on your device.</p>` +
    `<div class="epd-toggle-row">` +
      `<div class="epd-toggle-info"><span class="epd-label">Reading mode</span>` +
      `<span class="epd-status" id="epd-rm-status" data-on="Active" data-off="Off">Off</span></div>` +
      `<button class="epd-switch" id="epd-rm-toggle" type="button" role="switch" aria-checked="false" aria-label="Toggle reading mode"></button>` +
    `</div>` +
    `<div class="epd-toggle-row">` +
      `<div class="epd-toggle-info"><span class="epd-label">Remember sites</span></div>` +
      `<button class="epd-switch" type="button" role="switch" aria-checked="true" aria-label="Remember sites where I use reading mode"></button>` +
    `</div>` +
    `<p class="epd-ta-desc">Shortcut: <strong>Alt&nbsp;+&nbsp;R</strong> on this page.</p>` +
    `<button class="epd-reset-all" type="button" id="epd-rm-open">Open in reading mode</button>` +
    `<button class="epd-reset-link" type="button" id="epd-rm-clear" style="display:block;margin-top:0.6rem;">Clear site memory</button>` +

    `<div class="epd-footer">From <a href="${(window.AXOL_SITE && window.AXOL_SITE.origin) || 'https://axolassist.com'}" target="_blank" rel="noopener noreferrer">Axol Assist</a> · ` +
      `<a href="privacy.html">Privacy Policy</a></div>`;

  // ── Open / close ──
  function open() {
    overlay.classList.add('epd-open');
    overlay.setAttribute('aria-hidden', 'false');
    panel.classList.add('epd-open');
    toggle.setAttribute('aria-expanded', 'true');
    panel.focus();
    // Don't auto-enable dwell clicking just from opening the panel — the
    // visitor turns it on themselves via the toggle (or Space). We only
    // sync the dwell-time value so it's ready when they do.
    if (window.SurferDemo) {
      const slider = panel.querySelector('#epd-universal');
      if (slider) window.SurferDemo.setDwellTime(slider.value);
    }
  }
  function close() {
    overlay.classList.remove('epd-open');
    overlay.setAttribute('aria-hidden', 'true');
    panel.classList.remove('epd-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  }
  function isOpen() { return panel.classList.contains('epd-open'); }

  toggle.addEventListener('click', () => (isOpen() ? close() : open()));
  overlay.addEventListener('click', close);
  panel.querySelector('.epd-close').addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) close();
  });

  // ── Demo interactivity (visual only) ──
  panel.querySelectorAll('.epd-switch').forEach(sw => {
    sw.addEventListener('click', () => {
      const on = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', on ? 'true' : 'false');
      const status = sw.closest('.epd-toggle-row').querySelector('.epd-status');
      if (status) {
        status.textContent = on ? status.dataset.on : status.dataset.off;
        status.classList.toggle('on', on);
      }
      // Live-demo wiring: drive the real engine for the two functional toggles.
      if (sw.id === 'epd-universal-toggle' && window.SurferDemo) {
        window.SurferDemo.setDwellEnabled(on);
      } else if (sw.id === 'epd-rm-toggle' && window.SurferDemo) {
        if (on) { close(); window.SurferDemo.launchReadingMode(); }
        else { window.SurferDemo.closeReadingMode(); }
      }
    });
  });

  // Keep the dwell toggle's visual state in sync when Space toggles the
  // live demo from outside the panel.
  window.addEventListener('surfer-demo-dwell-changed', (e) => {
    const univ = panel.querySelector('#epd-universal-toggle');
    if (!univ) return;
    const on = !!(e.detail && e.detail.enabled);
    univ.setAttribute('aria-checked', on ? 'true' : 'false');
    const status = univ.closest('.epd-toggle-row').querySelector('.epd-status');
    if (status) {
      status.textContent = on ? status.dataset.on : status.dataset.off;
      status.classList.toggle('on', on);
    }
  });

  function syncReadingModeToggle(on) {
    const rmSwitch = panel.querySelector('#epd-rm-toggle');
    const rmStatus = panel.querySelector('#epd-rm-status');
    if (rmSwitch) rmSwitch.setAttribute('aria-checked', on ? 'true' : 'false');
    if (rmStatus) {
      rmStatus.textContent = on ? rmStatus.dataset.on : rmStatus.dataset.off;
      rmStatus.classList.toggle('on', on);
    }
  }

  window.addEventListener('easepass-rm-opened', () => syncReadingModeToggle(true));
  window.addEventListener('easepass-rm-closed', () => syncReadingModeToggle(false));

  // Dwell-time + size sliders: live-update their value label.
  const bindSlider = (id, labelId) => {
    const el = panel.querySelector('#' + id);
    const out = panel.querySelector('#' + labelId);
    if (el && out) el.addEventListener('input', () => { out.textContent = formatDwellSeconds(el.value); });
  };
  bindSlider('epd-video', 'epd-video-val');
  bindSlider('epd-button', 'epd-button-val');
  bindSlider('epd-universal', 'epd-universal-val');

  // The "Every other site" dwell-time slider drives the live demo timing.
  const universalSlider = panel.querySelector('#epd-universal');
  if (universalSlider) {
    universalSlider.addEventListener('input', () => {
      if (window.SurferDemo) window.SurferDemo.setDwellTime(universalSlider.value);
    });
  }

  function showEpdActionToast(message) {
    let toast = panel.querySelector('.epd-action-toast');
    if (!toast) {
      toast = document.createElement('p');
      toast.className = 'epd-action-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      panel.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('epd-action-toast-visible');
    clearTimeout(showEpdActionToast._timer);
    showEpdActionToast._timer = setTimeout(() => {
      toast.classList.remove('epd-action-toast-visible');
    }, 3200);
  }

  const rmOpenBtn = panel.querySelector('#epd-rm-open');
  const rmClearBtn = panel.querySelector('#epd-rm-clear');
  if (rmOpenBtn) {
    rmOpenBtn.addEventListener('click', () => {
      if (window.SurferDemo) {
        close();
        window.SurferDemo.launchReadingMode();
        const rmSwitch = panel.querySelector('#epd-rm-toggle');
        if (rmSwitch) rmSwitch.setAttribute('aria-checked', 'true');
      } else {
        showEpdActionToast('Install the extension to use reading mode on real pages.');
      }
    });
  }
  if (rmClearBtn) {
    rmClearBtn.addEventListener('click', () => {
      showEpdActionToast('Site memory cleared (preview only).');
    });
  }

  document.body.appendChild(toggle);
  document.body.appendChild(overlay);
  document.body.appendChild(panel);
})();

(function applyChromeInstallLinks() {
  const url = window.AXOL_SITE && window.AXOL_SITE.chromeWebStoreUrl;
  if (!url) return;
  document.querySelectorAll('[data-chrome-install]').forEach((el) => {
    el.href = url;
  });
})();

/* ───────── SITE ACCESSIBILITY ENHANCEMENTS ───────── */
(function initSiteAccessibility() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    document.documentElement.classList.add('reveal-static');
  }

  const nav = document.getElementById('siteNav');
  const menu = document.getElementById('siteNavMenu');
  const toggle = document.querySelector('.nav-toggle');
  if (nav && menu && toggle) {
    const setOpen = (open) => {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
    menu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setOpen(false));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  function trapFocus(container, e) {
    if (e.key !== 'Tab') return;
    const focusable = Array.from(container.querySelectorAll(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter((el) => !el.disabled && el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  document.querySelectorAll('.a11y-switch[data-toggle]').forEach((sw) => {
    sw.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        sw.click();
      }
    });
  });

  const a11yPanel = document.getElementById('a11yPanel');
  const a11yOverlay = document.getElementById('a11yOverlay');
  if (a11yPanel && a11yOverlay) {
    const a11yToggle = document.getElementById('a11yToggle');
    const observer = new MutationObserver(() => {
      const open = a11yPanel.classList.contains('open');
      a11yOverlay.setAttribute('aria-hidden', open ? 'false' : 'true');
    });
    observer.observe(a11yPanel, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('keydown', (e) => {
      if (a11yPanel.classList.contains('open')) trapFocus(a11yPanel, e);
    });
    if (a11yToggle) a11yToggle.setAttribute('aria-haspopup', 'dialog');
  }

  const epdPanel = document.getElementById('epd-panel');
  const epdOverlay = document.getElementById('epd-overlay');
  if (epdPanel && epdOverlay) {
    const epdObserver = new MutationObserver(() => {
      const open = epdPanel.classList.contains('epd-open');
      epdOverlay.setAttribute('aria-hidden', open ? 'false' : 'true');
    });
    epdObserver.observe(epdPanel, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('keydown', (e) => {
      if (epdPanel.classList.contains('epd-open')) trapFocus(epdPanel, e);
    });
    epdPanel.querySelectorAll('.epd-switch').forEach((sw) => {
      sw.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          sw.click();
        }
      });
    });
  }
})();
