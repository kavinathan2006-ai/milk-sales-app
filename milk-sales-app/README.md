# KATHIRAVAN— Milk Sales Record App

A lightweight milk shop management app. No backend, no database server — everything
(customers, sales, payments) is saved directly in the browser's storage on your phone,
using `localStorage`. It works fully offline and can be installed on an Android home
screen like a real app (Progressive Web App).

## Files

```
milk-sales-app/
├── index.html      the app shell
├── style.css        all styling
├── app.js           all app logic + local storage
├── manifest.json     PWA install config
├── sw.js             offline service worker
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## Features

- **Customers** — add/edit/delete, search by name or phone, auto-generated Customer ID (C001, C002…)
- **Daily Sales** — pick customer, date, litres, rate → total auto-calculated; edit/delete any past entry; filter by Today / Last 7 days / This month
- **Payments** — record payments per customer, balance updates automatically, full payment history
- **Monthly Report** — pick month/year, see litres/amount/paid/balance per customer, with optional manual discount, extra charge, or total override
- **Dashboard** — total customers, today's sales, this month's sales, total pending amount
- **Backup & Restore** — download all data as a `.json` file any time; restore it on this phone or a new one (via the gear icon top-right)
- **Installable PWA** — add to home screen, opens full-screen like a native app, works with no internet connection

## How to run it on your phone

Because phones won't run a "double-click index.html" file as an installable app, you need to
serve the files over `http(s)://` at least once. Pick whichever is easiest for you:

### Option A — Easiest: host it free on GitHub Pages
1. Create a free GitHub account and a new repository (e.g. `milk-sales-app`).
2. Upload all the files in this folder (keep the `icons/` folder structure).
3. In the repo, go to **Settings → Pages**, set source to the `main` branch, save.
4. GitHub gives you a link like `https://kavinathan2006-ai.github.io/milk-sales-app/`.
5. Open that link on your Android phone in **Chrome**.
6. Tap the **⋮** menu → **Add to Home screen** (or you'll see an automatic "Install app" prompt).
7. The app icon now appears on your home screen and opens full-screen, offline.

### Option B — Quick local test on the same Wi-Fi (no upload needed)
1. On your computer, open a terminal inside the `milk-sales-app` folder.
2. Run: `python3 -m http.server 8000` (Python is usually pre-installed on Mac/Linux; on Windows use `py -m http.server 8000`).
3. Find your computer's local IP address (e.g. `192.168.1.5`).
4. On your phone (same Wi-Fi), open Chrome and go to `http://192.168.1.5:8000`.
5. Tap **⋮ → Add to Home screen**.

> Note: this only works while your computer's server is running and both devices share the
> same network — good for testing, but Option A (GitHub Pages) is better for daily real use
> since it's always online and free.

### Option C — Any static host
Any free static hosting service (Netlify, Vercel, Cloudflare Pages, Firebase Hosting) works
the same way — just upload the folder and open the resulting link on your phone.

## Important notes on data storage

- All data lives in your phone's browser storage, tied to that specific browser app and site.
- Clearing your browser's site data/cache, or uninstalling the browser, will erase your records.
- **Back up regularly**: tap the gear icon (top-right) → **Download backup (.json)** and save
  that file somewhere safe (Google Drive, email to yourself, etc.). You can restore it any
  time, including on a different phone.
- Data does **not** sync between devices automatically — each install has its own local data
  unless you manually back up and restore.

## Currency

Amounts are shown in ₹ (Indian Rupees) per the example in the brief. To change the currency
symbol, edit the `money()` function near the top of `app.js`.
