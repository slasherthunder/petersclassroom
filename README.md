# Axol Assist

Axol Assist is a static website plus a Chrome extension (`easepass-extension`) focused on accessibility and assistive interaction.

**Site:** [https://axolassist.com](https://axolassist.com)

## Website

- `index.html` is the main landing page.
- `easepass.html` is the Accessibility Surfer product page.
- `styles.css` and `script.js` are shared by both pages.
- `site-config.js` holds the public site origin and Chrome Web Store install URL.

## Local Development

Run a static server from the project root:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

## Chrome Extension (Accessibility Surfer)

The extension source is in `easepass-extension/`.

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `easepass-extension` folder

Toolbar icons are under `easepass-extension/icons/` and include PNG assets required by Chrome.

### Chrome Web Store install link

Before publishing, install buttons point to a placeholder URL. When the listing is live, replace `PLACEHOLDER_EXTENSION_ID` in:

- `site-config.js` (`chromeWebStoreUrl`)
- `easepass-extension/site-urls.js` (`CHROME_WEB_STORE_URL`)

The site also hydrates any `[data-chrome-install]` link from `site-config.js` on load.

## Contact

- Email: `axolassist.business@gmail.com`

## Privacy Policy

Privacy policy page is available at `privacy.html` (and linked from both site footers and the extension popup).
