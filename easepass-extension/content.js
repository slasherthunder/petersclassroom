/*
 * EasePass — content script (dwell clicking + text accessibility).
 *
 * Runs on <all_urls> (per manifest match). Behavior is split by host:
 *   - On youtube.com: a curated list of YouTube targets (video
 *     thumbnails, player buttons, search bar, subscribe/like) plus a
 *     status pill.
 *   - On every other site: any interactive element (links, buttons,
 *     inputs, role="button", …) is a dwell target — see IS_YOUTUBE.
 * The text-accessibility feature (font/size/spacing) runs everywhere.
 *
 * When the cursor hovers a target a circular progress ring appears
 * around the cursor and fills over the configured dwell time. When the
 * ring completes, EasePass fires a click on the target.
 *
 * Cursor leaves the target  → timer pauses, ring fades out.
 * Cursor returns within 1s → timer RESUMES from where it left off.
 * Cursor returns after 1s   → timer restarts from zero.
 *
 * No accidental clicks: even 1px outside the element ends the dwell.
 * No page DOM is modified — we only inject overlay elements.
 */

(function () {
  'use strict';

  // ───────── Constants ─────────

  // Targets are matched in two ways and tried in priority order:
  //
  //   - DIRECT (entry.sel): closest(sel) finds the element itself or an
  //     ancestor. The matched element is both the visual highlight and
  //     the click target.
  //   - WRAPPER (entry.wrap + entry.inner): closest(wrap) walks up to a
  //     card-level wrapper, then querySelector(inner) looks INSIDE for
  //     the actual anchor. The wrapper is the visual highlight (so the
  //     ring centers on the whole card) and the inner anchor is what
  //     gets clicked. This is required for modern split-link layouts
  //     like yt-lockup-view-model where the <a href> only wraps the
  //     title text and the thumbnail image sits outside that anchor.
  //
  // `minSize` is an optional size gate (applied to the visual element)
  // so broad URL selectors don't fire on tiny text links in descriptions.
  const TARGET_SELECTORS = [
    // ─── Search bar (input element, needs explicit entry) ───
    { sel: 'input#search', type: 'button' },

    // ─── Generic button catch-all ───
    // Any visible <button> or role="button" becomes a dwell target with
    // the standard button dwell time. This single rule covers every
    // YouTube control without enumeration: player buttons (play, mute,
    // fullscreen, captions, settings, quality, theater, miniplayer,
    // autoplay, …), subscribe, like / dislike, share, save, download,
    // join, channel-page tabs, comment actions (heart, reply, more),
    // filter chips, sidebar entries, 3-dot menus, notifications, the
    // hamburger menu, and so on.
    { sel: 'button:not([disabled]):not([aria-hidden="true"])',
      type: 'button', minSize: { w: 22, h: 20 } },
    { sel: '[role="button"]:not([aria-disabled="true"]):not([aria-hidden="true"])',
      type: 'button', minSize: { w: 22, h: 20 } },
    // YouTube's video player uses <div class="ytp-button"> for some
    // controls instead of real <button> elements, so cover them too.
    { sel: '#movie_player .ytp-button:not([aria-hidden="true"])',
      type: 'button', minSize: { w: 22, h: 20 } },

    // ─── Direct URL match — every YouTube video endpoint ───
    // Covers cards where the <a> wraps the thumbnail itself.
    { sel: 'a[href*="/watch?"]',  type: 'video', minSize: { w: 120, h: 60 } },
    { sel: 'a[href*="/shorts/"]', type: 'video', minSize: { w: 80,  h: 80 } },
    { sel: 'a[href*="/live/"]',   type: 'video', minSize: { w: 120, h: 60 } },
    { sel: 'a[href*="/v/"]',      type: 'video', minSize: { w: 120, h: 60 } },
    { sel: 'a[href*="/embed/"]',  type: 'video', minSize: { w: 120, h: 60 } },

    // ─── Wrapper fallbacks — for split-link layouts ───
    // Modern overhaul cards.
    { wrap: 'yt-lockup-view-model',
      inner: 'a[href*="/watch?"], a[href*="/shorts/"], a[href*="/live/"]',
      type: 'video', minSize: { w: 100, h: 60 } },
    // Standard home feed grid items.
    { wrap: 'ytd-rich-item-renderer',
      inner: 'a[href*="/watch?"], a[href*="/shorts/"]',
      type: 'video', minSize: { w: 100, h: 60 } },
    // Inner media component of the rich grid.
    { wrap: 'ytd-rich-grid-media',
      inner: 'a[href*="/watch?"]',
      type: 'video', minSize: { w: 100, h: 60 } },
    // Trending / editorial sections.
    { wrap: 'ytd-rich-section-renderer',
      inner: 'a[href*="/watch?"], a[href*="/shorts/"]',
      type: 'video', minSize: { w: 100, h: 60 } },
    // Watch-page suggested sidebar (classic).
    { wrap: 'ytd-compact-video-renderer',
      inner: 'a[href*="/watch?"]',
      type: 'video', minSize: { w: 100, h: 50 } },
    // Playlist panel queue beside the player.
    { wrap: 'ytd-playlist-panel-video-renderer',
      inner: 'a[href*="/watch?"]',
      type: 'video', minSize: { w: 80, h: 40 } },
    // Primary search-result list item.
    { wrap: 'ytd-video-renderer',
      inner: 'a[href*="/watch?"]',
      type: 'video', minSize: { w: 120, h: 60 } },
    // Channel-tab classic grid item.
    { wrap: 'ytd-grid-video-renderer',
      inner: 'a[href*="/watch?"]',
      type: 'video', minSize: { w: 100, h: 60 } },
    // Featured auto-playing spotlight on a channel page.
    { wrap: 'ytd-channel-video-player-renderer',
      inner: 'a[href*="/watch?"]',
      type: 'video', minSize: { w: 200, h: 100 } },

    // ─── Universal fallback (last resort) ───
    // Walk up from the cursor and accept the smallest ancestor that
    // (a) is at least card-sized AND (b) contains a watch/shorts/live
    // anchor as a descendant. Catches layouts where the thumbnail image
    // is a *sibling* of the anchor — hover-preview overlays, lockup
    // view models where the anchor lives in a separate metadata block,
    // and any future YouTube layout we haven't explicitly named.
    { fallback: true, type: 'video', minSize: { w: 100, h: 60 } }
  ];

  // ═══════════════ SITE GATE ═══════════════
  // The dwell-clicking feature is YouTube-only. The text-accessibility
  // panel runs on every site. content.js used to be scoped to YouTube
  // via the manifest; now it runs on <all_urls> so we gate each dwell-
  // click event handler with this flag instead of restructuring the
  // whole IIFE.
  const IS_YOUTUBE = /(^|\.)youtube\.com$/i.test(location.hostname);

  const RESUME_WINDOW_MS = 1000; // resume-on-return grace period
  const COMPLETE_FLASH_MS = 380; // green flash + ripple duration before click
  const FADE_OUT_MS = 180;       // ring fade-out on cursor leave
  const RING_BOX = 56;           // SVG viewBox edge & container size (px)
  const RING_RADIUS = 26;        // arc radius inside that viewBox
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ≈ 163.36

  // ───────── State ─────────

  // Settings synced from chrome.storage.local.
  // `enabled` = YouTube dwell-click on/off (existing).
  // `universalEnabled` = dwell-click on/off for every other site.
  let enabled = true;
  let universalEnabled = true;
  let videoDwellTime = 5000;
  let buttonDwellTime = 3000;
  let universalDwellTime = 3000;

  // True when dwell-click is enabled in THIS page's context. On YouTube
  // we look at `enabled`; on every other site we look at `universalEnabled`.
  function isDwellEnabledHere() {
    return IS_YOUTUBE ? enabled : universalEnabled;
  }

  // The dwell duration to use for a given target type.
  function dwellTimeFor(type) {
    if (type === 'video')  return videoDwellTime;
    if (type === 'button') return buttonDwellTime;
    return universalDwellTime; // 'universal' fallback for everything else
  }

  // Active dwell session. null when nothing being dwelled.
  // { el, type, ring, startTime, elapsed, dwellTime, rafId }
  let active = null;

  // Last cancelled session, retained briefly for resume-on-return.
  // { el, elapsed, leftAt }
  let lastSession = null;

  // ───────── Extension-context guard ─────────
  // When the extension is reloaded / updated, content scripts already
  // running on open tabs become "orphaned" — they can no longer talk
  // to chrome.* and every call throws "Extension context invalidated."
  // We check liveness before any chrome.* access and silently swallow
  // residual errors via a window-level handler.

  function isExtensionAlive() {
    try {
      return typeof chrome !== 'undefined' &&
             !!chrome.runtime &&
             !!chrome.runtime.id;
    } catch (_) {
      return false;
    }
  }

  // Wrapper for any chrome.* call so an invalidated context doesn't
  // throw into the rest of the script. Returns true on success.
  function safeChrome(fn) {
    if (!isExtensionAlive()) return false;
    try { fn(); return true; } catch (_) { return false; }
  }

  // Last-line defense: catch the residual error if anything still slips
  // through (e.g., a storage.onChanged callback firing exactly during
  // invalidation). preventDefault() keeps it out of the page console.
  window.addEventListener('error', (e) => {
    if (e && e.message && /Extension context invalidated/i.test(e.message)) {
      e.preventDefault();
      e.stopImmediatePropagation && e.stopImmediatePropagation();
      return true;
    }
  }, true);

  // ───────── Settings sync ─────────

  // Load initial settings, then begin listening for live updates.
  // All chrome.* access is wrapped — if the extension is reloaded
  // mid-session, the orphaned content script falls back to its in-memory
  // defaults instead of crashing.
  safeChrome(() => {
    chrome.storage.local.get(
      ['enabled', 'universalEnabled', 'videoDwellTime', 'buttonDwellTime', 'universalDwellTime'],
      (data) => {
        // Guard the callback too: it can fire after context invalidation.
        try {
          if (chrome.runtime && chrome.runtime.lastError) return;
          enabled = data.enabled !== false;
          universalEnabled = data.universalEnabled !== false;
          videoDwellTime     = Number(data.videoDwellTime)     || 5000;
          buttonDwellTime    = Number(data.buttonDwellTime)    || 3000;
          universalDwellTime = Number(data.universalDwellTime) || 3000;
          if (enabled && IS_YOUTUBE) showStatus();
          paintDwellToggle();
        } catch (_) {}
      }
    );

    chrome.storage.onChanged.addListener((changes, area) => {
      // Guard the listener body — Chrome can deliver one last event
      // exactly during invalidation, which would otherwise throw into
      // our code path.
      try {
        if (!isExtensionAlive()) return;
        if (area !== 'local') return;
        if (changes.enabled) {
          enabled = changes.enabled.newValue !== false;
          if (IS_YOUTUBE) {
            if (!enabled) { cancelDwell(); hideStatus(); }
            else showStatus();
          }
          paintDwellToggle();
        }
        if (changes.universalEnabled) {
          universalEnabled = changes.universalEnabled.newValue !== false;
          if (!IS_YOUTUBE && !universalEnabled) cancelDwell();
          paintDwellToggle();
        }
        if (changes.videoDwellTime) {
          videoDwellTime = Number(changes.videoDwellTime.newValue) || 5000;
          if (active && active.type === 'video') active.dwellTime = videoDwellTime;
        }
        if (changes.buttonDwellTime) {
          buttonDwellTime = Number(changes.buttonDwellTime.newValue) || 3000;
          if (active && active.type === 'button') active.dwellTime = buttonDwellTime;
        }
        if (changes.universalDwellTime) {
          universalDwellTime = Number(changes.universalDwellTime.newValue) || 3000;
          if (active && active.type === 'universal') active.dwellTime = universalDwellTime;
        }
      } catch (_) {}
    });
  });

  // ───────── Target detection ─────────

  // Every YouTube card-level wrapper we know about. When a direct URL
  // selector matches a video anchor, we climb up to one of these and
  // use it for both the visual ring and the size check. The reason: in
  // modern grid layouts the <a href="/watch?…"> is constrained to the
  // title-text strip and is only ~24px tall, so a getBoundingClientRect
  // on the anchor itself would fail any reasonable minSize threshold
  // even though the card is clearly a big visible thumbnail.
  const VIDEO_CARD_WRAPPERS = [
    'yt-lockup-view-model',
    'ytd-rich-item-renderer',
    'ytd-rich-grid-media',
    'ytd-rich-section-renderer',
    'ytd-compact-video-renderer',
    'ytd-playlist-panel-video-renderer',
    'ytd-video-renderer',
    'ytd-grid-video-renderer',
    'ytd-channel-video-player-renderer'
  ].join(', ');

  // True when the cursor is on (or inside) a thumbnail image / media
  // area. Used to gate the universal fallback inside findTarget(), so
  // it must be defined BEFORE findTarget — both the helper and the
  // const it reads. (Function declarations get hoisted, but the const
  // they read does not, so calling isThumbnailArea before the const
  // line had executed would throw a TDZ ReferenceError.)
  const THUMBNAIL_CONTAINERS =
    'ytd-thumbnail, ' +
    'yt-thumbnail-view-model, ' +
    'yt-collection-thumbnail-view-model, ' +
    'yt-image, ' +
    'ytd-moving-thumbnail-renderer, ' +
    'ytd-thumbnail-overlay-time-status-renderer, ' +
    '#thumbnail';

  function isThumbnailArea(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toUpperCase();
    // Direct media elements
    if (tag === 'IMG' || tag === 'VIDEO' || tag === 'PICTURE' ||
        tag === 'CANVAS' || tag === 'YT-IMAGE') return true;
    // Inside a known thumbnail container
    if (el.closest) {
      try { return !!el.closest(THUMBNAIL_CONTAINERS); } catch (_) {}
    }
    return false;
  }

  // ───────── Universal interactive selector (non-YouTube sites) ─────────
  // A single composite selector — one closest() call resolves the
  // nearest interactive ancestor regardless of which kind it is.
  // Combined into one string for performance: on every mouseover we'd
  // otherwise iterate ~14 individual selectors.
  const UNIVERSAL_SELECTOR = [
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

  // Minimum element size to count as a target on non-YouTube sites —
  // skips tiny decorative buttons or hidden interactive elements.
  const UNIVERSAL_MIN_W = 22;
  const UNIVERSAL_MIN_H = 18;

  // Universal-mode target lookup: any interactive element gets a
  // 3-second dwell, no special selectors, no per-element customization.
  function findUniversalTarget(el) {
    if (!el || !el.closest) return null;
    const hit = el.closest(UNIVERSAL_SELECTOR);
    if (!hit) return null;
    const r = hit.getBoundingClientRect();
    if (r.width < UNIVERSAL_MIN_W || r.height < UNIVERSAL_MIN_H) return null;
    return { el: hit, clickTarget: hit, type: 'universal' };
  }

  // ───────── Comprehensive YouTube UI button list ─────────
  // Hand-curated selectors covering every standard YouTube surface:
  // sidebar, masthead, player chrome, watch-page actions, feed chips,
  // and comments. These bypass the minSize geometry guard — even thin
  // controls like the progress bar or a tiny sort dropdown are valid
  // dwell targets here. Tried BEFORE the generic catch-alls so that
  // YouTube-specific layouts always win.
  const UI_BUTTON_SELECTORS = [
    // ── Left sidebar nav ──
    'ytd-guide-entry-renderer a',
    'ytd-mini-guide-entry-renderer a',
    'ytd-guide-collapsible-entry-renderer',
    '#sections ytd-guide-section-renderer a',
    // ── Top header / masthead ──
    '#masthead-container button',
    '#masthead-container ytd-topbar-menu-button-renderer',
    '#avatar-btn.ytd-topbar-menu-button-renderer',
    'button#search-icon-legacy',
    // ── Video player chrome ──
    '.ytp-chrome-controls button',
    '.ytp-button',
    '.ytp-progress-bar-container',
    '.ytp-chapters-container',
    '.ytp-cards-button',
    '.ytp-autonav-toggle-button',
    // ── Watch-page contextual actions ──
    'ytd-subscribe-button-renderer button',
    '#top-level-buttons-computed button',
    'ytd-button-renderer.ytd-menu-renderer a',
    '#flexible-item-buttons button',
    // ── Feed filter chips & utility ──
    'yt-chip-cloud-chip-renderer',
    '#left-arrow button',
    '#right-arrow button',
    'button[aria-label="Action menu"]',
    // ── Comments ──
    'ytd-comment-action-buttons-renderer button',
    '#expand-button button',
    '#collapse-button button',
    '#sort-menu yt-dropdown-menu'
  ];

  // Walk ancestry to find the closest supported target for an element.
  // Returns { el, clickTarget, type } or null.
  //
  //   - el:          element used for visual highlight & contains() checks
  //   - clickTarget: element to .click() when the dwell completes
  //     (same as el for non-video direct matches; an inner <a> for video
  //     matches where the card wrapper is the visual but the anchor is
  //     what actually navigates).
  function findTarget(el) {
    if (!el || !el.closest) return null;

    // Non-YouTube sites use the universal interactive-element matcher
    // and skip every YouTube-specific selector below. Single closest()
    // call keeps this fast on every mouseover.
    if (!IS_YOUTUBE) return findUniversalTarget(el);

    // ── Priority 0: comprehensive YouTube UI button list ──
    // Hand-curated selectors that bypass the minSize geometry guard.
    // A thin progress bar, a tiny sort dropdown, a sidebar entry, etc.
    // are all valid dwell targets here. Tried before TARGET_SELECTORS
    // so YouTube-specific layouts always win over the generic rules.
    for (const sel of UI_BUTTON_SELECTORS) {
      const hit = el.closest(sel);
      if (hit) return { el: hit, clickTarget: hit, type: 'button' };
    }

    for (const entry of TARGET_SELECTORS) {
      // ── DIRECT match ──
      if (entry.sel) {
        const hit = el.closest(entry.sel);
        if (!hit) continue;

        // For video URL matches, the anchor itself may be a thin
        // title-area strip in modern grid layouts. Promote the visual
        // element + size check to the surrounding card wrapper when
        // one exists, but keep the anchor as the click target.
        let visualEl = hit;
        let sizeEl   = hit;
        if (entry.type === 'video') {
          const card = hit.closest(VIDEO_CARD_WRAPPERS);
          if (card) {
            visualEl = card;
            sizeEl   = card;
          }
        }

        if (entry.minSize) {
          const r = sizeEl.getBoundingClientRect();
          if (r.width < entry.minSize.w || r.height < entry.minSize.h) continue;
        }
        return { el: visualEl, clickTarget: hit, type: entry.type };
      }

      // ── WRAPPER match (split-link layouts with no anchor on cursor) ──
      if (entry.wrap) {
        const wrapper = el.closest(entry.wrap);
        if (!wrapper) continue;
        const inner = wrapper.querySelector(entry.inner);
        if (!inner) continue;
        if (entry.minSize) {
          const r = wrapper.getBoundingClientRect();
          if (r.width < entry.minSize.w || r.height < entry.minSize.h) continue;
        }
        return { el: wrapper, clickTarget: inner, type: entry.type };
      }

      // ── FALLBACK match (only when cursor is on a thumbnail image) ──
      // Walking up to find ANY ancestor with a video anchor would match
      // hovers over titles, channel names, badges, and even whitespace.
      // Gate the fallback so it only fires when the cursor is actually
      // on a media element or inside a thumbnail container.
      if (entry.fallback) {
        if (!isThumbnailArea(el)) continue;

        let cur = el;
        let depth = 0;
        while (cur && cur !== document.body && cur !== document.documentElement && depth < 12) {
          if (cur.querySelector) {
            const anchor = cur.querySelector(
              'a[href*="/watch?"], a[href*="/shorts/"], a[href*="/live/"]'
            );
            if (anchor) {
              const r = cur.getBoundingClientRect();
              if (r.width >= entry.minSize.w && r.height >= entry.minSize.h) {
                // If a known card wrapper sits around this match, promote
                // the visual element up to it so the ring centers on the
                // whole card rather than just the thumbnail container.
                const card = cur.closest(VIDEO_CARD_WRAPPERS);
                return {
                  el: card || cur,
                  clickTarget: anchor,
                  type: entry.type
                };
              }
            }
          }
          cur = cur.parentElement;
          depth++;
        }
      }
    }
    return null;
  }

  // Resolve a dwell target for a mouse event, transparently crossing
  // shadow-DOM boundaries. findTarget()'s closest() calls stop at the
  // shadow root they start in, so a hit inside a shadow tree would be
  // detected but never resolve a selector. composedPath() includes the
  // host elements from every outer tree, so when the deepest node lives
  // in a shadow root and a direct lookup fails, we retry findTarget on
  // each ancestor in the path. The cheap common case (no shadow DOM) only
  // ever does the single direct lookup.
  function findTargetForEvent(e) {
    const path = (typeof e.composedPath === 'function') ? e.composedPath() : null;
    const top = (path && path.length) ? path[0] : e.target;

    const direct = findTarget(top);
    if (direct || !path) return direct;

    if (top && top.getRootNode && top.getRootNode() instanceof ShadowRoot) {
      for (let i = 1; i < path.length; i++) {
        const node = path[i];
        if (!node || node === document || node === window) break;
        if (node.closest) {
          const t = findTarget(node);
          if (t) return t;
        }
      }
    }
    return null;
  }

  // ───────── Event handlers ─────────

  // Spacebar toggles the extension on/off (when the cursor isn't in a
  // text input). Captures the event so YouTube's space-to-pause doesn't
  // also fire on the same press.
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return;
    if (e.repeat) return;
    if (isTypingTarget(e.target)) return;

    e.preventDefault();
    e.stopPropagation();

    // Flip whichever toggle applies to the current site.
    if (IS_YOUTUBE) {
      const next = !enabled;
      enabled = next;
      if (!next) { cancelDwell(); hideStatus(); }
      else showStatus();
      safeChrome(() => chrome.storage.local.set({ enabled: next }));
      showToast(next ? 'Dwell clicking on' : 'Dwell clicking off');
    } else {
      const next = !universalEnabled;
      universalEnabled = next;
      if (!next) cancelDwell();
      safeChrome(() => chrome.storage.local.set({ universalEnabled: next }));
      showToast(next ? 'Dwell clicking on' : 'Dwell clicking off');
    }
    paintDwellToggle();
  }, true);

  // Mouseover: cursor entered a new element. Updates the status pill
  // and, if it's a EasePass target, starts (or resumes) a dwell.
  document.addEventListener('mouseover', (e) => {
    if (!isDwellEnabledHere()) return;
    const raw = deepTarget(e);
    const target = findTargetForEvent(e);
    if (target) {
      // Already dwelling on this exact target? Just keep going.
      if (active && active.el === target.el) return;
      // Switched to a different target? Cancel and start fresh — the
      // resume-on-return check inside startDwell handles same-element
      // re-entry; a different element always restarts from full time.
      if (active) cancelDwell();

      // Seed the pill with the starting countdown so it never flashes blank.
      const startMs = dwellTimeFor(target.type);
      setStatus('engaged', formatCountdown(target.type, startMs));

      startDwell(target);
      return;
    }
    // Not a target — but is the cursor at least on something interactive?
    if (findInteractive(raw)) {
      setStatus('something');
    } else {
      setStatus('idle');
    }
  }, true);

  // Mouseout: cursor left an element. Decide whether we're still inside
  // our active target (mouse moved between two children of it) or really
  // left.
  document.addEventListener('mouseout', (e) => {
    if (!active) return;
    const next = e.relatedTarget;
    // null = cursor left the document entirely
    if (!next) { cancelDwell(); setStatus('idle'); return; }
    // Still inside the target's subtree? Stay alive.
    if (active.el.contains(next)) return;
    // Genuine exit.
    cancelDwell();
    // Status will be repainted by the next mouseover, but set a sensible
    // default in case mouseover doesn't fire (e.g., cursor left the
    // document).
    if (findInteractive(next)) setStatus('something');
    else setStatus('idle');
  }, true);

  // If the user clicks anything themselves (or any other source clicks),
  // tear down our ring so we don't double-fire.
  document.addEventListener('click', () => {
    if (active) cancelDwell();
  }, true);

  // Page hidden → user switched tabs / locked. Don't run timers.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && active) cancelDwell();
  });

  // YouTube is a single-page app. When navigation completes the relevant
  // DOM is swapped in. Our mouseover delegation handles new elements
  // automatically, but reset any in-flight dwell since the old target
  // may have been removed from the DOM.
  document.addEventListener('yt-navigate-finish', () => {
    if (active) cancelDwell();
  }, true);

  // MutationObserver — clears any orphaned dwell if the active target
  // node is removed mid-countdown. Works on every site, not just YouTube.
  //
  // It only ever matters while a dwell is in flight, so we connect it in
  // startDwell and disconnect it in cancelDwell/completeDwell rather than
  // observing the whole page subtree at all times. On heavy sites
  // (infinite scroll, live feeds, SPAs) an always-on subtree observer
  // fires hundreds of times a second for nothing; this scopes the cost
  // to the few seconds a dwell is actually running.
  const domObserver = new MutationObserver(() => {
    if (active && active.el && !document.body.contains(active.el)) {
      cancelDwell();
    }
  });

  // ───────── Dwell lifecycle ─────────

  // Begin a dwell on the given target.
  function startDwell(target) {
    const dwellTime = dwellTimeFor(target.type);

    // Resume-from-pause check: is this the same element we just left,
    // and was that ≤ RESUME_WINDOW_MS ago?
    let elapsedAtStart = 0;
    if (
      lastSession &&
      lastSession.el === target.el &&
      Date.now() - lastSession.leftAt < RESUME_WINDOW_MS
    ) {
      elapsedAtStart = lastSession.elapsed;
    }
    lastSession = null;

    // Draw the visual ring for VIDEO (YouTube thumbnails) and UNIVERSAL
    // (every interactive element on non-YouTube sites) targets. YouTube
    // BUTTON targets keep their no-ring behavior — the countdown there
    // lives in the top status pill so the ring doesn't obscure the
    // tiny player controls.
    let ring = null;
    if (target.type === 'video' || target.type === 'universal') {
      ring = createRing();
      document.documentElement.appendChild(ring);
      const c = getElementCenter(target.el);
      positionRing(ring, c.x, c.y);
      // One paint later → fade in.
      requestAnimationFrame(() => ring.classList.add('easepass-visible'));
    }

    active = {
      el: target.el,                 // visual element (whole card)
      clickTarget: target.clickTarget, // element to actually click
      type: target.type,
      ring,                          // null for button-type targets
      // startTime is back-shifted by elapsedAtStart so the math below
      // produces the correct cumulative elapsed.
      startTime: Date.now() - elapsedAtStart,
      elapsed: elapsedAtStart,
      dwellTime,
      rafId: 0
    };

    // Watch for the target node being removed mid-countdown — only while
    // this dwell is live (see domObserver definition above).
    domObserver.observe(document.body, { childList: true, subtree: true });

    tickDwell();
  }

  // One frame of the dwell animation. Recursively re-queues itself.
  function tickDwell() {
    if (!active) return;

    // Re-anchor + repaint the ring only when there is one (video targets).
    if (active.ring) {
      const c = getElementCenter(active.el);
      positionRing(active.ring, c.x, c.y);
    }

    const now = Date.now();
    const elapsed = now - active.startTime;
    active.elapsed = elapsed;

    const msRemaining = active.dwellTime - elapsed;
    const ratio = Math.min(1, elapsed / active.dwellTime);
    if (active.ring) paintRing(active.ring, ratio, msRemaining);

    // Live countdown in the status pill (rounded to whole seconds).
    setStatus('engaged', formatCountdown(active.type, msRemaining));

    if (ratio >= 1) {
      completeDwell();
    } else {
      active.rafId = requestAnimationFrame(tickDwell);
    }
  }

  // Dwell finished naturally → flash green (video only), click.
  function completeDwell() {
    if (!active) return;
    const { ring, clickTarget, type } = active;

    // Green flash + completion burst (CSS-driven). Video targets only;
    // button targets have no ring to flash.
    if (ring) {
      const progress = ring.querySelector('.easepass-ring-progress');
      const count    = ring.querySelector('.easepass-ring-count');
      progress.classList.add('easepass-complete');
      count.classList.add('easepass-complete');
      count.textContent = '✓';
      ring.classList.add('easepass-completing');
    }

    // Pill: brief confirmation. The next mouseover (or page navigation)
    // will reset to idle/something automatically.
    setStatus('engaged', type === 'video' ? 'Opening!' : 'Clicked!');

    // Cancel any further frames; we're done.
    cancelAnimationFrame(active.rafId);
    domObserver.disconnect();
    active = null;
    lastSession = null;

    // Video needs the full ripple window; buttons get a much shorter
    // confirmation delay so the click feels snappy.
    const delay = ring ? COMPLETE_FLASH_MS : 120;
    setTimeout(() => {
      if (ring) ring.remove();
      try {
        // clickTarget is the actual <a> / button to fire on. For wrapper
        // matches it's the inner anchor; for direct matches it's the
        // visual element itself.
        triggerClick(clickTarget);
      } catch (_) {}
    }, delay);
  }

  // Cursor left target before completion → fade ring, remember progress.
  function cancelDwell() {
    if (!active) return;
    const { ring, el, elapsed } = active;
    cancelAnimationFrame(active.rafId);
    domObserver.disconnect();

    // Remember progress for resume-on-return.
    lastSession = { el, elapsed, leftAt: Date.now() };
    active = null;

    // Fade + remove only when a ring exists (video targets).
    if (ring) {
      ring.classList.remove('easepass-visible');
      setTimeout(() => { if (ring.parentNode) ring.remove(); }, FADE_OUT_MS);
    }
  }

  // ───────── Click helper ─────────

  // Fire the click in the most "real" way we can. Inputs get focus too.
  //
  // Some frameworks (React, web components) only react to a full pointer/
  // mouse sequence, not a bare element.click(). We dispatch the press
  // events first — these don't trigger navigation or default activation —
  // then let the native click() perform the authoritative activation. That
  // way custom handlers fire AND we never double-navigate.
  function triggerClick(el) {
    const tag = (el.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      el.focus();
      // Also click in case some UI relies on it.
      el.click();
      return;
    }
    const opts = { bubbles: true, cancelable: true, view: window };
    try {
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
    } catch (_) {}
    el.click();
  }

  // ───────── Ring rendering ─────────

  // Build the ring overlay. Detached from DOM until we append it.
  function createRing() {
    const center = RING_BOX / 2; // 28
    const wrap = document.createElement('div');
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

  // Place the ring at (x, y) viewport coordinates.
  function positionRing(ring, x, y) {
    ring.style.left = x + 'px';
    ring.style.top  = y + 'px';
  }

  // Paint the ring's fill ratio and the countdown number.
  function paintRing(ring, ratio, msRemaining) {
    const progress = ring.querySelector('.easepass-ring-progress');
    const count    = ring.querySelector('.easepass-ring-count');

    const offset = RING_CIRCUMFERENCE * (1 - ratio);
    progress.setAttribute('stroke-dashoffset', offset.toFixed(2));

    // Count down whole seconds remaining (rounded up).
    const secs = Math.max(0, Math.ceil(msRemaining / 1000));
    count.textContent = secs > 0 ? String(secs) : '';
  }

  // ───────── Helpers ─────────

  // Viewport-relative center of an element's bounding rect.
  function getElementCenter(el) {
    const r = el.getBoundingClientRect();
    return {
      x: r.left + r.width / 2,
      y: r.top + r.height / 2
    };
  }

  // True if the user is typing into an input / textarea / contenteditable.
  // Used to keep the Space toggle from hijacking text entry.
  function isTypingTarget(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  // Briefly show a centered toast confirming a state change.
  function showToast(text) {
    // Remove any existing toast first so successive presses replace cleanly.
    document.querySelectorAll('.easepass-toast').forEach(t => t.remove());
    const toast = document.createElement('div');
    toast.className = 'easepass-toast';
    toast.textContent = text;
    try { document.documentElement.appendChild(toast); } catch (_) { return; }
    requestAnimationFrame(() => toast.classList.add('easepass-toast-visible'));
    setTimeout(() => {
      toast.classList.remove('easepass-toast-visible');
      setTimeout(() => toast.remove(), 250);
    }, 1400);
  }

  // Return the deepest element an event passed through, including ones
  // hidden inside open shadow roots. composedPath() gives us the full
  // chain target → ancestors; the first entry is the actual hit node.
  // Falls back to event.target for environments without composedPath.
  function deepTarget(e) {
    if (typeof e.composedPath === 'function') {
      const p = e.composedPath();
      if (p && p.length > 0) return p[0];
    }
    return e.target;
  }

  // (THUMBNAIL_CONTAINERS + isThumbnailArea were moved above findTarget
  // to avoid a TDZ ReferenceError when an early mouseover races the
  // IIFE's later const initialization.)

  // Walk up to find any interactive element (link, button, input, role).
  // Returns the matching element or null. Used to decide between the
  // "something hovering" vs "not hovering" status states.
  function findInteractive(el) {
    if (!el || !el.closest) return null;
    return el.closest(
      'a, button, input, select, textarea, summary, label, ' +
      '[role="button"], [role="link"], [role="checkbox"], ' +
      '[role="menuitem"], [role="tab"], ' +
      '[tabindex]:not([tabindex="-1"])'
    );
  }

  // ───────── Status pill ─────────

  let statusEl = null;
  let statusState = null; // 'idle' | 'something' | 'engaged'

  // Phrases shown in each state. Centralized so they're easy to tweak.
  // The "engaged" state text is set dynamically (live countdown) so it's
  // intentionally absent here. NOTE: these are intentionally YouTube-
  // worded — the status pill is YouTube-only (setStatus() returns early
  // on every other host), so this text never renders off YouTube.
  const STATUS_LABELS = {
    idle:      'Hover any video to open it',
    something: 'Hover a video or button',
    engaged:   ''  // overridden each frame with the countdown
  };

  // Build the engaged-state countdown string. Used both on dwell start
  // (so the pill never flashes blank) and each animation frame.
  function formatCountdown(type, msRemaining) {
    const secs = Math.max(0, Math.ceil(msRemaining / 1000));
    if (type === 'video') {
      return secs > 0 ? 'Opens in ' + secs + 's' : 'Opening…';
    }
    return secs > 0 ? 'Click in ' + secs + 's' : 'Clicking…';
  }

  // Lazily create the pill, then make it visible if the extension's on.
  function ensureStatus() {
    if (statusEl && document.documentElement.contains(statusEl)) return;
    statusEl = document.createElement('div');
    statusEl.className = 'easepass-status easepass-status-idle';
    statusEl.innerHTML =
      '<span class="easepass-status-dot"></span>' +
      '<span class="easepass-status-text">' + STATUS_LABELS.idle + '</span>';
    document.documentElement.appendChild(statusEl);
    statusState = 'idle';
  }

  // Show the pill (creates it if needed). Idempotent.
  function showStatus() {
    ensureStatus();
    requestAnimationFrame(() => statusEl.classList.add('easepass-status-visible'));
  }

  // Hide the pill (kept in DOM so reshowing is instant).
  function hideStatus() {
    if (statusEl) statusEl.classList.remove('easepass-status-visible');
  }

  // Set state ('idle' | 'something' | 'engaged') with optional dynamic
  // text. For the 'engaged' state the caller passes a countdown string;
  // for 'idle' / 'something' we use the static label.
  function setStatus(next, customText) {
    if (!IS_YOUTUBE) return; // status pill is YouTube-only
    if (!enabled) return;
    ensureStatus();
    const stateChanged = statusState !== next;
    if (stateChanged) {
      statusState = next;
      statusEl.classList.remove(
        'easepass-status-idle',
        'easepass-status-something',
        'easepass-status-engaged'
      );
      statusEl.classList.add('easepass-status-' + next);
    }
    // Decide what to put in the pill.
    const text = (customText !== undefined && customText !== null)
      ? customText
      : STATUS_LABELS[next];
    // Avoid touching the DOM if nothing actually changed.
    const textEl = statusEl.querySelector('.easepass-status-text');
    if (textEl.textContent !== text) textEl.textContent = text;
  }

  // Hide the pill while a YouTube video is in fullscreen so it doesn't
  // overlap the video itself.
  document.addEventListener('fullscreenchange', () => {
    if (!IS_YOUTUBE) return; // status pill is YouTube-only
    if (document.fullscreenElement) {
      hideStatus();
    } else if (enabled) {
      showStatus();
    }
  });

  // ══════════════════════════════════════════
  // TEXT ACCESSIBILITY — runs on every site
  // Floating "Aa" button, slide-in panel, font/size/spacing/line-height
  // controls. Independent from the dwell-click system above. Settings
  // persist via chrome.storage.local under "easepass-text-settings"
  // and changes propagate to all open tabs via storage.onChanged.
  // ══════════════════════════════════════════

  const TEXT_SETTINGS_KEY = 'easepass-text-settings';
  const TEXT_STYLE_TAG_ID = 'easepass-text-styles';
  // id of the injected <link> to the bundled fonts.css (idempotency marker).
  const FONT_FACES_LINK_ID = 'easepass-font-faces';

  const TEXT_TAGS =
    'body, p, h1, h2, h3, h4, h5, h6, li, td, th, span, div, a, ' +
    'button, input, textarea, select, label';

  // Font catalog. `stack` is the CSS font-family to apply. `default`
  // means restore the page's original font (no override emitted).
  const FONT_OPTIONS = [
    { id: 'default',      name: 'Default',
      stack: '',
      preview: 'Original page font' },
    { id: 'opendyslexic', name: 'OpenDyslexic',
      stack: '"OpenDyslexic", "Comic Sans MS", sans-serif',
      preview: 'The quick brown fox' },
    { id: 'lexend',       name: 'Lexend',
      stack: '"Lexend", sans-serif',
      preview: 'The quick brown fox' },
    { id: 'arial',        name: 'Arial',
      stack: 'Arial, Helvetica, sans-serif',
      preview: 'The quick brown fox' },
    { id: 'comic',        name: 'Comic Sans MS',
      stack: '"Comic Sans MS", "Comic Sans", cursive',
      preview: 'The quick brown fox' },
    { id: 'atkinson',     name: 'Atkinson Hyperlegible',
      stack: '"Atkinson Hyperlegible", sans-serif',
      preview: 'The quick brown fox' }
  ];

  // Numeric maps for spacing pills.
  const LETTER_SPACING_MAP = { normal: null, wide: '0.05em', wider: '0.12em' };
  const WORD_SPACING_MAP   = { normal: null, wide: '0.1em',  wider: '0.2em' };
  const LINE_HEIGHT_MAP    = { normal: null, relaxed: '1.8', loose: '2.2' };

  const DEFAULT_TEXT_SETTINGS = {
    fontFamily:    'default',
    textSize:      100,        // percent
    letterSpacing: 'normal',
    wordSpacing:   'normal',
    lineHeight:    'normal'
  };

  let textSettings = { ...DEFAULT_TEXT_SETTINGS };

  // ─── Font loading ───
  // The webfonts (OpenDyslexic, Lexend, Atkinson Hyperlegible) are bundled
  // with the extension and declared in fonts.css. We inject that one local
  // stylesheet — no CDN requests, works fully offline. The relative
  // url(fonts/…) refs inside fonts.css resolve against its own
  // chrome-extension:// URL, so they point at the bundled files. Idempotent,
  // and only ever called when a non-default font is actually selected, so a
  // user on defaults never injects anything.
  function ensureFontFaces() {
    if (!document.head) return;
    if (document.getElementById(FONT_FACES_LINK_ID)) return;
    if (!isExtensionAlive()) return;
    const link = document.createElement('link');
    link.id   = FONT_FACES_LINK_ID;
    link.rel  = 'stylesheet';
    try {
      link.href = chrome.runtime.getURL('fonts.css');
      document.head.appendChild(link);
    } catch (_) {}
  }

  // ─── Generate the CSS to inject ───
  function generateTextCSS(s) {
    const lines = [];

    // Text-size scaling lives on <html> so rem-based pages scale
    // proportionally. Sites using fixed px still inherit the new base.
    if (s.textSize !== 100) {
      lines.push(`html { font-size: ${s.textSize}% !important; }`);
    }

    // Font family — !important is appropriate here because the whole
    // point is to override the page's font.
    const font = FONT_OPTIONS.find(f => f.id === s.fontFamily);
    if (font && font.stack) {
      lines.push(`${TEXT_TAGS} { font-family: ${font.stack} !important; }`);
    }

    // Spacing + line-height are NOT !important so sites that need
    // precise glyph positioning (math notation, code blocks, etc.)
    // can still override us via more specific rules.
    const letter = LETTER_SPACING_MAP[s.letterSpacing];
    if (letter) lines.push(`${TEXT_TAGS} { letter-spacing: ${letter}; }`);

    const word = WORD_SPACING_MAP[s.wordSpacing];
    if (word) lines.push(`${TEXT_TAGS} { word-spacing: ${word}; }`);

    const line = LINE_HEIGHT_MAP[s.lineHeight];
    if (line) lines.push(`${TEXT_TAGS} { line-height: ${line}; }`);

    return lines.join('\n');
  }

  // ─── Apply current settings to the page ───
  function applyTextSettings() {
    // Inject the bundled webfont stylesheet lazily — only when a custom
    // font is in effect.
    const font = FONT_OPTIONS.find(f => f.id === textSettings.fontFamily);
    if (font && font.stack) ensureFontFaces();

    const css = generateTextCSS(textSettings);
    const existing = document.getElementById(TEXT_STYLE_TAG_ID);
    if (!css) {
      // All defaults — restore page completely by removing the style tag.
      if (existing) existing.remove();
      return;
    }
    if (existing) {
      existing.textContent = css;
    } else {
      const tag = document.createElement('style');
      tag.id = TEXT_STYLE_TAG_ID;
      tag.textContent = css;
      try { document.head.appendChild(tag); } catch (_) {}
    }
  }

  // ─── Storage load/save ───
  function loadTextSettings() {
    safeChrome(() => {
      chrome.storage.local.get([TEXT_SETTINGS_KEY], (data) => {
        try {
          if (chrome.runtime && chrome.runtime.lastError) return;
          const stored = data[TEXT_SETTINGS_KEY];
          if (stored && typeof stored === 'object') {
            textSettings = { ...DEFAULT_TEXT_SETTINGS, ...stored };
          }
          applyTextSettings();
        } catch (_) {}
      });
    });
  }

  // ─── Cross-tab sync ───
  // The popup writes to chrome.storage.local; this listener picks up
  // those writes (and writes from other tabs) and applies them.
  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      try {
        if (!isExtensionAlive()) return;
        if (area !== 'local') return;
        if (!changes[TEXT_SETTINGS_KEY]) return;
        const next = changes[TEXT_SETTINGS_KEY].newValue;
        textSettings = next
          ? { ...DEFAULT_TEXT_SETTINGS, ...next }
          : { ...DEFAULT_TEXT_SETTINGS };
        applyTextSettings();
      } catch (_) {}
    });
  }

  // ─── Boot the text feature ───
  // Load current settings and apply them. Webfont CDNs are injected
  // lazily by applyTextSettings() only when a custom font is selected,
  // so users on defaults never trigger any font network requests. No
  // on-page UI — all controls live in the toolbar popup.
  function bootText() {
    if (!document.head || !document.body) {
      // Defer if DOM isn't ready (rare with run_at: document_idle).
      setTimeout(bootText, 50);
      return;
    }
    loadTextSettings();
  }
  bootText();

  // Lightweight on-page entrypoint for text accessibility controls.
  // Opens the extension popup page in a new tab, scrolled to the text
  // accessibility section.
  let aaButtonEl = null;
  function createAaButton() {
    if (aaButtonEl && document.documentElement.contains(aaButtonEl)) return;
    aaButtonEl = document.createElement('button');
    aaButtonEl.id = 'easepass-aa-btn';
    aaButtonEl.type = 'button';
    aaButtonEl.setAttribute('aria-label', 'Open EasePass text accessibility controls');
    aaButtonEl.textContent = 'Aa';
    aaButtonEl.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      safeChrome(() => {
        const url = chrome.runtime.getURL('popup.html#text-accessibility');
        chrome.runtime.sendMessage({ type: 'OPEN_EXTENSION_PAGE', url }, () => {
          if (chrome.runtime && chrome.runtime.lastError) {
            try { window.open(url, '_blank', 'noopener'); } catch (_) {}
          }
        });
      });
    });
    try { document.documentElement.appendChild(aaButtonEl); } catch (_) {}
  }

  function bootAaButton() {
    if (!document.body) { setTimeout(bootAaButton, 50); return; }
    createAaButton();
  }
  bootAaButton();

  // ══════════════════════════════════════════
  // FLOATING DWELL TOGGLE — appears on every site
  // Bottom-right circular button. Shows ✓ when dwell-click is active in
  // this page's context, ✕ when off. Click (or dwell on YouTube) flips
  // the appropriate storage flag.
  // ══════════════════════════════════════════

  let dwellToggleEl = null;

  function createDwellToggle() {
    if (dwellToggleEl && document.documentElement.contains(dwellToggleEl)) return;
    dwellToggleEl = document.createElement('button');
    dwellToggleEl.id = 'easepass-dwell-toggle';
    dwellToggleEl.type = 'button';
    dwellToggleEl.setAttribute('aria-label', 'Toggle EasePass dwell clicking');
    dwellToggleEl.innerHTML =
      '<span class="easepass-toggle-glyph" aria-hidden="true"></span>';
    dwellToggleEl.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      flipDwell();
    });
    try { document.documentElement.appendChild(dwellToggleEl); } catch (_) {}
    paintDwellToggle();
  }

  // Apply the on/off visual based on the toggle that governs THIS site.
  function paintDwellToggle() {
    if (!dwellToggleEl) return;
    const on = isDwellEnabledHere();
    dwellToggleEl.classList.toggle('easepass-toggle-on',  on);
    dwellToggleEl.classList.toggle('easepass-toggle-off', !on);
    dwellToggleEl.setAttribute('aria-pressed', on ? 'true' : 'false');
    const glyph = dwellToggleEl.querySelector('.easepass-toggle-glyph');
    if (glyph) glyph.textContent = on ? '✓' : '✕'; // ✓ / ✕
  }

  // Flip the dwell-enabled flag relevant to the current page (YouTube
  // vs universal). Mirrors the spacebar handler logic but with a
  // mouse-friendly entry point.
  function flipDwell() {
    if (IS_YOUTUBE) {
      const next = !enabled;
      enabled = next;
      if (!next) { cancelDwell(); hideStatus(); } else { showStatus(); }
      safeChrome(() => chrome.storage.local.set({ enabled: next }));
      showToast(next ? 'Dwell clicking on' : 'Dwell clicking off');
    } else {
      const next = !universalEnabled;
      universalEnabled = next;
      if (!next) cancelDwell();
      safeChrome(() => chrome.storage.local.set({ universalEnabled: next }));
      showToast(next ? 'Dwell clicking on' : 'Dwell clicking off');
    }
    paintDwellToggle();
  }

  function bootToggle() {
    if (!document.body) { setTimeout(bootToggle, 50); return; }
    createDwellToggle();
  }
  bootToggle();
})();
