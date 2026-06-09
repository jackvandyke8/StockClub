# The Bull Pen — Stock Club App

## Project Overview
A stock club web app for tracking picks, hosting live bull/bear debates, and sharing member blog posts. Built with vanilla HTML/CSS/JS, hosted on Vercel, with Supabase as the backend.

## Tech Stack
- **Frontend:** Vanilla HTML, CSS (CSS variables, dark theme), JavaScript (ES6+)
- **Backend/DB:** Supabase (Postgres + Realtime + Storage)
- **Hosting:** Vercel (auto-deploys from GitHub)
- **Fonts:** Syne (display/headings) + DM Mono (body)

## Supabase Project
- **URL:** `https://aegbhutfgyyzukferxnz.supabase.co`
- **Publishable key:** `sb_publishable_GdYba_EgD7uYAn5oFlSVcg_hP2lw2N4`
- **Tables:**
  - `posts` — bull/bear debate posts (stock, name, side, thesis, created_at)
  - `blogs` — member blog posts (title, author, content HTML, created_at)
- **Storage bucket:** `blog-images` (public) — stores inline images for blog posts

## GitHub
- **Repo:** `https://github.com/jackvandyke8/StockClub.git`
- **Main branch:** `main` (Vercel production deploys from here)
- **Active branch:** `Feat-LiveDataFeed`

## File Structure
```
index.html       — Homepage (hero, stats, picks grid, join form)
picks.html       — Bull vs Bear debate page (live feed + post form)
blogs.html       — Member blog page (editor + blog feed)
performance.html — DOES NOT EXIST YET — needs to be built
styles.css       — All styles (single file, CSS variables for theming)
main.js          — Shared JS: ticker bar, picks grid (still hardcoded), email signup
debate.js        — Debate feed: Supabase queries, real-time subscription, form submit
blog.js          — Blog editor: contenteditable, Supabase Storage image upload, feed
```

## Design System
```css
--bg: #0a0b0d        /* page background */
--bg2: #111318       /* slightly lighter */
--bg3: #181c24       /* inputs, toolbars */
--card: #13161e      /* card backgrounds */
--border: rgba(255,255,255,0.07)
--accent: #00e5a0    /* green — bull/positive */
--red: #ff4d4d       /* red — bear/negative */
--gold: #f0b429
--text: #f0f0f0
--muted: #6b7280
--subtle: #9ca3af
```
Fonts: `'Syne'` for display/headings, `'DM Mono'` for body text.
Key classes: `.display`, `.btn-primary`, `.btn-ghost`, `.section`, `.page-hero`, `.page-hero-row`, `.section-tag`

## Current Dummy Data (to be replaced with live data)
In `main.js`:
- **Ticker bar** — hardcoded array of `[symbol, price, change, isUp]`
- **Picks grid** — hardcoded array with sym, name, price, change%, bar width

## Next Feature: Live Data Feed (Feat-LiveDataFeed branch)
**Goal:** Replace hardcoded dummy data with real portfolio data from StockRover CSV + live prices from Alpha Vantage.

### Plan
1. **CSV upload UI** on the Performance page — user uploads StockRover export, tickers + holdings parsed and saved to a new Supabase `portfolio` table
2. **Vercel serverless function** (`/api/quotes.js`) — proxies Alpha Vantage API (keeps key out of browser), caches results in Supabase `quotes_cache` table (15-min TTL)
3. **Update `main.js`** — ticker bar and picks grid pull from Supabase instead of hardcoded arrays
4. **Performance page** (`performance.html`) — built from scratch, shows portfolio table with live prices, total value, gain/loss vs cost basis

### Alpha Vantage
- **Free tier:** 25 calls/day, 5/min
- **Key endpoint:** `BATCH_STOCK_QUOTES` — fetches multiple tickers in ONE call (critical for staying under limits)
- **API key:** user needs to get one at alphavantage.co/support/#api-key (free)
- **Vercel env var:** store as `ALPHA_VANTAGE_KEY` in Vercel dashboard → Settings → Environment Variables

### Supabase Tables to Create
```sql
-- Portfolio holdings (uploaded from StockRover CSV)
CREATE TABLE portfolio (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  company TEXT,
  shares NUMERIC,
  cost_basis NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quote cache (populated by Vercel serverless function)
CREATE TABLE quotes_cache (
  symbol TEXT PRIMARY KEY,
  price NUMERIC,
  change NUMERIC,
  change_pct TEXT,
  volume BIGINT,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);
```

### StockRover CSV Format
StockRover exports typically include columns: Symbol, Company, Quantity/Shares, Market Value, Cost, Gain/Loss, Gain/Loss %. The CSV parser should be flexible (map by column header name, not position).

## Important Notes
- All pages share the same nav pattern — when adding a new page, update the nav in ALL html files
- Supabase client is initialized as `_supabase` (not `supabase`) to avoid shadowing `window.supabase`
- The `defer` attribute is used on all local scripts; CDN Supabase script has no defer (loads sync)
- RLS is enabled on all tables — remember to add SELECT + INSERT policies for `anon` role
- The `blog-images` storage bucket requires SELECT + INSERT policies for `anon` role
