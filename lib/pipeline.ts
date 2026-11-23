import { searchConfig, prefilter, SCORE_THRESHOLD } from './config';
import {
  searchActiveProjects,
  projectUrl,
  budgetUsd,
  type FreelancerProject,
} from './freelancer';
import { scoreAll } from './score';
import { supabaseAdmin, existingProjectIds, type Lead } from './supabase';
import { pushToSheet } from './destinations/sheets';
import { pushToNotion } from './destinations/notion';

export type RunResult = {
  fetched: number;
  new_projects: number;
  scored: number;
  kept: number;
  pushed: number;
};

/** Deterministic rules applied before anything is sent to Claude. */
function passesPrefilter(p: FreelancerProject): boolean {
  const haystack = `${p.title} ${p.description ?? p.preview_description ?? ''}`.toLowerCase();
  if (prefilter.blocklist.some((term) => haystack.includes(term))) return false;

  if (prefilter.requirePaymentVerified && !p.owner?.status?.payment_verified) return false;

  if ((p.bid_stats?.bid_count ?? 0) > prefilter.maxBidCount) return false;

  const usd = budgetUsd(p);
  if (usd == null) return false;
  if (p.type === 'hourly') {
    if (usd < prefilter.minHourlyUsd) return false;
  } else if (usd < prefilter.minBudgetUsd) return false;

  return true;
}

function toRow(p: FreelancerProject, s: Awaited<ReturnType<typeof scoreAll>>[number]['score']) {
  return {
    project_id: p.id,
    title: p.title,
    description: (p.description ?? p.preview_description ?? '').slice(0, 8000),
    url: projectUrl(p),
    seo_url: p.seo_url,
    project_type: p.type,
    currency: p.currency?.code ?? null,
    budget_min: p.budget?.minimum ?? null,
    budget_max: p.budget?.maximum ?? null,
    budget_usd: budgetUsd(p),
    skills: (p.jobs ?? []).map((j) => j.name),
    bid_count: p.bid_stats?.bid_count ?? null,
    bid_avg: p.bid_stats?.bid_avg ?? null,
    employer_country: p.owner?.location?.country?.name ?? null,
    employer_rating: p.owner?.employer_reputation?.entire_history?.overall ?? null,
    employer_verified: Boolean(p.owner?.status?.payment_verified),
    employer_deposit: Boolean(p.owner?.status?.deposit_made),
    posted_at: new Date((p.time_submitted ?? p.submitdate) * 1000).toISOString(),
    score: s.score,
    verdict: s.verdict,
    reasons: s.reasons,
    red_flags: s.red_flags,
    angle: s.angle,
    scored_at: new Date().toISOString(),
    status: 'new' as const,
  };
}

async function pushToDestination(leads: Lead[]): Promise<number> {
  const target = (process.env.LEAD_DESTINATION ?? 'sheets').toLowerCase();
  if (!leads.length) return 0;
  if (target === 'notion') return pushToNotion(leads);
  if (target === 'both') {
    const [a, b] = await Promise.all([pushToSheet(leads), pushToNotion(leads)]);
    return Math.max(a, b);
  }
  return pushToSheet(leads);
}

export async function runPipeline(): Promise<RunResult> {
  const db = supabaseAdmin();
  const { data: run } = await db.from('sync_runs').insert({}).select('id').single();
  const runId = run?.id;

  const result: RunResult = { fetched: 0, new_projects: 0, scored: 0, kept: 0, pushed: 0 };

  try {
    const fromTime = Math.floor(Date.now() / 1000) - searchConfig.lookbackMinutes * 60;
    const projects = await searchActiveProjects({
      keywords: searchConfig.keywords,
      jobIds: searchConfig.jobIds,
      projectTypes: searchConfig.projectTypes,
      fromTime,
      limit: searchConfig.limit,
    });
    result.fetched = projects.length;

    const seen = await existingProjectIds(projects.map((p) => p.id));
    const fresh = projects.filter((p) => !seen.has(p.id));
    result.new_projects = fresh.length;

    const candidates = fresh.filter(passesPrefilter);
    result.scored = candidates.length;

    const scored = await scoreAll(candidates);

    if (scored.length) {
      const rows = scored.map(({ project, score }) => toRow(project, score));
      const { data: inserted, error } = await db
        .from('leads')
        .upsert(rows, { onConflict: 'project_id', ignoreDuplicates: true })
        .select('*');
      if (error) throw error;

      const qualified = ((inserted ?? []) as Lead[]).filter(
        (l) => (l.score ?? 0) >= SCORE_THRESHOLD,
      );
      result.kept = qualified.length;

      if (qualified.length) {
        result.pushed = await pushToDestination(qualified);
        await db
          .from('leads')
          .update({ pushed_at: new Date().toISOString() })
          .in('id', qualified.map((l) => l.id));
      }
    }

    if (runId) {
      await db
        .from('sync_runs')
        .update({ ...result, finished_at: new Date().toISOString() })
        .eq('id', runId);
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (runId) {
      await db
        .from('sync_runs')
        .update({ ...result, error: message, finished_at: new Date().toISOString() })
        .eq('id', runId);
    }
    throw err;
  }
}
