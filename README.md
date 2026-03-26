# PeliVeli 🎮

**Version 1.2.0**

Your unified game library. Scans Steam, Epic Games, GOG, Ubisoft Connect, and EA App — with cover art fetched automatically and wishlist price tracking via IsThereAnyDeal.

---

## Prerequisites

- **Node.js 18+** — download from [nodejs.org](https://nodejs.org)
- **Windows 10 or 11** (the registry scanner is Windows-only)
- A free **SteamGridDB API key** for cover art — get one at [steamgriddb.com](https://www.steamgriddb.com/profile/preferences/api)
- A free **IsThereAnyDeal API key** for wishlist pricing — get one at [isthereanydeal.com/apps/my/](https://isthereanydeal.com/apps/my/)

The SteamGridDB key is required for cover art on Epic, Ubisoft, EA, and GOG games. Steam games will get cover art automatically without any key. Both keys are free with no meaningful rate limits for personal use.

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

On first launch you will see the setup screen asking for your **SteamGridDB API key**.

To get your key:
1. Create a free account at [steamgriddb.com](https://www.steamgriddb.com)
2. Go to **Preferences → API**
3. Copy the key and paste it into PeliVeli's setup screen

You can skip this step if you only have Steam games — cover art for Steam will still work. You can add or update the key at any time from **Settings → Account**.

### 4. Add your IsThereAnyDeal key (for Wishlist pricing)

1. Register a free app at [isthereanydeal.com/apps/my/](https://isthereanydeal.com/apps/my/)
2. Copy the generated API key
3. In PeliVeli, open **Settings → Account → Update IsThereAnyDeal Key**
4. Paste the key and click Save

Without this key the Wishlist tab will still work for organising games, but price lookups will show an error message.

### 5. Scan your library

Click **⟳ SCAN LIBRARY** in the top bar. PeliVeli will detect your installed launchers, find all games, and download cover art for each one. Everything is cached locally — subsequent launches are instant.

If cover art is missing for a specific game after scanning, open the game's Detail Panel and paste a URL from [steamgriddb.com](https://www.steamgriddb.com) (e.g. `steamgriddb.com/game/12345`) into the Cover Art input to fetch it manually.

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
- `%APPDATA%\PeliVeli\wishlist.json` — your wishlist
- `%APPDATA%\PeliVeli\config.json` — your API keys
- `%APPDATA%\PeliVeli\settings.json` — your theme and UI preferences
- `%APPDATA%\PeliVeli\covers\` — cached cover art images

No data is sent anywhere except outbound requests to:

- **Steam CDN** — cover art for Steam games
- **SteamGridDB API** — cover art for Epic, Ubisoft, EA, and GOG games
- **IsThereAnyDeal API** — wishlist price lookups and game search

---

## Troubleshooting

**Games not found for a launcher:**
Make sure the launcher is installed and you have run it at least once so it writes its manifest files. Ubisoft Connect in particular requires at least one game to be installed to create registry entries.

**Cover art missing after scan:**
Check your SteamGridDB API key in **Settings → Account**. If the key is valid but a specific game still has no art, paste the game's SteamGridDB URL into the Cover Art field in its Detail Panel.

**Wishlist prices not loading:**
Make sure you have added your IsThereAnyDeal API key in **Settings → Account**. If the key is set but prices still fail, check the country setting in **Settings → Wishlist** — it should match your region for correct currency display. Wishlist entries added before version 1.2.0 may need to be removed and re-added.

**App won't start:**
Make sure you are on Node 18+ (`node --version`) and have run `npm install`.
