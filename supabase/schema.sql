-- Freelancer Lead Radar — Supabase schema
-- Run this in the Supabase SQL editor.

create table if not exists leads (
  id                bigserial primary key,
  project_id        bigint unique not null,          -- Freelancer.com project id (dedupe key)
  title             text not null,
  description       text,
  url               text not null,
  seo_url           text,

  project_type      text,                            -- 'fixed' | 'hourly'
  currency          text,
  budget_min        numeric,
  budget_max        numeric,
  budget_usd        numeric,                         -- normalised midpoint, for filtering
  skills            text[] default '{}',

  bid_count         integer,
  bid_avg           numeric,

  employer_country  text,
  employer_rating   numeric,
  employer_verified boolean default false,
  employer_deposit  boolean default false,           -- payment method verified

  posted_at         timestamptz,

  -- scoring output
  score             integer,                         -- 0-100
  verdict           text,                            -- one-line summary
  reasons           jsonb default '[]'::jsonb,
  red_flags         jsonb default '[]'::jsonb,
  angle             text,                            -- suggested pitch angle
  scored_at         timestamptz,

  -- workflow
  status            text not null default 'new',     -- new | shortlisted | bid | won | dismissed
  pushed_at         timestamptz,                     -- when written to Sheet/Notion
  created_at        timestamptz not null default now()
);

create index if not exists leads_score_idx     on leads (score desc nulls last);
create index if not exists leads_posted_idx    on leads (posted_at desc);
create index if not exists leads_status_idx    on leads (status);

create table if not exists sync_runs (
  id            bigserial primary key,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  fetched       integer default 0,   -- returned by the API
  new_projects  integer default 0,   -- not already in leads
  scored        integer default 0,   -- passed prefilter, sent to Claude
  kept          integer default 0,   -- cleared the score threshold
  pushed        integer default 0,   -- written to destination
  error         text
);

-- Row level security: the app talks to Supabase with the service role key from
-- server-side code only, so RLS stays on with no public policies.
alter table leads      enable row level security;
alter table sync_runs  enable row level security;
