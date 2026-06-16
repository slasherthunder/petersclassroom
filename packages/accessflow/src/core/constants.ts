import type { Settings } from './types';

export const VERSION = '1.0.2';
export const STORAGE_KEY = 'accessflow-settings-v1';
export const DEFAULT_ACCENT = '#B03060';
export const DEFAULT_POSITION = 'bottom-right';
export const DEFAULT_CDN = 'https://axolassist.com/cdn/';

export const DEFAULTS: Settings = {
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
  'big-cursor': 'off',
};

export const FEATURE_MAP: Record<string, string> = {
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
  bigCursor: 'big_cursor',
};
