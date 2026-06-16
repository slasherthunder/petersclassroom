import stylesheet from '../assets/accessflow.css';
import defaultIcon from '../assets/accessibility-icon.png';
import fontRegular from '../assets/fonts/opendyslexic-7.woff';
import fontBold from '../assets/fonts/opendyslexic-8.woff';
import {
  DEFAULT_ACCENT,
  DEFAULT_POSITION,
  DEFAULTS,
  FEATURE_MAP,
  STORAGE_KEY,
  VERSION,
} from './constants';
import { error, warn } from './logger';
import { getToolbarMarkup } from './markup';
import type { AccessFlowConfig, AccessFlowPosition, Settings } from './types';

export { VERSION };
export type { AccessFlowConfig, AccessFlowAPI } from './types';

let initialized = false;
let abortController: AbortController | null = null;
let guideEl: HTMLElement | null = null;
let settings: Settings = { ...DEFAULTS };
let storageKey = STORAGE_KEY;
let mergedConfig: AccessFlowConfig = {};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function hexToRgb(hex: string): string {
  let value = hex.replace('#', '');
  if (value.length === 3) {
    value = value
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return `${parseInt(value.substring(0, 2), 16)}, ${parseInt(value.substring(2, 4), 16)}, ${parseInt(value.substring(4, 6), 16)}`;
}

function injectStyles(): void {
  if (document.getElementById('accessflow-styles')) return;
  const style = document.createElement('style');
  style.id = 'accessflow-styles';
  style.setAttribute('data-accessflow-css', 'true');
  style.textContent = typeof stylesheet === 'string' ? stylesheet : '';
  document.head.appendChild(style);
}

function injectStylesheetLink(href: string): void {
  if (document.getElementById('accessflow-styles-link')) return;
  const link = document.createElement('link');
  link.id = 'accessflow-styles-link';
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function injectFonts(): void {
  if (document.getElementById('accessflow-dyslexia-fonts')) return;
  const style = document.createElement('style');
  style.id = 'accessflow-dyslexia-fonts';
  style.textContent =
    `@font-face{font-family:'OpenDyslexic';font-style:normal;font-weight:400;font-display:swap;src:url('${fontRegular}') format('woff');}` +
    `@font-face{font-family:'OpenDyslexic';font-style:normal;font-weight:700;font-display:swap;src:url('${fontBold}') format('woff');}`;
  document.head.appendChild(style);
}

function applyAccent(color: string): void {
  const rgb = hexToRgb(color);
  document.getElementById('accessflow-accent-vars')?.remove();
  const style = document.createElement('style');
  style.id = 'accessflow-accent-vars';
  style.textContent =
    `.axolo-toolbar-root{--aat-accent:${color};--aat-accent-deep:${color};--aat-accent-rgb:${rgb};--aat-accent-tint:rgba(${rgb},0.12);--aat-accent-tint2:rgba(${rgb},0.28);}`;
  document.head.appendChild(style);
}

function injectToolbar(position: AccessFlowPosition): void {
  if (document.getElementById('axoloAssistToolbarRoot') || !document.body) return;
  const container = document.createElement('div');
  container.innerHTML = getToolbarMarkup(position);
  const root = container.firstElementChild;
  if (root) document.body.appendChild(root);
}

function applyFeatureVisibility(toolbarRoot: HTMLElement, features?: AccessFlowConfig['features']): void {
  if (!features) return;
  Object.entries(FEATURE_MAP).forEach(([key, featureId]) => {
    if (features[key as keyof NonNullable<AccessFlowConfig['features']>] === false) {
      toolbarRoot.querySelectorAll(`[data-feature="${featureId}"]`).forEach((el) => {
        el.classList.add('aaf-hidden');
      });
    }
  });
}

function loadSettings(): void {
  try {
    settings = {
      ...DEFAULTS,
      ...JSON.parse(localStorage.getItem(storageKey) || '{}'),
    } as Settings;
  } catch {
    settings = { ...DEFAULTS };
    warn('Could not read saved settings. Using defaults.');
  }
}

function saveSettings(): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(settings));
  } catch (err) {
    warn('Could not save settings to localStorage.');
    error('Storage error', err);
  }
}

function clearDocumentAttributes(): void {
  const root = document.documentElement;
  Object.keys(DEFAULTS).forEach((key) => root.removeAttribute(`data-${key}`));
  root.classList.remove('a11y-locked');
}

function moveGuide(event: MouseEvent): void {
  if (guideEl) guideEl.style.top = `${event.clientY - 22}px`;
}

function setupReadingGuide(): void {
  if (settings['reading-guide'] === 'on') {
    if (!guideEl) {
      guideEl = document.createElement('div');
      guideEl.className = 'a11y-reading-guide';
      guideEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(guideEl);
      document.addEventListener('mousemove', moveGuide);
    }
    return;
  }
  if (guideEl) {
    document.removeEventListener('mousemove', moveGuide);
    guideEl.remove();
    guideEl = null;
  }
}

