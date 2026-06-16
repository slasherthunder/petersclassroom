# @axol-assist/accessflow

Production-ready accessibility toolbar SDK by [Axolo Assist](https://axolassist.com). Add visitor-controlled font, contrast, spacing, and motion controls to any site with one import.

## Quick start

```bash
npm install @axol-assist/accessflow
```

**Zero-config** (auto-initializes on load):

```ts
import '@axol-assist/accessflow/auto';
```

Styles, fonts, and the toggle icon are bundled in the JS — no separate asset requests.

**Manual control** (no auto-init):

```ts
import { boot } from '@axol-assist/accessflow';

boot({ position: 'bottom-left' });
```

```ts
import { init, destroy } from '@axol-assist/accessflow';

init({ position: 'top-right' });
// later
destroy();
```

> Do not combine `import '@axol-assist/accessflow/auto'` with `init()` or `<AccessFlow />` — pick one initialization path.

## React

```tsx
import { AccessFlow } from '@axol-assist/accessflow/react';

export default function App() {
  return (
    <>
      <AccessFlow />
      {/* your app */}
    </>
  );
}
```

The component mounts once, prevents duplicates, and cleans up on unmount.

### Next.js (App Router)

```tsx
// app/providers.tsx
'use client';

import { AccessFlow } from '@axol-assist/accessflow/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AccessFlow />
      {children}
    </>
  );
}
```

### Astro

```astro
---
// src/layouts/Layout.astro
---
<script>
  import '@axol-assist/accessflow/auto';
</script>
```

## CDN (no bundler)

```html
<script src="https://axolassist.com/cdn/accessflow.js"></script>
```

Optional configuration before the script:

```html
<script>
  window.AccessFlowConfig = {
    position: 'bottom-left',
    accentColor: '#B03060',
  };
</script>
```

Styles, fonts, and the toggle icon are inlined in the CDN bundle.

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `position` | `bottom-right` | Toolbar button placement |
| `accentColor` | `#B03060` | Active control color |
| `iconUrl` | bundled icon | Toggle button image (override with your own URL) |
| `cssUrl` | — | Load stylesheet via `<link>` instead of bundled CSS |
| `skipCssInject` | `false` | Skip bundled CSS inject (use with `cssUrl`) |
| `showBranding` | `true` | Show “Powered by Axolo Assist” in the panel footer |
| `skipAutoInit` | `false` | CDN/auto entry only — disable auto boot |
| `storageKey` | `accessflow-settings-v1` | localStorage key |
| `features` | all enabled | Toggle toolbar sections |

### External stylesheet (optional)

Bundled CSS is the default. To host the stylesheet yourself:

```ts
import { boot } from '@axol-assist/accessflow';

boot({
  skipCssInject: true,
  cssUrl: '/accessflow.css',
});
```

Or copy from the package:

```ts
// Vite / Astro — serve from public/
import cssUrl from '@axol-assist/accessflow/styles.css?url';

boot({ skipCssInject: true, cssUrl });
```

```ts
import { init } from '@axol-assist/accessflow';

init({
  position: 'bottom-left',
  features: {
    bigCursor: false,
  },
});
```

## Features

- Text scaling (80%–200%)
- OpenDyslexic font
- Contrast modes (dark, high)
- Color filters (grayscale, sepia, invert)
- Letter, word, and line spacing
- Reading guide bar
- Link highlight and underline
- Enhanced focus indicators
- Reduce motion / pause animations
- Large cursor
- Persistent settings per visitor (localStorage)

## Framework support

Works with React, Next.js, Vite, Astro, Vue, Svelte, and static HTML. SSR-safe — initialization only runs in the browser.

## Development

```bash
cd packages/accessflow
npm install
npm run build
```

Build outputs ESM + CJS to `dist/`, ships `dist/accessflow.css`, and syncs the CDN IIFE to `/cdn/accessflow.js`.

## Publishing

See [PUBLISHING.md](./PUBLISHING.md). Tag `accessflow` after adding `NPM_TOKEN` to GitHub Actions secrets.

## Privacy

AccessFlow does not collect visitor data. Settings stay in the visitor's browser.

## License

MIT © Axolo Assist
