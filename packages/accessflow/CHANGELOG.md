# Changelog

All notable changes to `@axol-assist/accessflow` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-06-16

### Fixed

- Toggle icon is bundled as a data URL (no external `accessibility.png` download)
- Panel footer shows “Powered by Axolo Assist” with link to axolassist.com

### Added

- `showBranding` config option (default `true`) to hide the footer when needed

## [1.0.1] - 2026-06-16

### Fixed

- CSS now inlines correctly in ESM/CJS builds (toolbar styling works with Vite, Astro, etc.)
- `cssUrl` config loads an external stylesheet via `<link>`
- Removed auto-init from the main entry — use `@axol-assist/accessflow/auto` for zero-config, or `boot()` / `init()` for manual control
- Default CDN base URL now points to live assets at `https://axolassist.com/cdn/`
- Package ships `dist/accessflow.css` and documents `@axol-assist/accessflow/styles.css` export

## [1.0.0] - 2026-06-16

### Added

- TypeScript SDK with ESM and CommonJS builds
- Zero-config auto-initialization via `import '@axol-assist/accessflow'`
- React component at `@axol-assist/accessflow/react`
- Bundled CSS, fonts, and accessibility icon (no manual asset setup)
- CDN IIFE bundle for script tag installation
- SSR-safe browser-only initialization
- `init()` and `destroy()` APIs for manual control
