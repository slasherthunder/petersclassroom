/*
 * Accessibility Surfer — Reading Mode.
 *
 * A self-contained IIFE exposing window.AccessibilitySurferReadingMode. Reading mode
 * lifts the main article out of an arbitrary page and presents it in a clean,
 * fully-typographically-controlled overlay, with optional focus mode, fatigue
 * compensation, vocabulary simplification, a reading-progress bar, per-domain
 * memory, and plain-text export.
 *
 * Everything runs locally — no page content ever leaves the browser. The
 * original page is only hidden (scroll locked + covered), never mutated, so
 * disable() restores it to exactly its original state.
 *
 * Public API:
 *   enable(settings)         — extract content + open the overlay
 *   disable()                — close the overlay, restore the page
 *   isActive()               — boolean
 *   updateSettings(settings) — re-apply settings without re-extracting
 *   maybeShowPill()          — show the "reading mode available" pill (memory)
 *   toggle(settings)         — convenience enable/disable flip
 *
 * Dwell integration: reading-mode elements are made focusable/interactive, so
 * the existing universal dwell-click system (content.js) rings + clicks them
 * with no changes to dwell logic. window.AccessibilitySurferDwell (if present) is read
 * only to know the dwell time / enabled state.
 */

(function () {
  'use strict';

  // ───────── Constants ─────────

  const BRAND_BLUE = '#0066FF';
  const SETTINGS_KEY = 'easepass-reading-mode-settings';
  const DOMAINS_KEY = 'easepass-reading-mode-domains';
  const WORDS_PER_MINUTE = 200;
  const FATIGUE_MAX_SIZE = 2;      // +px at the bottom of the article
  const FATIGUE_MAX_LINE = 0.2;    // +line-height
  const FATIGUE_MAX_LETTER = 0.02; // +em letter-spacing

  const FONT_STACKS = {
    default:      '',
    lexend:       '"Lexend", sans-serif',
    opendyslexic: '"OpenDyslexic", "Comic Sans MS", sans-serif',
    atkinson:     '"Atkinson Hyperlegible", sans-serif',
    arial:        'Arial, Helvetica, sans-serif',
    comic:        '"Comic Sans MS", "Comic Sans", cursive'
  };

  // [label, value] — order shown in the swatch row.
  const BG_SWATCHES = [
    ['White', '#FFFFFF'], ['Cream', '#FFF8F0'], ['Light yellow', '#FFFDE7'],
    ['Light blue', '#F0F4FF'], ['Light green', '#F0FFF4'],
    ['Dark', '#1a1a1a'], ['Very dark', '#0d0d0d'], ['Custom', 'custom']
  ];

  const DEFAULTS = {
    fontFamily: 'default',
    fontSize: 18,
    lineHeight: 1.7,
    letterSpacing: 0,
    wordSpacing: 0,
    columnWidth: 680,
    maxCharsPerLine: 'off',  // 'off' | 60 | 70 | 80
    paragraphSpacing: 1.2,
    backgroundColor: '#FFFFFF',
    textColor: 'auto',       // 'auto' | #hex
    focusMode: false,
    fatigueMode: false,
    simplifyWords: false
  };

  // All user-facing copy, centralized for future localization.
  const STRINGS = {
    exit: 'Exit reading mode',
    focus: 'Focus mode',
    fatigue: 'Fatigue mode',
    simplify: 'Simplify words',
    copy: 'Copy article',
    copied: 'Copied!',
    settings: 'Settings',
    saveDefault: 'Save as default',
    reset: 'Reset',
    resetFatigue: 'Reset fatigue',
    pill: 'Reading mode available',
    enable: 'Enable',
    dismiss: 'Dismiss',
    noContent: "This page doesn't look like an article, so there's nothing to read here. Try reading mode on a news story, blog post, or documentation page.",
    close: 'Close',
    by: 'By',
    min: 'min read',
    fontLabel: 'Font',
    sizeLabel: 'Text size',
    lineLabel: 'Line height',
    letterLabel: 'Letter spacing',
    wordLabel: 'Word spacing',
    widthLabel: 'Column width',
    charsLabel: 'Max line length',
    paraLabel: 'Paragraph spacing',
    bgLabel: 'Background',
    advanceHint: '↓ / Space to advance',
    para: function (n, total) { return '¶ ' + n + ' of ' + total; },
    readTime: function (n) { return n + ' ' + STRINGS.min; },
    progress: function (pct) { return pct + '%'; }
  };

  // Complex/formal word → plain-English alternative. Hardcoded (no API).
  const COMPLEX_WORDS = {
    utilize: 'use', commence: 'start', terminate: 'end', approximately: 'about',
    sufficient: 'enough', purchase: 'buy', obtain: 'get', require: 'need',
    assist: 'help', regarding: 'about', however: 'but', therefore: 'so',
    subsequently: 'then', previously: 'before', additional: 'more',
    numerous: 'many', attempt: 'try', indicate: 'show', provide: 'give',
    demonstrate: 'show', component: 'part', implement: 'do', establish: 'set up',
    maintain: 'keep', ensure: 'make sure', consider: 'think about',
    determine: 'find out', significant: 'important', appropriate: 'right',
    particular: 'specific', individual: 'person', communicate: 'talk',
    information: 'facts', situation: 'case', opportunity: 'chance',
    challenge: 'problem', objective: 'goal', methodology: 'method',
    facilitate: 'help', collaborate: 'work together', evaluate: 'judge',
    comprehensive: 'complete', fundamental: 'basic', inevitable: 'certain',
    transparent: 'clear', innovative: 'new', sustainable: 'lasting',
    prioritize: 'rank', optimize: 'improve', leverage: 'use',
    accomplish: 'do', accumulate: 'gather', acquire: 'get', adequate: 'enough',
    advantageous: 'helpful', allocate: 'give out', alleviate: 'ease',
    anticipate: 'expect', apparent: 'clear', ascertain: 'find out',
    assistance: 'help', attain: 'reach', beneficial: 'helpful', cease: 'stop',
    circumvent: 'avoid', commodity: 'good',
    compensate: 'pay back', competent: 'able', comprise: 'make up',
    conceal: 'hide', concept: 'idea', concerning: 'about', conclude: 'end',
    concur: 'agree', consequently: 'so', constitute: 'make up',
    construct: 'build', consult: 'ask', contribute: 'give', convene: 'meet',
    correspond: 'match', currently: 'now', deduct: 'subtract', deficiency: 'lack',
    delineate: 'describe', clarify: 'make clear', depict: 'show', designate: 'name',
    desire: 'want', detrimental: 'harmful', deviate: 'differ', disclose: 'reveal',
    discontinue: 'stop', disseminate: 'spread', distribute: 'give out',
    domicile: 'home', dual: 'double', eliminate: 'remove', elucidate: 'explain',
    emphasize: 'stress', employ: 'use', enclosed: 'inside', encounter: 'meet',
    endeavor: 'try', enumerate: 'list', equitable: 'fair', equivalent: 'equal',
    erroneous: 'wrong', exclusively: 'only', exemplify: 'show', exhibit: 'show',
    expedite: 'speed up', expenditure: 'cost', expertise: 'skill',
    negligible: 'tiny', feasible: 'possible', finalize: 'finish', forfeit: 'lose',
    formulate: 'plan', fluctuate: 'change', frequently: 'often', furnish: 'give',
    generate: 'make', hierarchy: 'ranking', hypothesis: 'guess',
    identical: 'same', illustrate: 'show', immediately: 'now', impact: 'effect',
    impede: 'block', paramount: 'main', incentive: 'reward',
    incorporate: 'include', reiterate: 'repeat', initiate: 'begin',
    cognizant: 'aware', inquire: 'ask', insufficient: 'too little',
    interrogate: 'question', irrespective: 'regardless', justify: 'explain',
    locality: 'place', locate: 'find', magnitude: 'size', mandatory: 'required',
    materialize: 'happen', maximize: 'increase', minimize: 'reduce',
    modify: 'change', momentous: 'important', monitor: 'watch', necessitate: 'need',
    nevertheless: 'still', notify: 'tell', notwithstanding: 'despite',
    aggregate: 'total', observe: 'see', occupation: 'job', operate: 'run',
    optimum: 'best', originate: 'start', overall: 'total', participate: 'take part',
    perceive: 'see', permit: 'let', perspective: 'view', pertaining: 'about',
    portion: 'part', possess: 'have', preliminary: 'early', presently: 'soon',
    preserve: 'keep', principal: 'main', procure: 'get', proficient: 'skilled',
    prohibit: 'ban', proportion: 'part', proximity: 'nearness', expend: 'spend',
    rationale: 'reason', recommend: 'suggest', rectify: 'fix', reduction: 'cut',
    relinquish: 'give up', remainder: 'rest', remuneration: 'pay', render: 'make',
    represent: 'stand for', request: 'ask', reside: 'live', residence: 'home',
    resolve: 'solve', retain: 'keep', reveal: 'show', satisfactory: 'good enough',
    scrutinize: 'examine', solicit: 'ask for', strategy: 'plan', submit: 'send in',
    subsequent: 'later', substantial: 'large', substantiate: 'prove',
    utilise: 'use', supplementary: 'extra', surpass: 'beat',
    endeavour: 'try', transmit: 'send', transpire: 'happen', ultimate: 'final',
    underutilized: 'unused', undertake: 'do', utilization: 'use', validate: 'confirm',
    variation: 'change', verify: 'check', viable: 'workable', vicinity: 'area',
    voluminous: 'large', whereas: 'while', widespread: 'common', withdraw: 'remove'
  };

  // ───────── State ─────────

  let active = false;
  let settings = clone(DEFAULTS);
  let prevHtmlOverflow = '';
  let article = null;             // { title, author, date, readTime, blocks }
  let paragraphEls = [];          // .easepass-rm-paragraph nodes (focus mode)
  let focusIndex = 0;

  // DOM handles (all null until enable()).
  let overlayEl = null;
  let columnEl = null;
  let contentEl = null;
  let styleEl = null;
  let progressFillEl = null;
  let progressLabelEl = null;
  let paraIndicatorEl = null;
  let settingsPanelEl = null;
  let pillEl = null;

  // Bound handlers, so they can be removed on disable.
  let onColumnScroll = null;
  let onKeyDown = null;

  // ───────── Helpers ─────────

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  function isExtensionAlive() {
    try {
      return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
    } catch (_) { return false; }
  }

  function safeGet(keys, cb) {
    if (!isExtensionAlive()) { cb({}); return; }
    try {
      chrome.storage.local.get(keys, function (data) {
        try {
          if (chrome.runtime && chrome.runtime.lastError) { cb({}); return; }
          cb(data || {});
        } catch (_) { cb({}); }
      });
    } catch (_) { cb({}); }
  }

  function safeSet(obj) {
    if (!isExtensionAlive()) return;
    try { chrome.storage.local.set(obj); } catch (_) {}
  }

  function getURL(path) {
    try { return chrome.runtime.getURL(path); } catch (_) { return path; }
  }

  function reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (_) { return false; }
  }

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function domain() {
    try { return location.hostname; } catch (_) { return ''; }
  }

  // ───────── Settings persistence ─────────

  function mergeSettings(stored) {
    if (stored && typeof stored === 'object') {
      for (const k in DEFAULTS) {
        if (stored[k] !== undefined) settings[k] = stored[k];
      }
    }
  }

  function saveSettings() {
    safeSet({ 'easepass-reading-mode-settings': settings });
  }

  // ───────── Domain memory ─────────

  function rememberDomain() {
    const host = domain();
    if (!host) return;
    safeGet([DOMAINS_KEY], function (data) {
      const map = data[DOMAINS_KEY] || {};
      if (map[host] === 'on') return;
      map[host] = 'on';
      safeSet({ 'easepass-reading-mode-domains': map });
    });
  }

  function dismissDomain() {
    const host = domain();
    if (!host) return;
    safeGet([DOMAINS_KEY], function (data) {
      const map = data[DOMAINS_KEY] || {};
      map[host] = 'dismissed';
      safeSet({ 'easepass-reading-mode-domains': map });
    });
  }

  // ───────── Content extraction ─────────

  const ROOT_SELECTORS = [
    'article', '[role="main"]', 'main',
    '.post-content', '.article-body', '.entry-content', '.story-body'
  ];
  const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, blockquote, ul, ol, figure, img, pre';

  function wordCount(node) {
    return (node.textContent || '').trim().split(/\s+/).filter(Boolean).length;
  }

  function findRoot() {
    for (let i = 0; i < ROOT_SELECTORS.length; i++) {
      let node = null;
      try { node = document.querySelector(ROOT_SELECTORS[i]); } catch (_) {}
      // Require several real words, so a single long token (e.g. a URL)
      // can't satisfy the gate the way a raw character count could — but stay
      // lenient enough to accept genuinely short articles.
      if (node && wordCount(node) > 10) return node;
    }
    return largestParagraphBlock();
  }

  // Fallback: the element whose direct paragraph children hold the most text.
  // Returns null (never document.body) when no real content cluster is found,
  // so we show the friendly "no article" message instead of extracting nav,
  // sidebars, and footer as garbage.
  function largestParagraphBlock() {
    let best = null, bestLen = 0;
    let ps = [];
    try { ps = document.querySelectorAll('p'); } catch (_) { return null; }
    const scores = new Map();
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const parent = p.parentElement;
      if (!parent) continue;
      const len = (p.textContent || '').trim().length;
      if (len < 20) continue;
      const cur = (scores.get(parent) || 0) + len;
      scores.set(parent, cur);
      if (cur > bestLen) { bestLen = cur; best = parent; }
    }
    return bestLen > 120 ? best : null;
  }

  function findAuthor(root) {
    const sel = [
      '[rel="author"]', '[itemprop="author"]', '.author', '.byline',
      '.author-name', '.c-byline', '[data-author]'
    ];
    for (let i = 0; i < sel.length; i++) {
      let node = null;
      try { node = (root && root.querySelector(sel[i])) || document.querySelector(sel[i]); } catch (_) {}
      const t = node && node.textContent ? node.textContent.trim() : '';
      if (t && t.length < 120) return t.replace(/^by\s+/i, '');
    }
    const meta = document.querySelector('meta[name="author"]');
    if (meta && meta.content) return meta.content.trim();
    return '';
  }

  function findDate() {
    let t = null;
    try { t = document.querySelector('time[datetime], time'); } catch (_) {}
    if (t) {
      const dt = t.getAttribute('datetime') || t.textContent;
      if (dt) return formatDate(dt);
    }
    const meta = document.querySelector(
      'meta[property="article:published_time"], meta[name="date"], meta[itemprop="datePublished"]');
    if (meta && meta.content) return formatDate(meta.content);
    return '';
  }

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  function formatDate(raw) {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return String(raw).trim().slice(0, 40);
    try {
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (_) {
      // Manual fallback so a valid date never renders as a raw ISO string.
      return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }
  }

  // document.title minus a trailing " - Site" / " | Site" / " — Site" suffix.
  function cleanDocTitle() {
    const full = (document.title || '').trim();
    const trimmed = full.replace(/\s*[|–—-]\s*[^|–—-]{1,40}$/, '').trim();
    return trimmed || full;
  }

  // The headline element: first h1, else the first h2 (many articles use an
  // h2 as their effective title with no h1 at all).
  function findTitleElement(root) {
    let node = null;
    try {
      node = (root && (root.querySelector('h1') || root.querySelector('h2'))) ||
        document.querySelector('h1');
    } catch (_) {}
    return node || null;
  }

  // Collect ordered, cleaned block descriptors from the root. Nested blocks
  // (e.g. <p> inside <blockquote>, <li> inside <ul>) are skipped so each chunk
  // appears once. Text is copied verbatim via textContent — never truncated.
  function extractBlocks(root, titleEl) {
    let nodes = [];
    try { nodes = root.querySelectorAll(BLOCK_SELECTOR); } catch (_) { return []; }
    const blocks = [];
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (hasAncestorBlock(node, root)) continue;
      const tag = node.tagName.toLowerCase();
      if (tag === 'p') {
        const text = (node.textContent || '').trim();
        if (text) blocks.push({ type: 'p', text: text });
      } else if (/^h[1-6]$/.test(tag)) {
        // Skip exactly the headline element (rendered separately as the
        // title) so it isn't duplicated; all other headings stay as content.
        if (node === titleEl) continue;
        const text = (node.textContent || '').trim();
        if (text) blocks.push({ type: 'h', level: tag, text: text });
      } else if (tag === 'blockquote') {
        const text = (node.textContent || '').trim();
        if (text) blocks.push({ type: 'quote', text: text });
      } else if (tag === 'pre') {
        const text = node.textContent || '';
        if (text.trim()) blocks.push({ type: 'pre', text: text });
      } else if (tag === 'ul' || tag === 'ol') {
        const items = [];
        const lis = node.querySelectorAll('li');
        for (let j = 0; j < lis.length; j++) {
          const t = (lis[j].textContent || '').trim();
          if (t) items.push(t);
        }
        if (items.length) blocks.push({ type: 'list', ordered: tag === 'ol', items: items });
      } else if (tag === 'figure') {
        const img = node.querySelector('img');
        const cap = node.querySelector('figcaption');
        if (img && img.src) {
          blocks.push({ type: 'img', src: img.src, alt: img.alt || '',
            caption: cap ? (cap.textContent || '').trim() : '' });
        }
      } else if (tag === 'img') {
        // Keep the image unless it's a confirmed tiny tracking pixel.
        // naturalWidth is 0 for not-yet-loaded images, so those are kept.
        const w = node.naturalWidth;
        if (node.src && (w === 0 || w > 2)) {
          blocks.push({ type: 'img', src: node.src, alt: node.alt || '', caption: '' });
        }
      }
    }
    return blocks;
  }

  function hasAncestorBlock(node, root) {
    let p = node.parentElement;
    while (p && p !== root) {
      const tag = p.tagName.toLowerCase();
      if (tag === 'p' || tag === 'blockquote' || tag === 'ul' || tag === 'ol' ||
          tag === 'figure' || tag === 'pre' || /^h[1-6]$/.test(tag)) return true;
      p = p.parentElement;
    }
    return false;
  }

  function countWords(blocks) {
    let n = 0;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const text = b.text || (b.items ? b.items.join(' ') : '');
      if (text) n += text.split(/\s+/).filter(Boolean).length;
    }
    return n;
  }

  function extractArticle() {
    const root = findRoot();
    if (!root) return null;
    const titleEl = findTitleElement(root);
    const blocks = extractBlocks(root, titleEl);
    if (!blocks.length) return null;
    const words = countWords(blocks);
    const title = (titleEl && titleEl.textContent && titleEl.textContent.trim()) || cleanDocTitle();
    return {
      title: title,
      author: findAuthor(root),
      date: findDate(),
      readTime: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
      blocks: blocks
    };
  }

  // ───────── Overlay construction ─────────

  function buildOverlay() {
    overlayEl = el('div', 'easepass-rm-overlay');
    overlayEl.id = 'easepass-rm-overlay';
    overlayEl.addEventListener('click', function (e) {
      if (e.target === overlayEl) disable();
    });

    columnEl = el('div', 'easepass-rm-column');
    columnEl.setAttribute('role', 'document');
    columnEl.tabIndex = -1;

    // Progress bar.
    const progressWrap = el('div', 'easepass-rm-progress');
    progressFillEl = el('div', 'easepass-rm-progress-fill');
    progressLabelEl = el('span', 'easepass-rm-progress-label', '0%');
    progressWrap.appendChild(progressFillEl);
    progressWrap.appendChild(progressLabelEl);
    columnEl.appendChild(progressWrap);

    // Close (also a dwell target).
    const closeBtn = el('button', 'easepass-rm-close', '✕');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', STRINGS.close);
    closeBtn.addEventListener('click', disable);
    columnEl.appendChild(closeBtn);

    if (article.title) {
      const h = el('h1', 'easepass-rm-title', article.title);
      columnEl.appendChild(h);
    }

    // Metadata row.
    const metaBits = [];
    if (article.author) metaBits.push(STRINGS.by + ' ' + article.author);
    if (article.date) metaBits.push(article.date);
    metaBits.push(STRINGS.readTime(article.readTime));
    const meta = el('div', 'easepass-rm-meta', metaBits.join('  ·  '));
    columnEl.appendChild(meta);

    // Content.
    contentEl = el('div', 'easepass-rm-content');
    renderBlocks(contentEl);
    columnEl.appendChild(contentEl);

    // Paragraph indicator (focus mode).
    paraIndicatorEl = el('div', 'easepass-rm-progress-indicator');
    paraIndicatorEl.style.display = 'none';
    columnEl.appendChild(paraIndicatorEl);

    // Toolbar + settings panel.
    columnEl.appendChild(buildToolbar());
    settingsPanelEl = buildSettingsPanel();
    columnEl.appendChild(settingsPanelEl);

    overlayEl.appendChild(columnEl);
    try { document.documentElement.appendChild(overlayEl); } catch (_) {}
  }

  function renderBlocks(container) {
    paragraphEls = [];
    const blocks = article.blocks;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      let node;
      if (b.type === 'p') {
        node = el('p', 'easepass-rm-paragraph', b.text);
        paragraphEls.push(node);
      } else if (b.type === 'h') {
        node = el(b.level, 'easepass-rm-heading', b.text);
      } else if (b.type === 'quote') {
        node = el('blockquote', 'easepass-rm-quote', b.text);
      } else if (b.type === 'pre') {
        node = el('pre', 'easepass-rm-pre', b.text);
      } else if (b.type === 'list') {
        node = el(b.ordered ? 'ol' : 'ul', 'easepass-rm-list');
        for (let j = 0; j < b.items.length; j++) node.appendChild(el('li', null, b.items[j]));
      } else if (b.type === 'img') {
        node = el('figure', 'easepass-rm-figure');
        const img = el('img');
        img.src = b.src; img.alt = b.alt || ''; img.loading = 'lazy';
        node.appendChild(img);
        if (b.caption) node.appendChild(el('figcaption', null, b.caption));
      }
      if (node) container.appendChild(node);
    }
  }

  function toolbarToggle(id, label, on) {
    const btn = el('button', 'easepass-rm-tool', label);
    btn.type = 'button';
    btn.setAttribute('role', 'switch');
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
    btn.dataset.rmTool = id;
    return btn;
  }

  function buildToolbar() {
    const bar = el('div', 'easepass-rm-toolbar');

    const left = el('div', 'easepass-rm-toolbar-left');
    const exit = el('button', 'easepass-rm-tool easepass-rm-exit', STRINGS.exit);
    exit.type = 'button';
    exit.addEventListener('click', disable);
    left.appendChild(exit);

    const center = el('div', 'easepass-rm-toolbar-center');
    const focusBtn = toolbarToggle('focus', STRINGS.focus, settings.focusMode);
    const fatigueBtn = toolbarToggle('fatigue', STRINGS.fatigue, settings.fatigueMode);
    const simplifyBtn = toolbarToggle('simplify', STRINGS.simplify, settings.simplifyWords);
    focusBtn.addEventListener('click', function () { toggleFeature('focusMode', focusBtn); });
    fatigueBtn.addEventListener('click', function () { toggleFeature('fatigueMode', fatigueBtn); });
    simplifyBtn.addEventListener('click', function () { toggleFeature('simplifyWords', simplifyBtn); });
    center.appendChild(focusBtn);
    center.appendChild(fatigueBtn);
    center.appendChild(simplifyBtn);

    const right = el('div', 'easepass-rm-toolbar-right');
    const resetFatigue = el('button', 'easepass-rm-fatigue-reset', STRINGS.resetFatigue);
    resetFatigue.type = 'button';
    resetFatigue.style.display = settings.fatigueMode ? '' : 'none';
    resetFatigue.addEventListener('click', resetFatigue_);
    const copyBtn = el('button', 'easepass-rm-tool', STRINGS.copy);
    copyBtn.type = 'button';
    copyBtn.addEventListener('click', function () { copyArticle(copyBtn); });
    const settingsBtn = el('button', 'easepass-rm-tool', STRINGS.settings);
    settingsBtn.type = 'button';
    settingsBtn.addEventListener('click', toggleSettingsPanel);
    right.appendChild(resetFatigue);
    right.appendChild(copyBtn);
    right.appendChild(settingsBtn);

    bar.appendChild(left);
    bar.appendChild(center);
    bar.appendChild(right);
    return bar;
  }

  // ───────── Typography ─────────

  function autoTextColor(bg) {
    // Relative luminance → pick black or near-white text for contrast.
    const hex = (bg || '#FFFFFF').replace('#', '');
    if (hex.length < 6) return '#1a1a1a';
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum > 0.5 ? '#1a1a1a' : '#f2f2f2';
  }

  function applyTypography() {
    if (!styleEl) {
      styleEl = el('style');
      styleEl.id = 'easepass-rm-style';
      try { (document.head || document.documentElement).appendChild(styleEl); } catch (_) {}
    }
    const bg = settings.backgroundColor;
    const fg = (settings.textColor && settings.textColor !== 'auto')
      ? settings.textColor : autoTextColor(bg);
    const stack = FONT_STACKS[settings.fontFamily] || '';
    const charCap = (settings.maxCharsPerLine !== 'off')
      ? ('min(' + settings.columnWidth + 'px, ' + settings.maxCharsPerLine + 'ch)')
      : (settings.columnWidth + 'px');

    const lines = [];
    lines.push('#easepass-rm-overlay .easepass-rm-column {');
    lines.push('  background: ' + bg + ' !important;');
    lines.push('  color: ' + fg + ' !important;');
    lines.push('  max-width: ' + charCap + ' !important;');
    lines.push('}');
    lines.push('#easepass-rm-overlay .easepass-rm-content {');
    if (stack) lines.push('  font-family: ' + stack + ' !important;');
    lines.push('  font-size: ' + settings.fontSize + 'px !important;');
    lines.push('  line-height: ' + settings.lineHeight + ' !important;');
    lines.push('  letter-spacing: ' + settings.letterSpacing + 'em !important;');
    lines.push('  word-spacing: ' + settings.wordSpacing + 'em !important;');
    lines.push('  color: ' + fg + ' !important;');
    lines.push('}');
    lines.push('#easepass-rm-overlay .easepass-rm-content > * { margin-bottom: ' +
      settings.paragraphSpacing + 'em !important; }');
    lines.push('#easepass-rm-overlay .easepass-rm-title { color: ' + fg + ' !important; }');
    styleEl.textContent = lines.join('\n');

    // Dark theming hook for the rest of the chrome (toolbar etc.).
    const dark = autoTextColor(bg) === '#f2f2f2';
    if (columnEl) columnEl.classList.toggle('easepass-rm-dark', dark);
  }

  // ───────── Feature toggles ─────────

  function toggleFeature(key, btn) {
    settings[key] = !settings[key];
    if (btn) btn.setAttribute('aria-checked', settings[key] ? 'true' : 'false');
    if (key === 'focusMode') settings[key] ? enterFocus() : exitFocus();
    if (key === 'fatigueMode') settings[key] ? enterFatigue() : exitFatigue();
    if (key === 'simplifyWords') settings[key] ? applyVocab() : removeVocab();
  }

  // ───────── Focus mode ─────────

  function enterFocus() {
    if (!paragraphEls.length) return;
    columnEl.classList.add('easepass-rm-focus-active');
    paraIndicatorEl.style.display = '';
    for (let i = 0; i < paragraphEls.length; i++) {
      paragraphEls[i].addEventListener('mouseenter', onParaHover);
      paragraphEls[i].addEventListener('click', onParaClick);
    }
    setFocus(Math.min(focusIndex, paragraphEls.length - 1));
  }

  function exitFocus() {
    columnEl.classList.remove('easepass-rm-focus-active');
    paraIndicatorEl.style.display = 'none';
    for (let i = 0; i < paragraphEls.length; i++) {
      paragraphEls[i].classList.remove('easepass-rm-focused', 'easepass-rm-dimmed');
      paragraphEls[i].removeAttribute('tabindex');
      paragraphEls[i].removeEventListener('mouseenter', onParaHover);
      paragraphEls[i].removeEventListener('click', onParaClick);
    }
  }

  function onParaHover(e) {
    const i = paragraphEls.indexOf(e.currentTarget);
    if (i >= 0) setFocus(i, true);
  }

  // A click (manual or a completed dwell) on a paragraph advances reading.
  function onParaClick(e) {
    const i = paragraphEls.indexOf(e.currentTarget);
    if (i >= 0) { setFocus(i); advance(); }
  }

  function setFocus(i, fromHover) {
    focusIndex = Math.max(0, Math.min(i, paragraphEls.length - 1));
    for (let j = 0; j < paragraphEls.length; j++) {
      const p = paragraphEls[j];
      const isFocus = j === focusIndex;
      p.classList.toggle('easepass-rm-focused', isFocus);
      p.classList.toggle('easepass-rm-dimmed', !isFocus);
      // Only the focused paragraph is a dwell/keyboard target.
      if (isFocus) p.setAttribute('tabindex', '0');
      else p.removeAttribute('tabindex');
    }
    // When dwell clicking isn't available to auto-advance, surface the
    // keyboard fallback so the user isn't left with a silent dead end.
    let dwellActive = false;
    try {
      dwellActive = !!(window.AccessibilitySurferDwell &&
        window.AccessibilitySurferDwell.isEnabled &&
        window.AccessibilitySurferDwell.isEnabled());
    } catch (_) {}
    paraIndicatorEl.textContent = STRINGS.para(focusIndex + 1, paragraphEls.length) +
      (dwellActive ? '' : '  ·  ' + STRINGS.advanceHint);
    if (!fromHover) centerParagraph(paragraphEls[focusIndex]);
  }

  function advance() {
    if (focusIndex < paragraphEls.length - 1) {
      setFocus(focusIndex + 1);
    }
  }

  function centerParagraph(p) {
    if (!p || !columnEl) return;
    try {
      const behavior = reducedMotion() ? 'auto' : 'smooth';
      p.scrollIntoView({ block: 'center', behavior: behavior });
    } catch (_) {
      try { p.scrollIntoView(); } catch (_) {}
    }
  }

  // ───────── Fatigue compensation ─────────

  function enterFatigue() {
    const reset = columnEl.querySelector('.easepass-rm-fatigue-reset');
    if (reset) reset.style.display = '';
    updateFatigue();
  }

  function exitFatigue() {
    const reset = columnEl.querySelector('.easepass-rm-fatigue-reset');
    if (reset) reset.style.display = 'none';
    setFatigueVars(0);
  }

  function resetFatigue_() {
    // Snap compensation back to zero; it rebuilds as the user scrolls on.
    setFatigueVars(0);
  }

  function setFatigueVars(ratio) {
    if (!contentEl) return;
    contentEl.style.setProperty('--easepass-rm-fatigue-size', (FATIGUE_MAX_SIZE * ratio).toFixed(2) + 'px');
    contentEl.style.setProperty('--easepass-rm-fatigue-line', (FATIGUE_MAX_LINE * ratio).toFixed(3));
    contentEl.style.setProperty('--easepass-rm-fatigue-letter', (FATIGUE_MAX_LETTER * ratio).toFixed(4) + 'em');
  }

  function updateFatigue() {
    if (!settings.fatigueMode) return;
    setFatigueVars(scrollRatio());
  }

  // ───────── Vocabulary simplification ─────────

  function applyVocab() {
    if (!contentEl) return;
    let walker;
    try {
      walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          if (!node.nodeValue || !/[A-Za-z]/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
          let p = node.parentElement;
          while (p && p !== contentEl) {
            if (p.classList && p.classList.contains('easepass-rm-vocab')) return NodeFilter.FILTER_REJECT;
            p = p.parentElement;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });
    } catch (_) { return; }
    const targets = [];
    let n;
    while ((n = walker.nextNode())) targets.push(n);
    for (let i = 0; i < targets.length; i++) wrapVocab(targets[i]);
  }

  function wrapVocab(node) {
    const text = node.nodeValue;
    const tokens = text.match(/[A-Za-z]+|[^A-Za-z]+/g);
    if (!tokens) return;
    let any = false;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      const simple = /^[A-Za-z]/.test(tok) ? COMPLEX_WORDS[tok.toLowerCase()] : null;
      if (simple) {
        const span = el('span', 'easepass-rm-vocab', tok);
        span.tabIndex = 0;
        span.setAttribute('data-rm-simple', simple);
        span.setAttribute('role', 'button');
        span.setAttribute('aria-label', tok + ' — ' + simple);
        span.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.classList.toggle('easepass-rm-vocab-open'); }
        });
        frag.appendChild(span);
        any = true;
      } else {
        frag.appendChild(document.createTextNode(tok));
      }
    }
    if (any && node.parentNode) {
      try { node.parentNode.replaceChild(frag, node); } catch (_) {}
    }
  }

  function removeVocab() {
    if (!contentEl) return;
    let spans;
    try { spans = contentEl.querySelectorAll('.easepass-rm-vocab'); } catch (_) { return; }
    for (let i = 0; i < spans.length; i++) {
      const s = spans[i];
      if (s.parentNode) {
        try { s.parentNode.replaceChild(document.createTextNode(s.textContent), s); } catch (_) {}
      }
    }
    try { contentEl.normalize(); } catch (_) {}
  }

  // ───────── Progress + scroll ─────────

  function scrollRatio() {
    if (!columnEl) return 0;
    const max = columnEl.scrollHeight - columnEl.clientHeight;
    if (max <= 0) return 0;
    return Math.max(0, Math.min(1, columnEl.scrollTop / max));
  }

  function updateProgress() {
    const pct = Math.round(scrollRatio() * 100);
    if (progressFillEl) progressFillEl.style.width = pct + '%';
    if (progressLabelEl) progressLabelEl.textContent = STRINGS.progress(pct);
  }

  // ───────── Export ─────────

  function articleToText() {
    const parts = [];
    if (article.title) parts.push(article.title);
    const meta = [];
    if (article.author) meta.push(STRINGS.by + ' ' + article.author);
    if (article.date) meta.push(article.date);
    if (meta.length) parts.push(meta.join('  ·  '));
    for (let i = 0; i < article.blocks.length; i++) {
      const b = article.blocks[i];
      if (b.type === 'list') parts.push(b.items.map(function (t) { return '• ' + t; }).join('\n'));
      else if (b.type === 'img') { if (b.caption) parts.push('[' + b.caption + ']'); }
      else if (b.text) parts.push(b.text);
    }
    // Uniform blank line between every block (no stray extra gaps).
    return parts.join('\n\n');
  }

  function copyArticle(btn) {
    const text = articleToText();
    const done = function () {
      if (!btn) return;
      const orig = btn.textContent;
      btn.textContent = STRINGS.copied;
      setTimeout(function () { btn.textContent = orig; }, 1400);
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
      } else { fallbackCopy(text, done); }
    } catch (_) { fallbackCopy(text, done); }
  }

  function fallbackCopy(text, done) {
    try {
      const ta = el('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    } catch (_) {}
  }

  // ───────── Settings panel ─────────

  function slider(id, label, min, max, step, value, unit) {
    const row = el('div', 'easepass-rm-field');
    const lab = el('label', 'easepass-rm-field-label', label);
    lab.setAttribute('for', 'easepass-rm-' + id);
    const valSpan = el('span', 'easepass-rm-field-value', String(value) + (unit || ''));
    lab.appendChild(valSpan);
    const input = el('input');
    input.type = 'range';
    input.id = 'easepass-rm-' + id;
    input.min = String(min); input.max = String(max); input.step = String(step);
    input.value = String(value);
    input.dataset.rmField = id;
    input.dataset.rmUnit = unit || '';
    row.appendChild(lab);
    row.appendChild(input);
    return row;
  }

  function pillRow(label, field, options) {
    const row = el('div', 'easepass-rm-field');
    row.appendChild(el('span', 'easepass-rm-field-label', label));
    const group = el('div', 'easepass-rm-pill-group');
    group.setAttribute('role', 'group');
    for (let i = 0; i < options.length; i++) {
      const b = el('button', 'easepass-rm-pill', options[i][0]);
      b.type = 'button';
      b.dataset.rmPill = field;
      b.dataset.rmValue = String(options[i][1]);
      b.setAttribute('aria-pressed', String(settings[field]) === String(options[i][1]) ? 'true' : 'false');
      group.appendChild(b);
    }
    row.appendChild(group);
    return row;
  }

  function buildSettingsPanel() {
    const panel = el('div', 'easepass-rm-settings-panel');
    panel.style.display = 'none';

    panel.appendChild(pillRow(STRINGS.fontLabel, 'fontFamily', [
      ['Default', 'default'], ['Lexend', 'lexend'], ['OpenDyslexic', 'opendyslexic'],
      ['Atkinson', 'atkinson'], ['Arial', 'arial'], ['Comic', 'comic']
    ]));
    panel.appendChild(slider('fontSize', STRINGS.sizeLabel, 14, 24, 1, settings.fontSize, 'px'));
    panel.appendChild(slider('lineHeight', STRINGS.lineLabel, 1.4, 2.4, 0.1, settings.lineHeight, ''));
    panel.appendChild(slider('letterSpacing', STRINGS.letterLabel, 0, 0.12, 0.01, settings.letterSpacing, 'em'));
    panel.appendChild(slider('wordSpacing', STRINGS.wordLabel, 0, 0.25, 0.01, settings.wordSpacing, 'em'));
    panel.appendChild(slider('columnWidth', STRINGS.widthLabel, 480, 900, 10, settings.columnWidth, 'px'));
    panel.appendChild(slider('paragraphSpacing', STRINGS.paraLabel, 0.5, 2.5, 0.1, settings.paragraphSpacing, 'em'));
    panel.appendChild(pillRow(STRINGS.charsLabel, 'maxCharsPerLine', [
      ['Off', 'off'], ['60', 60], ['70', 70], ['80', 80]
    ]));

    // Background swatches.
    const bgRow = el('div', 'easepass-rm-field');
    bgRow.appendChild(el('span', 'easepass-rm-field-label', STRINGS.bgLabel));
    const swatches = el('div', 'easepass-rm-swatches');
    for (let i = 0; i < BG_SWATCHES.length; i++) {
      const val = BG_SWATCHES[i][1];
      if (val === 'custom') {
        const picker = el('input', 'easepass-rm-swatch easepass-rm-swatch-custom');
        picker.type = 'color';
        picker.value = (settings.backgroundColor[0] === '#') ? settings.backgroundColor : '#FFFFFF';
        picker.title = 'Custom background color';
        picker.setAttribute('aria-label', 'Custom background color');
        picker.addEventListener('input', function () {
          settings.backgroundColor = picker.value; applyTypography();
        });
        swatches.appendChild(picker);
      } else {
        const sw = el('button', 'easepass-rm-swatch');
        sw.type = 'button';
        sw.style.background = val;
        sw.title = BG_SWATCHES[i][0];
        sw.setAttribute('aria-label', BG_SWATCHES[i][0]);
        sw.dataset.rmBg = val;
        swatches.appendChild(sw);
      }
    }
    bgRow.appendChild(swatches);
    panel.appendChild(bgRow);

    // Save / reset.
    const actions = el('div', 'easepass-rm-panel-actions');
    const save = el('button', 'easepass-rm-panel-btn easepass-rm-panel-save', STRINGS.saveDefault);
    save.type = 'button';
    save.addEventListener('click', function () { saveSettings(); });
    const reset = el('button', 'easepass-rm-panel-btn', STRINGS.reset);
    reset.type = 'button';
    reset.addEventListener('click', resetSettings);
    actions.appendChild(save);
    actions.appendChild(reset);
    panel.appendChild(actions);

    // Wire live controls (event delegation).
    panel.addEventListener('input', function (e) {
      const f = e.target.dataset.rmField;
      if (!f) return;
      const unit = e.target.dataset.rmUnit || '';
      const num = parseFloat(e.target.value);
      settings[f] = num;
      const valSpan = e.target.parentElement.querySelector('.easepass-rm-field-value');
      if (valSpan) valSpan.textContent = String(num) + unit;
      applyTypography();
    });
    panel.addEventListener('click', function (e) {
      const pillField = e.target.dataset.rmPill;
      if (pillField) {
        let v = e.target.dataset.rmValue;
        if (pillField === 'maxCharsPerLine' && v !== 'off') v = parseInt(v, 10);
        settings[pillField] = v;
        const group = e.target.parentElement;
        const pills = group.querySelectorAll('.easepass-rm-pill');
        for (let i = 0; i < pills.length; i++) {
          pills[i].setAttribute('aria-pressed', pills[i] === e.target ? 'true' : 'false');
        }
        applyTypography();
      }
      const bg = e.target.dataset.rmBg;
      if (bg) {
        settings.backgroundColor = bg;
        settings.textColor = 'auto';
        applyTypography();
      }
    });

    return panel;
  }

  function toggleSettingsPanel() {
    if (!settingsPanelEl) return;
    settingsPanelEl.style.display = (settingsPanelEl.style.display === 'none') ? '' : 'none';
  }

  function resetSettings() {
    const keepView = clone(DEFAULTS);
    settings = keepView;
    applyTypography();
    // Rebuild panel + toolbar states cheaply: re-open fresh.
    if (settings.simplifyWords) applyVocab(); else removeVocab();
    if (settings.focusMode) enterFocus(); else exitFocus();
    if (settings.fatigueMode) enterFatigue(); else exitFatigue();
    refreshControls();
  }

  // Sync panel + toolbar widgets to the current settings (after reset/update).
  function refreshControls() {
    if (!columnEl) return;
    const tools = { focus: 'focusMode', fatigue: 'fatigueMode', simplify: 'simplifyWords' };
    const toolBtns = columnEl.querySelectorAll('[data-rm-tool]');
    for (let i = 0; i < toolBtns.length; i++) {
      const key = tools[toolBtns[i].dataset.rmTool];
      toolBtns[i].setAttribute('aria-checked', settings[key] ? 'true' : 'false');
    }
    if (!settingsPanelEl) return;
    const ranges = settingsPanelEl.querySelectorAll('[data-rm-field]');
    for (let i = 0; i < ranges.length; i++) {
      const f = ranges[i].dataset.rmField;
      ranges[i].value = String(settings[f]);
      const vs = ranges[i].parentElement.querySelector('.easepass-rm-field-value');
      if (vs) vs.textContent = String(settings[f]) + (ranges[i].dataset.rmUnit || '');
    }
    const pills = settingsPanelEl.querySelectorAll('[data-rm-pill]');
    for (let i = 0; i < pills.length; i++) {
      const f = pills[i].dataset.rmPill;
      pills[i].setAttribute('aria-pressed', String(settings[f]) === String(pills[i].dataset.rmValue) ? 'true' : 'false');
    }
  }

  // ───────── Reading-mode-available pill ─────────

  function maybeShowPill() {
    if (active || pillEl) return;
    safeGet([DOMAINS_KEY], function (data) {
      const state = (data[DOMAINS_KEY] || {})[domain()];
      if (state !== 'on') return; // only for remembered (not dismissed) domains
      showPill();
    });
  }

  function showPill() {
    if (pillEl) return;
    pillEl = el('div', 'easepass-rm-pill');
    pillEl.setAttribute('role', 'region');
    pillEl.appendChild(el('span', 'easepass-rm-pill-text', STRINGS.pill));
    const enableBtn = el('button', 'easepass-rm-pill-btn easepass-rm-pill-enable', STRINGS.enable);
    enableBtn.type = 'button';
    enableBtn.addEventListener('click', function () { removePill(); enable(); });
    const dismissBtn = el('button', 'easepass-rm-pill-btn', STRINGS.dismiss);
    dismissBtn.type = 'button';
    dismissBtn.addEventListener('click', function () { dismissDomain(); removePill(); });
    pillEl.appendChild(enableBtn);
    pillEl.appendChild(dismissBtn);
    try { document.documentElement.appendChild(pillEl); } catch (_) {}
    requestAnimationFrame(function () { if (pillEl) pillEl.classList.add('easepass-rm-pill-visible'); });
  }

  function removePill() {
    if (!pillEl) return;
    const p = pillEl;
    pillEl = null;
    p.classList.remove('easepass-rm-pill-visible');
    setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 220);
  }

  // ───────── Lifecycle ─────────

  function enable(newSettings) {
    if (active) { if (newSettings) updateSettings(newSettings); return; }
    // Clear any leftover "no article" overlay so retrying on another page works.
    if (overlayEl && overlayEl.parentNode) {
      try { overlayEl.parentNode.removeChild(overlayEl); } catch (_) {}
    }
    overlayEl = null;
    mergeSettings(newSettings);

    article = extractArticle();
    if (!article) { showNoContent(); return; }

    removePill();
    buildOverlay();
    applyTypography();

    // Lock background scroll (restored exactly on disable).
    try {
      prevHtmlOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
    } catch (_) {}

    // Scroll-driven features.
    onColumnScroll = function () { updateProgress(); updateFatigue(); };
    columnEl.addEventListener('scroll', onColumnScroll, { passive: true });

    // Keyboard: down/space advance in focus mode; Escape exits.
    onKeyDown = function (e) {
      if (!active) return;
      if (e.key === 'Escape') { e.preventDefault(); disable(); return; }
      if (settings.focusMode && (e.key === 'ArrowDown' || e.key === ' ')) {
        e.preventDefault(); advance();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);

    if (settings.simplifyWords) applyVocab();
    if (settings.focusMode) enterFocus();
    if (settings.fatigueMode) enterFatigue();
    updateProgress();

    active = true;
    rememberDomain();

    if (!reducedMotion()) requestAnimationFrame(function () { overlayEl.classList.add('easepass-rm-open'); });
    else overlayEl.classList.add('easepass-rm-open');
  }

  function disable() {
    if (!active && !overlayEl) return;

    // Detach listeners immediately so nothing lingers during the slide-out.
    if (onColumnScroll && columnEl) columnEl.removeEventListener('scroll', onColumnScroll);
    if (onKeyDown) document.removeEventListener('keydown', onKeyDown, true);
    onColumnScroll = null; onKeyDown = null;

    const finish = function () {
      if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
      if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
      try { document.documentElement.style.overflow = prevHtmlOverflow; } catch (_) {}
      overlayEl = columnEl = contentEl = styleEl = null;
      progressFillEl = progressLabelEl = paraIndicatorEl = settingsPanelEl = null;
      paragraphEls = [];
      focusIndex = 0;
      article = null;
      active = false;
    };

    if (overlayEl && !reducedMotion()) {
      overlayEl.classList.remove('easepass-rm-open');
      setTimeout(finish, 240);
    } else {
      finish();
    }
  }

  function showNoContent() {
    // Minimal, dismissable overlay — no article was found.
    overlayEl = el('div', 'easepass-rm-overlay easepass-rm-open');
    overlayEl.id = 'easepass-rm-overlay';
    overlayEl.addEventListener('click', function (e) { if (e.target === overlayEl) disable(); });
    const box = el('div', 'easepass-rm-column easepass-rm-empty');
    box.appendChild(el('p', 'easepass-rm-empty-text', STRINGS.noContent));
    const closeBtn = el('button', 'easepass-rm-tool', STRINGS.close);
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', disable);
    box.appendChild(closeBtn);
    overlayEl.appendChild(box);
    try { document.documentElement.appendChild(overlayEl); } catch (_) {}
    // Intentionally NOT setting active = true: there's no live reading session,
    // so enable() can retry on another page and updateSettings() stays a no-op.
    // disable() still tears down this overlay (its guard also checks overlayEl).
  }

  function updateSettings(newSettings) {
    mergeSettings(newSettings);
    if (!active) return;
    applyTypography();
    if (settings.simplifyWords) applyVocab(); else removeVocab();
    if (settings.focusMode) enterFocus(); else exitFocus();
    if (settings.fatigueMode) enterFatigue(); else exitFatigue();
    refreshControls();
  }

  // ───────── Public API ─────────

  window.AccessibilitySurferReadingMode = {
    enable: enable,
    disable: disable,
    isActive: function () { return active; },
    updateSettings: updateSettings,
    maybeShowPill: maybeShowPill,
    toggle: function (s) { active ? disable() : enable(s); }
  };

  // Load saved defaults up front so the first enable() uses them. Does not
  // open anything — purely reads stored settings into memory.
  safeGet([SETTINGS_KEY], function (data) { mergeSettings(data[SETTINGS_KEY]); });
})();
