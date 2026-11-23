import { supabaseAdmin, type Lead } from '@/lib/supabase';
import { SCORE_THRESHOLD } from '@/lib/config';
import LeadList from './components/LeadList';

export const dynamic = 'force-dynamic';

async function getData() {
  const db = supabaseAdmin();

  const [{ data: leads }, { data: runs }] = await Promise.all([
    db.from('leads').select('*').order('score', { ascending: false }).limit(200),
    db.from('sync_runs').select('*').order('started_at', { ascending: false }).limit(1),
  ]);

  return {
    leads: (leads ?? []) as Lead[],
    lastRun: runs?.[0] ?? null,
  };
}

function timeAgo(iso: string | null) {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default async function Page() {
  const { leads, lastRun } = await getData();
  const open = leads.filter((l) => l.status === 'new' || l.status === 'shortlisted');

  return (
    <main className="mx-auto max-w-4xl px-5 pb-24 pt-10 sm:px-8">
      <header className="mb-10 border-b border-rule pb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h1 className="text-[2.6rem] font-bold leading-none tracking-[-0.03em] sm:text-[3.4rem]">
            Lead Radar
          </h1>
          <p className="tnum text-xs uppercase tracking-[0.14em] text-ink-soft">
            Last scan {timeAgo(lastRun?.started_at ?? null)}
            {lastRun?.error ? ' — failed' : ''}
          </p>
        </div>

        <p className="mt-4 max-w-xl text-[0.95rem] leading-relaxed text-ink-soft">
          Every active Freelancer.com project matching your filters, scored against your fit
          profile. Anything under {SCORE_THRESHOLD} stays here and never reaches your sheet.
        </p>

        <dl className="tnum mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-[0.7rem] uppercase tracking-[0.14em] text-ink-soft">Open</dt>
            <dd className="text-2xl font-medium">{open.length}</dd>
          </div>
          <div>
            <dt className="text-[0.7rem] uppercase tracking-[0.14em] text-ink-soft">
              Scored ≥ {SCORE_THRESHOLD}
            </dt>
            <dd className="text-2xl font-medium">
              {leads.filter((l) => (l.score ?? 0) >= SCORE_THRESHOLD).length}
            </dd>
          </div>
          <div>
            <dt className="text-[0.7rem] uppercase tracking-[0.14em] text-ink-soft">
              Last run kept
            </dt>
            <dd className="text-2xl font-medium">{lastRun?.kept ?? 0}</dd>
          </div>
        </dl>
      </header>

      <LeadList initialLeads={leads} threshold={SCORE_THRESHOLD} />
    </main>
  );
}
