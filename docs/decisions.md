# Architecture decision records

## ADR-001: Deterministic prefilter before LLM scoring
Marketplace feeds are mostly noise. Running free rules first (budget, bids, verification, blocklist) cuts model calls by roughly an order of magnitude, so LLM spend goes only on plausible matches. Trade-off: rules that are too tight silently drop good leads. That's why every scan logs stage counts and stores rejected leads.

## ADR-002: Natural-language fit profile instead of keyword weights
Keyword scoring can't tell "build our HubSpot lifecycle stages" from "write blog posts about HubSpot". A written profile with explicit negatives (no equity-only work, no content mills, no vague briefs) lets the model judge intent. Trade-off: scoring is less predictable, so the threshold is tunable and verdicts are stored for review.

## ADR-003: Official API, not HTML scraping
Freelancer.com has an official REST API with OAuth tokens. Using it avoids breakage when the site changes and stays within the platform's terms.

## ADR-004: Store everything; push only above threshold
The database is the source of truth and audit log. Sheets and Notion are just delivery channels for the leads worth acting on.

## ADR-005: Fail soft on model errors
A malformed response stores the lead with score 50 and an `unscored` flag, rather than failing the whole run and losing every other lead in the batch.

## ADR-006: Next.js + Supabase on Vercel
One codebase for the dashboard, API routes and cron entry point. Postgres gives a unique constraint for dedupe. The free tiers cover a single-user tool.
