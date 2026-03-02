# PeliVeli 🎮

Your unified game library. Scans Steam, Epic Games, GOG, Ubisoft Connect, and EA App — with cover art and OpenCritic scores.

---

## Prerequisites

- **Node.js 18+** — download from [nodejs.org](https://nodejs.org)
- **Windows 10 or 11**

---

## Development (running from source)

```bash
npm install
npm run dev
```

The app opens automatically. On first launch you'll see the setup screen for optional IGDB credentials.

---

## Building a distributable installer

```bash
npm install
npm run build
```

This produces a proper Windows installer (`PeliVeli Setup 1.0.0.exe`) in the `release/` folder. It includes:
- Installation wizard with directory chooser
- Start Menu shortcut
- Desktop shortcut
- Uninstaller (accessible from Windows Add/Remove Programs)

Run the `.exe` to install PeliVeli like any normal Windows application.

---

## IGDB Setup (optional — for Epic, Ubisoft, EA cover art)

1. Go to [dev.twitch.tv/console](https://dev.twitch.tv/console)
2. Register an application (any name, redirect URL: `http://localhost`, category: Application Integration)
3. Copy the **Client ID** and generate a **Client Secret**
4. Enter both in PeliVeli's first-run setup screen (or Settings → Account later)

Steam and GOG cover art works without any API key.

---

## Troubleshooting

**Cover art not showing after scan:**
Open Settings (⚙ in the sidebar) → Library → click **Re-fetch Cover Art & Scores**. This clears cached failures and retries everything.

**Games not found for a launcher:**
The launcher must be installed and have been run at least once so it has written its manifest/registry entries.

**PowerShell execution policy error on `npm install`:**
Run this in PowerShell as Administrator:
```
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
