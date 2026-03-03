# PeliVeli 🎮

Your unified game library. Scans Steam, Epic Games, GOG, Ubisoft Connect, and EA App — with cover art and OpenCritic scores.

---

## Prerequisites

- **Node.js 18+** — download from [nodejs.org](https://nodejs.org)
- **Windows 10 or 11** (the registry scanner is Windows-only)
- A **Twitch Developer account** for IGDB cover art (free) — get one at [dev.twitch.tv](https://dev.twitch.tv)

---

## Setup & Running

### 1. Install dependencies

Open a terminal in the `peliveli` folder and run:

```bash
npm install
```

### 2. Start in development mode

```bash
npm run dev
```

This starts the Vite dev server and Electron simultaneously. The app window will open automatically.

### 3. First-run setup

On first launch you'll see the **setup screen** asking for your IGDB credentials.

## SteamGridDB Setup (optional — for Epic, Ubisoft, EA cover art)

1. Go to [https://www.steamgriddb.com](https://www.steamgriddb.com)
2. Log in with your Steam account
3. Copy the API under Preferences
4. Enter it in PeliVeli's first-run setup screen (or Settings → Account later)

Steam and GOG cover art works without any API key.

If you only have Steam and GOG games, you can tick **Skip IGDB** — cover art will still work for those two platforms without any key.

### 4. Scan your library

Click **⟳ SCAN LIBRARY** in the top bar. PeliVeli will:
1. Detect installed launchers and find all games
2. Download cover art for each game
3. Fetch OpenCritic scores
4. Cache everything locally — subsequent launches are instant

---

## Building a distributable

```bash
npm run build
```

This produces a Windows installer in the `release/` folder.

---

## Data & privacy

All data stays on your machine. PeliVeli stores:
- `%APPDATA%\PeliVeli\games.json` — your scanned game list
- `%APPDATA%\PeliVeli\config.json` — your IGDB credentials
- `%APPDATA%\PeliVeli\covers\` — cached cover art images

No data is sent anywhere except outbound requests to:
- Steam CDN (cover art)
- GOG API (cover art)
- IGDB / Twitch API (cover art for Epic, Ubisoft, EA)
- OpenCritic API (scores)

---

## Troubleshooting

**Games not found for a launcher:**
Make sure the launcher is installed and you've run it at least once so it writes its manifest files. Ubisoft Connect in particular requires at least one game to be installed to create registry entries.

**Cover art missing for Epic/Ubisoft/EA games:**
Check your IGDB credentials in Settings (bottom of the sidebar). You can update them and re-scan.

**App won't start:**
Make sure you're on Node 18+ (`node --version`) and have run `npm install`.
