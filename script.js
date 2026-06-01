function handleContactSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const status = form.querySelector('#formStatus');

  status.textContent = '';
  status.className = 'form-status';

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const data = Object.fromEntries(new FormData(form));
  const subject = encodeURIComponent("Inquiry from Axolo Assist site: " + data.name);
  const body = encodeURIComponent(
    "Name: "  + data.name  + "\n" +
    "Email: " + data.email + "\n" +
    "Role: "  + data.role  + "\n\n" +
    "Message:\n" + data.message + "\n\n" +
    "-- Sent via axol-assist.vercel.app contact form"
  );

  const mailtoUrl =
    "mailto:axolassist.business@gmail.com" +
    "?subject=" + subject +
    "&body="    + body;

  window.location.href = mailtoUrl;

  status.textContent = "Opening your email app. Review and tap Send to deliver your message.";
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
  '.products h2, .products > p, .product-card, ' +
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
          btn('saturation', 'sepia', 'Sepia', false) +
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
    root.classList.add('a11y-locked');
    toggleBtn.setAttribute('aria-expanded', 'true');
    setTimeout(() => panel.focus(), 50);
  }
  function closePanel() {
    panel.classList.remove('open');
    overlay.classList.remove('open');
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

/* ───────── EASEPASS POPUP PREVIEW ─────────
   A top-right floating button (accessibility logo) that opens a faithful,
   interactive replica of the extension's popup.html, so visitors can see
   every control the extension offers. Injected here (one source, appears
   on every page that loads script.js). The dwell toggles and sliders are
   a visual demo — they update their own UI but don't drive dwell-clicking
   on this static page. The text controls likewise just demonstrate the UI. */
(function () {
  if (document.getElementById('epd-panel')) return;

  const FONTS = [
    ['default', 'Default', 'Original page font'],
    ['opendyslexic', 'OpenDyslexic', 'The quick brown fox'],
    ['lexend', 'Lexend', 'The quick brown fox'],
    ['arial', 'Arial', 'The quick brown fox'],
    ['comic', 'Comic Sans MS', 'The quick brown fox'],
    ['atkinson', 'Atkinson', 'The quick brown fox']
  ];

  const fontBtns = FONTS.map(([id, name, prev], i) =>
    `<button class="epd-font-btn" type="button" data-font="${id}" aria-pressed="${i === 0 ? 'true' : 'false'}" aria-label="Use the ${name} font">` +
      `<span class="epd-font-name">${name}</span>` +
      `<span class="epd-font-preview">${prev}</span>` +
    `</button>`).join('');

  const pillRow = (label, attr, opts) =>
    `<div class="epd-pill-row">` +
      `<span class="epd-pill-row-label">${label}</span>` +
      `<div class="epd-pill-group" role="group" aria-label="${label} spacing">` +
        opts.map(([v, t], i) =>
          `<button class="epd-pill-btn" type="button" data-${attr}="${v}" aria-pressed="${i === 0 ? 'true' : 'false'}">${t}</button>`).join('') +
      `</div>` +
    `</div>`;

  const slider = (id, label, min, max, step, value, unit) =>
    `<div class="epd-slider-block">` +
      `<div class="epd-slider-label"><label for="${id}">${label}</label>` +
      `<span class="epd-value"><span id="${id}-val">${value}</span> ${unit}</span></div>` +
      `<input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}" />` +
    `</div>`;

  const toggle = document.createElement('button');
  toggle.id = 'epd-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Preview the EasePass extension popup');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'epd-panel');
  toggle.innerHTML = '<img src="accessibility.png" alt="" aria-hidden="true" width="56" height="56" />';

  const overlay = document.createElement('div');
  overlay.id = 'epd-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const panel = document.createElement('aside');
  panel.id = 'epd-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'EasePass extension popup preview');
  panel.tabIndex = -1;
  panel.innerHTML =
    `<div class="epd-head">` +
      `<div>` +
        `<img src="easepasslogo.png" alt="" class="epd-logo" aria-hidden="true" />` +
        `<div class="epd-title">Ease<span class="accent">Pass</span></div>` +
        `<div class="epd-tagline">Hover to click. No button needed.</div>` +
      `</div>` +
      `<button class="epd-close" type="button" aria-label="Close popup preview">✕</button>` +
    `</div>` +
    `<p class="epd-note">Preview of the extension's toolbar popup. Install EasePass to use these controls for real.</p>` +

    `<h3 class="epd-section-heading">YouTube</h3>` +
    `<div class="epd-toggle-row">` +
      `<div class="epd-toggle-info"><span class="epd-label">Dwell clicking</span>` +
      `<span class="epd-status on" data-on="Active on YouTube" data-off="Disabled">Active on YouTube</span></div>` +
      `<button class="epd-switch" type="button" role="switch" aria-checked="true" aria-label="Toggle YouTube dwell clicking"></button>` +
    `</div>` +
    slider('epd-video', 'Video dwell time', 1000, 8000, 500, 5000, 'ms') +
    slider('epd-button', 'Button dwell time', 1000, 5000, 250, 3000, 'ms') +

    `<h3 class="epd-section-heading">Every other site</h3>` +
    `<div class="epd-toggle-row">` +
      `<div class="epd-toggle-info"><span class="epd-label">Dwell clicking</span>` +
      `<span class="epd-status on" data-on="Active everywhere" data-off="Disabled">Active everywhere</span></div>` +
      `<button class="epd-switch" type="button" role="switch" aria-checked="true" aria-label="Toggle universal dwell clicking"></button>` +
    `</div>` +
    slider('epd-universal', 'Dwell time', 1000, 6000, 250, 3000, 'ms') +

    `<div class="epd-how"><h3>How it works</h3><ol>` +
      `<li>Hover over a video or button.</li>` +
      `<li>Watch the ring fill up.</li>` +
      `<li>It clicks automatically.</li>` +
      `<li>Tap <strong>Space</strong> any time to toggle on or off.</li>` +
    `</ol></div>` +

    `<h3 class="epd-section-heading">Text Accessibility</h3>` +
    `<p class="epd-ta-desc">Change fonts, size, and spacing on any website.</p>` +
    `<h4 class="epd-subhead">Font</h4>` +
    `<div class="epd-font-grid">${fontBtns}</div>` +
    `<div class="epd-section-header"><h4 class="epd-subhead">Text Size</h4>` +
      `<button class="epd-reset-link" type="button" data-reset="size">Reset</button></div>` +
    `<div class="epd-slider-row">` +
      `<input type="range" id="epd-size" min="80" max="200" step="10" value="100" aria-label="Text size percentage" />` +
      `<span class="epd-slider-value"><span id="epd-size-val">100</span>%</span></div>` +
    `<h4 class="epd-subhead">Spacing</h4>` +
    pillRow('Letter', 'letter', [['normal', 'Normal'], ['wide', 'Wide'], ['wider', 'Wider']]) +
    pillRow('Word', 'word', [['normal', 'Normal'], ['wide', 'Wide'], ['wider', 'Wider']]) +
    pillRow('Line', 'line', [['normal', 'Normal'], ['relaxed', 'Relaxed'], ['loose', 'Loose']]) +
    `<button class="epd-reset-all" type="button">Reset all text settings</button>` +

    `<div class="epd-footer">From <a href="https://axol-assist.vercel.app" target="_blank" rel="noopener noreferrer">Axolo Assist</a> · ` +
      `<a href="privacy.html">Privacy Policy</a></div>`;

  // ── Open / close ──
  function open() {
    overlay.classList.add('epd-open');
    panel.classList.add('epd-open');
    toggle.setAttribute('aria-expanded', 'true');
    panel.focus();
  }
  function close() {
    overlay.classList.remove('epd-open');
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
    });
  });

  // Dwell-time + size sliders: live-update their value label.
  const bindSlider = (id, labelId) => {
    const el = panel.querySelector('#' + id);
    const out = panel.querySelector('#' + labelId);
    if (el && out) el.addEventListener('input', () => { out.textContent = el.value; });
  };
  bindSlider('epd-video', 'epd-video-val');
  bindSlider('epd-button', 'epd-button-val');
  bindSlider('epd-universal', 'epd-universal-val');
  bindSlider('epd-size', 'epd-size-val');

  // Single-select groups (font buttons + spacing pills).
  const singleSelect = (selector) => {
    const btns = panel.querySelectorAll(selector);
    btns.forEach(b => b.addEventListener('click', () => {
      btns.forEach(o => o.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
    }));
  };
  singleSelect('.epd-font-btn');
  ['letter', 'word', 'line'].forEach(attr => singleSelect(`[data-${attr}]`));

  // Reset links.
  panel.querySelector('[data-reset="size"]').addEventListener('click', () => {
    const el = panel.querySelector('#epd-size');
    el.value = 100;
    panel.querySelector('#epd-size-val').textContent = '100';
  });
  panel.querySelector('.epd-reset-all').addEventListener('click', () => {
    panel.querySelectorAll('.epd-font-btn, .epd-pill-btn').forEach(b =>
      b.setAttribute('aria-pressed', b.dataset.font === 'default' ||
        b.dataset.letter === 'normal' || b.dataset.word === 'normal' || b.dataset.line === 'normal'
        ? 'true' : 'false'));
    const size = panel.querySelector('#epd-size');
    size.value = 100;
    panel.querySelector('#epd-size-val').textContent = '100';
  });

  document.body.appendChild(toggle);
  document.body.appendChild(overlay);
  document.body.appendChild(panel);
})();
