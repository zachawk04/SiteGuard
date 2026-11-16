# 🛡️ Sentinel — Web Security & Content Filtering Extension

A privacy-focused Chrome extension (Manifest V3) that provides real-time website safety analysis, ad/tracker blocking, fingerprint protection, and parental controls — all running locally on your device.

Built as a Senior Capstone Project at the University of Toledo.

## Features

### AI Threat Scanner
An optional scanner that runs on Chrome's built-in AI model (Gemini Nano), entirely on the user's device. Users turn on Local AI once from the side panel, which downloads the model. After that, **Check this page for threats** reads the visible page and looks for brand impersonation, fake virus warnings, fake CAPTCHAs that ask you to run commands, fake updates, account-suspension pressure, unusual payment demands, fake stores, crypto scams, and prize scams. Each finding quotes the text it's based on, and the verdict is computed by Sentinel's own code rather than scored by the model. Well-known sites (a curated list in `src/scan/trustedSites.ts`, plus every official domain in the brand table) are reported as trusted without an AI check; pages on hosts where anyone can publish, such as Google Sites or SharePoint, are never auto-trusted.

### Network Filtering
Blocks malicious domains, ad networks, and tracking scripts using Chrome's `declarativeNetRequest` API. Includes three tiers:
- **Standard** — 200+ known ad networks, trackers, and popup domains
- **Aggressive** — 500+ domains (may break some sites)
- **EasyList** — 30,000+ domains compiled from EasyList and EasyPrivacy filter lists

### Cosmetic Filtering
Injects CSS to hide ad containers, popup overlays, cookie banners, newsletter modals, and scam elements before they paint. Also includes scriptlet neutralizations for anti-adblock detection and push notification spam.

### Canvas Obfuscation
Hooks `HTMLCanvasElement` methods to inject subtle noise into canvas fingerprinting attempts, making your browser harder to uniquely identify across sites.

### Location Spoofing
Feeds fake coordinates to the Geolocation API, preventing sites from accessing your real location.

### Ad Defense
Blocks cross-origin popups by overriding `window.open`, and strips invisible click-trap overlays (transparent full-screen links, iframes, and divs) that hijack user clicks.

### Parental Controls
PIN-protected admin dashboard with tiered content filtering:
- **Child / Teen / Adult** age tiers with automatic domain blocking
- Custom domain block and allow lists
- SHA-256 hashed PIN for secure access

### Admin Dashboard
Accessible via a 4-digit PIN, the dashboard provides:
- **Dashboard** — Stats overview (total events, blocked domains, status)
- **Domains** — Add/remove blocked and whitelisted domains
- **Logs** — View blocked request history with timestamps and URLs
- **Settings** — Feature toggles, parental controls, and data export

## Tech Stack

- **Chrome Manifest V3**
- **React** + **TypeScript** for the popup UI
- **Tailwind CSS** for styling
- **Vite** for building
- **Chrome APIs** — `declarativeNetRequest`, `storage`, `scripting`, `tabs`
- **Chrome Prompt API** — On-device AI (Gemini Nano) for page analysis, used from the side panel

## Getting Started

### Prerequisites
- Node.js 20.19+ or 22.12+ (required by Vite 7)
- Chrome 138+

### Install & Build

```bash
git clone https://github.com/joshuamlpereira/sentinel-extension.git
cd sentinel-extension
npm install
npm run build
```

### Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `dist/` folder

### Try the AI Threat Scanner

No Chrome flags are needed: extensions can use Chrome's built-in AI directly.

1. Click the Sentinel icon, then **Set up Local AI** (or **Open threat scanner**).
2. In the side panel, select **Enable Local AI** if the model isn't installed yet. The device needs about 22 GB of free disk space and enough GPU or system memory; the panel explains why if it can't run.
3. Start the fake scam pages: `npm run test-pages`, then open http://localhost:5180.
4. Open one of the pages and select **Check this page for threats**.

## Project Structure

```
sentinel-extension/
├── src/
│   ├── App.tsx          # Popup UI (React)
│   ├── ai/              # Local AI setup: availability, download, popup card
│   ├── scan/            # Threat scan: page extractor, prompts, brand table, verdict
│   ├── sidepanel/       # Side panel UI: setup screens and scan results
│   ├── content.ts       # Content script (MAIN world) — ad defense, canvas and location hooks
│   ├── cosmetic.ts      # Content script (ISOLATED world) — CSS cosmetic filters
│   └── background.ts    # Service worker — network filtering, rule management
├── scripts/
│   ├── build-rules.js       # Downloads EasyList/EasyPrivacy and compiles DNR rules
│   └── serve-test-pages.js  # Serves test-pages/ at localhost:5180
├── test-pages/          # Fake scam and safe pages for testing the scanner
├── public/
│   ├── rules_standard.json    # 200+ ad/tracker domain rules
│   ├── rules_aggressive.json  # 500+ domain rules
│   └── rules_easylist.json    # 30,000 domains from EasyList/EasyPrivacy
└── dist/                # Built extension (load this in Chrome)
```

## Team

- **Joshua Pereira**
- **John Best**
- **Aaron Samuel**
- **Bryant Greer**
- **Nonso Nwogu**

Faculty Advisor: **Professor Weiqing Sun**

## License

This project was developed as part of ENGT 4050 — Senior Technology Capstone at the University of Toledo.
