# Axolo Assist

Axolo Assist is a static website plus a Chrome extension (`easepass-extension`) focused on accessibility and assistive interaction.

## Website

- `index.html` is the main landing page.
- `easepass.html` is the EasePass product page.
- `styles.css` and `script.js` are shared by both pages.

## Local Development

Run a static server from the project root:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

## Chrome Extension (EasePass)

The extension source is in `easepass-extension/`.

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `easepass-extension` folder

Toolbar icons are under `easepass-extension/icons/` and include PNG assets required by Chrome.

## Contact

- Email: `axolassist.business@gmail.com`

## Privacy Policy

Privacy policy page is available at `privacy.html` (and linked from both site footers and the extension popup).