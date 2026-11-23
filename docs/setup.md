# Lead Radar

Watches Freelancer.com for new projects, scores each one against your fit profile with Claude, and writes the good ones to a Google Sheet or Notion database. Everything scanned — kept or rejected — stays in Supabase behind a dashboard, so you can see what the filters are throwing away.

```
Freelancer API  →  prefilter  →  dedupe  →  Claude scoring  →  Supabase
                                                                  ↓
                                                    Sheet / Notion (score ≥ 65 only)
```

The prefilter is the important bit. Hard rules — budget floor, bid count ceiling, payment-verified employers, keyword blocklist — run before anything reaches Claude, so a run typically scores 5–15 projects, not 100. That keeps the API cost around a few cents a day.

## Setup

### 1. Freelancer API access

Sign in at [developers.freelancer.com](https://developers.freelancer.com), register an app, and generate an OAuth token with the `basic` and `advanced` scopes. Freelancer also runs a sandbox at `freelancer-sandbox.com` with separate credentials — worth using while you tune filters.

### 2. Supabase

Create a project, open the SQL editor, paste in `supabase/schema.sql`, run it. Copy the project URL and the **service role** key.

### 3. Google Sheet

1. In Google Cloud Console: create a project → enable the Google Sheets API → create a service account → create a JSON key.
2. Create your sheet, add a tab called `Leads`.
3. Share the sheet with the service account's email address as an **Editor**. This is the step everyone misses.
4. Copy the sheet ID out of the URL (`.../spreadsheets/d/THIS_PART/edit`).

For Notion instead, set `LEAD_DESTINATION=notion` and create a database with the properties listed at the top of `lib/destinations/notion.ts`, then share it with your integration.

### 4. Environment

```bash
cp .env.example .env
npm install
```

Fill in `.env`, then find the skill IDs you care about:

```bash
npm run jobs -- crm
npm run jobs -- "google ads"
```

Paste the IDs into `searchConfig.jobIds` in `lib/config.ts`.

### 5. First run

```bash
npm run scan
```

You'll get a breakdown of how many projects were fetched, how many survived each stage, and how many landed in your sheet. If `scored` is 0, your prefilter is too tight. If `kept` is 0 but `scored` is high, your fit profile and the threshold disagree — read the verdicts in the dashboard.

```bash
npm run dev
```

### 6. Deploy

Push to GitHub, import into Vercel, add the same env vars. `vercel.json` schedules a scan every 15 minutes.

**One catch:** Vercel's Hobby plan only allows one cron execution per day. On Hobby, delete `vercel.json` and point a free external scheduler ([cron-job.org](https://cron-job.org), GitHub Actions) at:

```
POST https://your-app.vercel.app/api/cron/poll
Authorization: Bearer <CRON_SECRET>
```

## Tuning it

Everything you'll want to change lives in `lib/config.ts`.

| What | Where | Notes |
|---|---|---|
| Keywords and skill IDs | `searchConfig` | Broad here is fine — the prefilter narrows |
| Budget floor, bid ceiling, blocklist | `prefilter` | Tighten this before tightening the score threshold; it's free |
| Score cutoff for pushing | `SCORE_THRESHOLD` | Start at 65, watch a week, adjust |
| **Your fit profile** | `fitProfile` | The single biggest lever on quality |

The fit profile is a plain-English description of what you're good at and what you don't want. Be specific and be honest about the negatives — "no equity-only, no content mills, no vague briefs" does more for score quality than any amount of keyword tuning. Revisit it after the first fifty leads, when you can see what the model got wrong.

## Cost

Roughly, at a 15-minute cadence:

- Freelancer API: free, rate-limited per token
- Supabase: free tier is plenty
- Claude scoring: ~10 projects/run × 96 runs/day at ~1.5k tokens each — pennies per day on Sonnet
- Vercel: free tier if you use an external scheduler

## Notes

- Dedupe is on `project_id` with a unique constraint, so overlapping lookback windows are safe.
- A malformed scoring response parks the lead at 50 with an `unscored` flag rather than failing the run.
- Every run is logged to `sync_runs` including errors — check that table first when leads stop arriving.
- The service-role key is server-side only. Don't move Supabase calls into client components.
