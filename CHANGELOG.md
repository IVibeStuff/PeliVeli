# PeliVeli 1.2.0 — Release Notes

**Released:** March 2026

---

## Overview

Version 1.2.0 is a stability and infrastructure release. The primary focus is replacing two broken third-party data sources — OpenCritic and AllKeyShop — with better alternatives, while also fixing a number of UI theming inconsistencies that surfaced during testing on the NASA-PUNK light theme.

---

## Breaking Changes

### OpenCritic removed

OpenCritic's API began returning HTTP 400 on all search requests following their acquisition by Valnet Inc. in mid-2024. The search endpoint now requires an API key that is not publicly available. As a result, **all OpenCritic integration has been removed** from PeliVeli.

This affects:
- Automatic score fetching during library enrichment
- Manual "Link to OpenCritic" input in the Detail Panel
- Score badges on game cards (pill and review badge styles)
- Sort by Score button in the top bar
- Score Badge Style setting in Settings → Library

Existing `ocScore`, `ocTier`, and `ocUrl` fields in `games.json` are preserved for backward compatibility but are no longer displayed or updated.

### AllKeyShop replaced with IsThereAnyDeal

The `allkeyshop-api` npm package (last published June 2025) stopped returning data for all searches, including simple titles like "Euro Truck Simulator 2". AllKeyShop changed their internal site structure and the unmaintained package has no fix available.

**AllKeyShop has been replaced with [IsThereAnyDeal](https://isthereanydeal.com)**, which provides a proper maintained REST API covering Steam, GOG, Epic, Fanatical, Humble Store, Green Man Gaming, and other legitimate stores.

This affects the Wishlist feature in the following ways:
- A free IsThereAnyDeal API key is now required for price lookups (see Setup below)
- The currency setting has been replaced with a **country** setting — ITAD returns prices in the correct local currency for your country automatically
- The "Show key sellers" toggle has been removed — ITAD does not index grey market key resellers (G2A, Kinguin, etc.), only legitimate stores
- The "Official Stores / Key Sellers" split in the price panel has been replaced with a single flat list sorted by price, with discount percentage shown where applicable
- Wishlist entries that were added while AllKeyShop was in use will still display cover art, but price lookups may fail if their stored ID format is incompatible. Removing and re-adding the game will resolve this.

---

## New Features

### SteamGridDB manual link in Detail Panel

The OpenCritic section in the Detail Panel has been replaced with a **Cover Art** section. When a game has no cover art (automatch failed during enrichment), a URL input appears allowing you to paste a SteamGridDB game URL (e.g. `https://www.steamgriddb.com/game/5473454`) and fetch the correct art directly by game ID. This also works as a re-link option when art exists but is wrong.

If SGDB returns a canonical game name that differs from the stored title, it is saved as `displayTitle` to improve future lookups.

### IsThereAnyDeal API key setup

A new in-app modal for entering the IsThereAnyDeal API key is accessible from **Settings → Account → Update IsThereAnyDeal Key**. The modal is consistent with the existing SteamGridDB key setup flow.

---

## Bug Fixes

### ProgressOverlay hardcoded dark theme
The scan and enrichment progress bar overlay was hardcoded to dark navy colours (`#171922` background, `#333a50` message text), making it invisible on light themes. It now reads `appBackground`, `drawerBackground`, and `fontFamily` from the active theme.

### Wishlist Add modal dark on light themes
The Add to Wishlist modal background was always set to `drawerBackground` regardless of theme. On NASA-PUNK (a light theme with a dark drawer), this caused the modal to render with a dark background and invisible text. The modal now uses `appBackground` on light themes and `drawerBackground` on dark themes, consistent with the Detail Panel.

### Wishlist result list invisible text
Game name text in the Add modal search results was missing an explicit colour, causing it to inherit a colour that blended into the background on some themes. Fixed with explicit `color: pri`.

### `log is not defined` crash in wishlist handler
The `wishlist:add` IPC handler in `main.js` called `log()`, which only exists in `enricher.js`. The call has been replaced with `console.error`.

### Stale `enricher.fetchOcByTitle` call in wishlist
The wishlist add handler continued to call `enricher.fetchOcByTitle` after OpenCritic was removed, causing a runtime crash when adding games to the wishlist. The call has been removed.

### GameGrid broken after OC badge removal
A previous cleanup pass left behind empty JSX expressions (`{scoreBadgeStyle === 'pill' && }` and `{isReview && }`) and a reference to the removed `titlePadTop` variable, causing a Vite build error. All three have been removed and the card title padding hardcoded to 7px.

### WishlistView `symbol` undefined crash
The `symbol` variable (currency symbol prefix) was referenced in the wishlist card Prices button label but had been removed from the component scope during the AllKeyShop-to-ITAD migration, causing a React render crash that blacked out the entire app when navigating to the Wishlist. Fixed with a static label.

### SettingsDrawer `onReconfigureItad` prop missing
The `onReconfigureItad` callback was passed from `App.jsx` but not declared in `SettingsDrawer`'s props destructuring, causing it to be `undefined`. Clicking the button crashed the Account tab render. Fixed by adding it to the function signature.

### `window.prompt` blocked in Electron
The initial ITAD key entry used `window.prompt()`, which Electron's renderer process blocks silently, returning `null` immediately and causing Settings to close with no feedback. Replaced with a proper in-app modal overlay.

---

## Internal Changes

- `allkeyshop-api` npm dependency removed from `package.json`
- `wishlist.js` rewritten from scratch — no npm dependencies, direct HTTPS calls to the ITAD REST API
- Enrichment loop stripped of all OpenCritic logic — now cover-art-only, runs significantly faster
- `enricher.js` exports cleaned up — `fetchOcById` and `fetchOcByTitle` stubs retained for compatibility but return `null`
- OC-related headers (`sec-ch-ua`, `sec-fetch-*`) and gzip decompression added to `fetchJsonRaw` during diagnosis; retained as they improve general HTTP compatibility
- `scoreBadgeStyle` setting removed from defaults and Settings UI; `delete exportable.scoreBadgeStyle` retained in theme export to clean up any stored values

---

## Migration Notes

**If upgrading from 1.1.x:**

1. Run `npm install` after extracting — this will remove the now-unused `allkeyshop-api` package
2. Add your IsThereAnyDeal API key via **Settings → Account → Update IsThereAnyDeal Key**
3. Set your country in **Settings → Wishlist** (defaults to Estonia / EUR)
4. Re-add any wishlist entries if price lookups fail — older entries may have incompatible stored IDs

No changes are required for the library or cover art functionality.
