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
  const subject = encodeURIComponent("Inquiry from Peter's Classroom site: " + data.name);
  const body = encodeURIComponent(
    "Name: "  + data.name  + "\n" +
    "Email: " + data.email + "\n" +
    "Role: "  + data.role  + "\n\n" +
    "Message:\n" + data.message + "\n\n" +
    "-- Sent via petersclassroom.com contact form"
  );

  const mailtoUrl =
    "mailto:petersclassroom.business@gmail.com" +
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
  const STORAGE_KEY = 'pc-a11y-settings-v1';
  const root = document.documentElement;

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