function bindRuntime(
  toggleBtn: HTMLButtonElement,
  panel: HTMLElement,
  overlay: HTMLElement,
  closeBtn: HTMLButtonElement,
  resetBtn: HTMLButtonElement,
  toolbarRoot: HTMLElement
): void {
  const root = document.documentElement;
  const signal = abortController!.signal;

  const apply = (): void => {
    Object.entries(DEFAULTS).forEach(([key, defaultValue]) => {
      const val = settings[key as keyof Settings];
      if (val === defaultValue || val === undefined) {
        root.removeAttribute(`data-${key}`);
      } else {
        root.setAttribute(`data-${key}`, val);
      }
    });
    setupReadingGuide();
  };

  const syncUI = (): void => {
    document.querySelectorAll<HTMLButtonElement>('.a11y-btn[data-setting]').forEach((btn) => {
      const active = settings[btn.dataset.setting as keyof Settings] === btn.dataset.value;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    document.querySelectorAll<HTMLButtonElement>('.a11y-switch[data-toggle]').forEach((sw) => {
      sw.setAttribute('aria-checked', settings[sw.dataset.toggle as keyof Settings] === 'on' ? 'true' : 'false');
    });
  };

  const checkBadge = (): void => {
    const count = Object.keys(DEFAULTS).filter((key) => settings[key as keyof Settings] !== DEFAULTS[key as keyof Settings]).length;
    toggleBtn.classList.toggle('aat-has-settings', count > 0);
  };

  const afterChange = (): void => {
    saveSettings();
    apply();
    syncUI();
    checkBadge();
  };

  document.querySelectorAll<HTMLButtonElement>('.a11y-btn[data-setting]').forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        settings[btn.dataset.setting as keyof Settings] = btn.dataset.value ?? 'default';
        afterChange();
      },
      { signal }
    );
  });

  document.querySelectorAll<HTMLButtonElement>('.a11y-switch[data-toggle]').forEach((sw) => {
    sw.addEventListener(
      'click',
      () => {
        const key = sw.dataset.toggle as keyof Settings;
        settings[key] = settings[key] === 'on' ? 'off' : 'on';
        afterChange();
      },
      { signal }
    );
  });

  resetBtn.addEventListener(
    'click',
    () => {
      settings = { ...DEFAULTS };
      afterChange();
      const original = resetBtn.textContent;
      resetBtn.textContent = '✓ All reset';
      resetBtn.disabled = true;
      window.setTimeout(() => {
        resetBtn.textContent = original;
        resetBtn.disabled = false;
      }, 1500);
    },
    { signal }
  );

  const openPanel = (): void => {
    panel.classList.add('open');
    overlay.classList.add('open');
    root.classList.add('a11y-locked');
    toggleBtn.setAttribute('aria-expanded', 'true');
    overlay.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => panel.focus(), 50);
  };

  const closePanel = (): void => {
    panel.classList.remove('open');
    overlay.classList.remove('open');
    root.classList.remove('a11y-locked');
    toggleBtn.setAttribute('aria-expanded', 'false');
    overlay.setAttribute('aria-hidden', 'true');
    toggleBtn.focus();
  };

  toggleBtn.addEventListener(
    'click',
    () => {
      if (panel.classList.contains('open')) closePanel();
      else openPanel();
    },
    { signal }
  );

  closeBtn.addEventListener('click', closePanel, { signal });
  overlay.addEventListener('click', closePanel, { signal });

  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && panel.classList.contains('open')) closePanel();
      if (event.key !== 'Tab' || !panel.classList.contains('open')) return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled'));

      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    { signal }
  );

  apply();
  syncUI();
  checkBadge();
  window.setTimeout(() => toggleBtn.classList.add('aat-loaded'), 600);
}

export function init(config: AccessFlowConfig = {}): void {
  if (!isBrowser()) return;

  if (initialized) {
    warn('AccessFlow is already initialized. Call destroy() before re-initializing.');
    return;
  }

  mergedConfig = {
    ...(window.AccessFlowConfig || {}),
    ...config,
  };

  const position = (mergedConfig.position || DEFAULT_POSITION) as AccessFlowPosition;
  const accentColor = mergedConfig.accentColor || DEFAULT_ACCENT;
  storageKey = mergedConfig.storageKey || STORAGE_KEY;

  if (mergedConfig.cssUrl) {
    injectStylesheetLink(mergedConfig.cssUrl);
  } else if (!mergedConfig.skipCssInject) {
    injectStyles();
  }
  injectFonts();
  injectToolbar(position);

  const toggleBtn = document.getElementById('a11yToggle') as HTMLButtonElement | null;
  const panel = document.getElementById('a11yPanel');
  const overlay = document.getElementById('a11yOverlay');
  const closeBtn = document.getElementById('a11yClose') as HTMLButtonElement | null;
  const resetBtn = document.getElementById('a11yReset') as HTMLButtonElement | null;
  const toolbarRoot = document.getElementById('axoloAssistToolbarRoot');

  if (!toggleBtn || !panel || !overlay || !closeBtn || !resetBtn || !toolbarRoot) {
    error('Toolbar markup could not be mounted. AccessFlow did not initialize.');
    return;
  }

  initialized = true;
  window.__ACCESSFLOW_ACTIVE__ = true;
  abortController = new AbortController();

  const icon = toggleBtn.querySelector('img');
  if (icon) icon.src = mergedConfig.iconUrl || defaultIcon;

  if (mergedConfig.showBranding === false) {
    toolbarRoot.querySelector('.aat-powered-by')?.classList.add('aaf-hidden');
  }

  toolbarRoot.setAttribute('data-position', position);
  applyAccent(accentColor);
  applyFeatureVisibility(toolbarRoot, mergedConfig.features);
  loadSettings();
  bindRuntime(toggleBtn, panel, overlay, closeBtn, resetBtn, toolbarRoot);
}

export function destroy(): void {
  if (!isBrowser() || !initialized) return;

  abortController?.abort();
  abortController = null;

  document.getElementById('axoloAssistToolbarRoot')?.remove();
  document.getElementById('accessflow-accent-vars')?.remove();
  setupReadingGuide();
  clearDocumentAttributes();

  initialized = false;
  window.__ACCESSFLOW_ACTIVE__ = false;
  settings = { ...DEFAULTS };
}

export function boot(config?: AccessFlowConfig): void {
  if (!isBrowser()) return;
  const run = (): void => init(config);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
}

export const accessFlowAPI = {
  init,
  destroy,
  version: VERSION,
};
