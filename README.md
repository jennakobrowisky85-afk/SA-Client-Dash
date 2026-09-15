# Client Ops Dashboard — Sharp Ahead

Media spend pacing, KPI tracking, and retainer hours in one screen. Built with Next.js + Tailwind + Recharts, reading live from a Google Sheet.

## How data flows

```
Google Sheet  →  lib/googleSheets.js (service account auth)  →  app/page.js (server component)  →  ClientOpsDashboard (client component, props only)
```

- **The Google Sheet is the source of truth.** Edit a cell, refresh the dashboard (or wait up to 5 minutes — see `revalidate` in `app/page.js`), see the change. No code edits, no redeploys, ever.
- **`components/ClientOpsDashboard.jsx` has zero hardcoded data.** Everything arrives as props from the sheet.
- **Hours logged are still placeholder values** in the `HoursLogged` tab — that's standing in for the Teamwork API until it's connected. Same mechanism applies: once Teamwork is wired up, either keep writing into that same tab, or swap `lib/googleSheets.js`'s hours-fetching for a direct Teamwork API call.

## One-time setup

### 1. The Google Sheet
Create a Google Sheet with three tabs, named exactly:
- **Centres** — columns: `Client, Lead, MonthlyBudget, Spend, OverUnder, YearlyBudget, RemainingYearly, CPL, FormFills, TargetCPL, TargetFormFills, CPL_Mar, CPL_Apr, CPL_May, CPL_Jun, CPL_Jul, CPL_Aug, FF_Mar, FF_Apr, FF_May, FF_Jun, FF_Jul, FF_Aug`
- **Retainers** — columns: `Client, Lead, Type, Allocation, BAUAllocation, TacticalAllocation, Contact`
- **HoursLogged** — columns: `Client, BAUUsed, TacticalUsed`

(Pre-filled CSVs for all three, with real current data, were provided alongside this project — import each into its matching tab.)

### 2. Google Cloud service account
1. Create a project at [console.cloud.google.com](https://console.cloud.google.com).
2. Enable the **Google Sheets API** (APIs & Services → Library).
3. Create a **Service Account** (APIs & Services → Credentials → Create Credentials).
4. Generate a **JSON key** for it (Keys tab → Add Key → JSON).
5. Share the Google Sheet with the service account's `client_email` (found in the JSON), set to **Viewer**.

### 3. Environment variables
Copy `.env.local.example` to `.env.local` and fill in the three values from the JSON key file and the sheet URL. In Vercel, add the same three under **Project Settings → Environment Variables** instead.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. If env vars are missing, `lib/googleSheets.js` throws a clear error naming which one.

## Deploy to Vercel

1. **Push this project to a GitHub repo:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit — client ops dashboard"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
2. Go to [vercel.com/new](https://vercel.com/new), sign in with GitHub, and **Import** this repo. Vercel auto-detects Next.js.
3. Before clicking Deploy, add the three environment variables from `.env.local.example` under the import screen's Environment Variables section (or add them after, under Project Settings, then redeploy).
4. **Deploy.** You'll get a live `.vercel.app` URL within a minute.
5. Every future `git push` to `main` auto-deploys. Sheet edits show up without any deploy at all — just a page refresh (or up to 5 minutes, per the revalidate window).

## Adding a new client

1. Add a row to **Centres** (if they have media spend to track) and/or **Retainers** (for hours pacing).
2. If they're hours-only with no media spend (like CLEAN or Sports Surfaces UK), only add them to **Retainers** — the dashboard automatically treats any client in Retainers but not in Centres as a non-media client.
3. Add a row to **HoursLogged** so their pacing bar has something to show.

## Next steps

- **Teamwork API for real hours**, replacing the `HoursLogged` tab (or feeding into it) once API access is available.
- Consider a **12-month rolling window** for KPI targets instead of the current 5-month one, once more sheet history accumulates.
