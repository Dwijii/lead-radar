# Architecture

## Pipeline stages (`lib/pipeline.ts`)

| # | Stage | Cost | What happens |
|---|---|---|---|
| 1 | Fetch | Free (rate-limited) | Active projects from the Freelancer API for the configured skill IDs and keywords |
| 2 | Normalise | — | Budgets converted to a USD midpoint for comparable filtering |
| 3 | Prefilter | Free | Budget floor, bid-count ceiling, payment-verified employer, keyword blocklist |
| 4 | Dedupe | 1 query | Drop project IDs already in `leads` (unique constraint as a safety net) |
| 5 | Score | ~1.5k tokens per project | Claude scores against `fitProfile`, with concurrency-limited batches |
| 6 | Store | 1 upsert | Every scanned lead saved with its score, verdict and reasons |
| 7 | Push | API call | Leads with score ≥ `SCORE_THRESHOLD` (default 65) appended to Sheets and/or Notion |
| 8 | Log | 1 insert | Run counts and errors written to `sync_runs` |

## Scoring contract (`lib/score.ts`)

The model gets the fit profile and the project, and must return one JSON object:

```json
{
  "score": 0,
  "verdict": "one sentence, max 15 words",
  "reasons": ["2–4 concrete fit signals"],
  "red_flags": ["…"],
  "angle": "best proposal opening line, or empty if score < 50"
}
```

The prompt tells the model to be harsh ("most posts … should score below 50"), so scores spread out and the threshold means something. If parsing fails, the lead gets a neutral 50 and an `unscored` flag.

## Data model (`supabase/schema.sql`)

- **`leads`**: one row per Freelancer project (`project_id` unique). Holds project facts, employer signals, scoring output (`score`, `verdict`, `reasons`, `red_flags`, `angle`) and workflow status (`new → shortlisted → bid → won | dismissed`).
- **`sync_runs`**: one row per scan, with stage counts and errors, for observability.

## Scheduling

`vercel.json` sets a 15-minute cron on `/api/cron/poll`, protected by a `CRON_SECRET` bearer token. Vercel's Hobby plan only allows daily crons, so on Hobby use an external scheduler (cron-job.org or GitHub Actions) to call the same endpoint.

## Security

- The Supabase service-role key and the Anthropic key are server-side only.
- The cron endpoint requires a bearer secret.
- The Google service account needs Editor access to only the one sheet.
