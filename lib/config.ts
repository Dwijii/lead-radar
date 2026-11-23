/**
 * Everything you'll want to tune lives here.
 * Change this file, redeploy, done — no other file needs touching.
 */

export const searchConfig = {
  /**
   * Keywords. Freelancer's `or_search_query` matches any of these.
   * Keep them broad — the prefilter and Claude do the narrowing.
   */
  keywords: [
    'revenue operations',
    'marketing automation',
    'hubspot',
    'gohighlevel',
    'crm setup',
    'meta ads',
    'google ads',
    'looker studio',
    'ga4',
    'lead generation funnel',
    'zapier',
    'make.com',
    'seo',
  ],

  /**
   * Freelancer skill (job) IDs. Run `npm run jobs -- crm` to look IDs up by name.
   * Leave empty to search by keyword only.
   */
  jobIds: [] as number[],

  projectTypes: ['fixed', 'hourly'] as Array<'fixed' | 'hourly'>,

  /** How far back to look on each run. Overlap is fine — dedupe handles it. */
  lookbackMinutes: 90,

  /** Max projects pulled per run. The API caps at 100 per page. */
  limit: 100,
};

/**
 * Cheap, deterministic filters. These run BEFORE Claude sees anything,
 * so they're what keeps your API bill small.
 */
export const prefilter = {
  /** Skip anything below this. Uses budget midpoint converted to USD. */
  minBudgetUsd: 250,

  /** Hourly projects: minimum average hourly rate in USD. */
  minHourlyUsd: 20,

  /** Skip crowded auctions — you won't win a 60-bid race on price. */
  maxBidCount: 25,

  /** Only employers who've attached a payment method. Kills most time-wasters. */
  requirePaymentVerified: true,

  /** Any of these in the title or description and the project is dropped. */
  blocklist: [
    'data entry',
    'copy paste',
    'typing job',
    'virtual assistant',
    'academic writing',
    'thesis',
    'assignment help',
  ],
};

/** Leads scoring below this are stored but not pushed to your Sheet/Notion. */
export const SCORE_THRESHOLD = 65;

/**
 * Your fit profile. This is the single biggest lever on scoring quality —
 * the more specific and honest it is, the better the scores.
 */
export const fitProfile = `
I am a Revenue Operations and marketing technology specialist based in South Africa,
working remotely with clients in the UK, US and Australia.

What I'm strong at, roughly in order of how much I want the work:
- RevOps builds: CRM architecture, lifecycle stages, pipeline and attribution setup
  (HubSpot, GoHighLevel, Salesforce admin-level work)
- Marketing automation: nurture sequences, lead routing, webhook and API plumbing
  between CRM, forms, ad platforms and billing (Make.com, Zapier, n8n)
- Paid media operations: Meta and Google Ads account builds, pixel/CAPI and
  server-side tracking, reporting infrastructure
- Analytics and reporting: GA4, Looker Studio, Power BI, SQL, attribution modelling
- Full-stack builds where the deliverable is a marketing system: Next.js + Supabase
  landing pages, lead-gen tools, internal dashboards
- Technical SEO and keyword strategy (Semrush-based)

What makes a project a strong fit:
- The client has an existing business with real revenue and a specific broken thing
- Scope is a system or a build, not an hourly body-shop arrangement
- There is room for a retainer or a follow-on phase after the initial deliverable
- The brief shows the client understands roughly what they're asking for
- Budget is realistic for the scope described

What makes a project a poor fit:
- Pure design, pure copywriting, or pure content-mill work
- Generic "I need a website" with no system component
- Equity-only, revenue-share, or "long-term work at low rate to start" framing
- Scope that is obviously 10x the stated budget
- Vague briefs that read like they were posted to collect free consulting
- Anything requiring physical presence or a specific timezone I can't cover (SAST, UTC+2)
`.trim();
