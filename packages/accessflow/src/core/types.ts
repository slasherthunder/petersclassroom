export type AccessFlowPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface AccessFlowFeatures {
  textSize?: boolean;
  lineSpacing?: boolean;
  letterSpacing?: boolean;
  wordSpacing?: boolean;
  font?: boolean;
  textAlign?: boolean;
  contrast?: boolean;
  colorFilter?: boolean;
  readableWidth?: boolean;
  linkHighlight?: boolean;
  underlineLinks?: boolean;
  enhancedFocus?: boolean;
  highlightHeadings?: boolean;
  readingGuide?: boolean;
  keyboardNav?: boolean;
  reduceMotion?: boolean;
  pauseAnimations?: boolean;
  bigCursor?: boolean;
}

export interface AccessFlowConfig {
  position?: AccessFlowPosition;
  accentColor?: string;
  baseUrl?: string;
  cssUrl?: string;
  iconUrl?: string;
  fontBaseUrl?: string;
  storageKey?: string;
  skipCssInject?: boolean;
  skipAutoInit?: boolean;
  showBranding?: boolean;
  features?: AccessFlowFeatures;
}

export interface AccessFlowAPI {
  init: (config?: AccessFlowConfig) => void;
  destroy: () => void;
  version: string;
}

declare global {
  interface Window {
    AccessFlowConfig?: AccessFlowConfig;
    AccessFlow?: AccessFlowAPI;
    __ACCESSFLOW_ACTIVE__?: boolean;
  }
}

export type SettingKey =
  | 'text-size'
  | 'line-spacing'
  | 'letter-spacing'
  | 'word-spacing'
  | 'font'
  | 'text-align'
  | 'readable-width'
  | 'contrast'
  | 'saturation'
  | 'underline-links'
  | 'enhanced-focus'
  | 'highlight-headings'
  | 'reading-guide'
  | 'link-highlight'
  | 'keyboard-nav'
  | 'reduce-motion'
  | 'pause-animations'
  | 'big-cursor';

export type Settings = Record<SettingKey, string>;
