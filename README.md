# Studio de Nuance

A photo editor that runs in your browser: filters, adjustments, masks (including AI subject, background and face masks, and the B&W Window), text, overlays, story templates and an offline AI editor.

**Use it:** https://kimpelota.github.io/photo-editor/

## Mac app

[Download for Mac](https://github.com/kimpelota/photo-editor/releases/latest/download/Studio-de-Nuance-mac.zip). It runs on Apple-silicon and Intel Macs with macOS 12 or later.

1. Open the downloaded zip to unzip it.
2. Drag **Studio de Nuance** into your **Applications** folder and open it.
3. The app isn't from the App Store, so the first time macOS may say it can't check it. Open **System Settings → Privacy & Security**, scroll down and click **Open Anyway**.

To build it yourself: `./mac/build.sh` (needs Apple's command line tools). The app is written to `dist/`.

## Install it from the browser

- **iPhone / iPad:** open the link in Safari, tap Share, then **Add to Home Screen**.
- **Android:** open the link in Chrome, then menu (⋮) → **Install app**.
- **Computer:** in Chrome or Edge, click the install icon in the address bar. In Safari on a Mac, **File → Add to Dock**.

Or use **Get the app** in the editor's top bar. Once installed it opens full screen and works offline.

## Download and run it yourself

[Download the code (.zip)](https://github.com/kimpelota/photo-editor/archive/refs/heads/main.zip), unzip it, and serve the folder with any local web server, for example:

```
cd photo-editor-main
python3 -m http.server 8000
```

Then open http://localhost:8000. There's no build step; it's plain HTML, CSS and JavaScript.
