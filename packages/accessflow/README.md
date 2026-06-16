# @axolassist/accessflow

Production-ready accessibility toolbar SDK by [Axolo Assist](https://axolassist.com). Add visitor-controlled font, contrast, spacing, and motion controls to any site with one import.

## Quick start

```bash
npm install @axolassist/accessflow
```

```ts
import '@axolassist/accessflow';
```

The toolbar appears automatically. No CSS imports. No configuration required.

## React

```tsx
import { AccessFlow } from '@axolassist/accessflow/react';

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

import { AccessFlow } from '@axolassist/accessflow/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AccessFlow />
      {children}
    </>
  );
}
```

## CDN (no bundler)

```html
<script src="https://cdn.axolassist.com/accessflow.js"></script>
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

## Manual control

```ts
import { init, destroy } from '@axolassist/accessflow';

init({ position: 'top-right' });
// later
destroy();
```

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `position` | `bottom-right` | Toolbar button placement |
| `accentColor` | `#B03060` | Active control color |
| `storageKey` | `accessflow-settings-v1` | localStorage key |
| `skipAutoInit` | `false` | CDN only — disable auto boot |
| `features` | all enabled | Toggle toolbar sections |

```ts
import { init } from '@axolassist/accessflow';

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

Build outputs ESM + CJS to `dist/` and syncs the CDN IIFE to `/cdn/accessflow.js`.

## Publishing

See [PUBLISHING.md](./PUBLISHING.md). Quick path:

```bash
./scripts/setup-accessflow-publish.sh
```

Or tag `accessflow-v1.0.0` after adding `NPM_TOKEN` to GitHub Actions secrets.

## Privacy

AccessFlow does not collect visitor data. Settings stay in the visitor's browser.

## License

MIT © Axolo Assist
