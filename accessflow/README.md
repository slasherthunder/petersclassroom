# AccessFlow — Universal Embed Kit

Free accessibility toolbar by **Axolo Assist**. Drop this folder on any website — static HTML, Wix, Squarespace, WordPress, or custom apps.

## What's included

| File | Purpose |
|------|---------|
| `accessflow.css` | Toolbar styles |
| `accessflow.js` | Toolbar logic (settings save in the visitor's browser) |
| `accessibility.png` | Floating button icon |
| `fonts/` | OpenDyslexic font files for dyslexia-friendly mode |
| `embed.html` | Copy-paste snippet for your site |
| `demo.html` | Local test page |

## Quick install (3 steps)

### 1. Upload the folder

Upload the entire `accessflow/` folder to your site, for example:

```
https://yoursite.com/accessflow/
```

Keep all files together — paths are relative.

### 2. Paste the embed code

Open `embed.html`, copy everything, and paste it **just before** `</body>` on every page (or in your theme footer / site-wide custom code).

Update the paths if your folder lives somewhere other than `/accessflow/`:

```html
<link rel="stylesheet" href="/accessflow/accessflow.css">
<script src="/accessflow/accessflow.js" defer></script>
```

### 3. Test

Load your site. You should see the accessibility button in the bottom-right corner. Click it to open the panel.

Open `demo.html` in a browser (via a local static server) to test before uploading.

## Optional configuration

Add this **before** the toolbar HTML to customize:

```html
<script>
window.AccessFlowConfig = {
  position: 'bottom-left',   // bottom-right | bottom-left | top-right | top-left
  accentColor: '#B03060',      // active button / switch color
  baseUrl: '/accessflow/'      // only if auto-detect fails
};
</script>
```


## Privacy

AccessFlow does not collect visitor data or run third-party tracking. Each visitor's choices are stored in their own browser (`localStorage`).

## Support

Built by [Axolo Assist](https://axoloassist.com).
