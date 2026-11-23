'use client';

import { useMemo, useState, useTransition } from 'react';
import type { Lead, LeadStatus } from '@/lib/supabase';

type Props = { initialLeads: Lead[]; threshold: number };

const VIEWS = [
  { key: 'qualified', label: 'Qualified' },
  { key: 'all', label: 'Everything scanned' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'bid', label: 'Bid sent' },
] as const;

type ViewKey = (typeof VIEWS)[number]['key'];

function money(lead: Lead) {
  if (lead.budget_usd == null) return 'no budget';
  return `$${lead.budget_usd.toLocaleString()}${lead.project_type === 'hourly' ? '/hr' : ''}`;
}

function ago(iso: string | null) {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m old`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h old` : `${Math.round(hrs / 24)}d old`;
}

export default function LeadList({ initialLeads, threshold }: Props) {
  const [leads, setLeads] = useState(initialLeads);
  const [view, setView] = useState<ViewKey>('qualified');
  const [scanning, setScanning] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visible = useMemo(() => {
    const base = leads.filter((l) => l.status !== 'dismissed' || view === 'all');
    if (view === 'qualified') return base.filter((l) => (l.score ?? 0) >= threshold && l.status === 'new');
    if (view === 'shortlisted') return base.filter((l) => l.status === 'shortlisted');
    if (view === 'bid') return base.filter((l) => l.status === 'bid' || l.status === 'won');
    return base;
  }, [leads, view, threshold]);

  function setStatus(id: number, status: LeadStatus) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    startTransition(async () => {
      await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
    });
  }

  async function scanNow() {
    setScanning(true);
    setNote(null);
    try {
      const res = await fetch('/api/cron/poll', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Scan failed');
      setNote(`Scanned ${data.fetched}, kept ${data.kept}. Reload to see them.`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  return (
    <>
      <div className="sticky top-0 z-10 -mx-5 mb-2 flex flex-wrap items-center gap-2 bg-paper/90 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`rounded-full px-3 py-1.5 text-[0.78rem] font-medium transition-colors ${
              view === v.key
                ? 'bg-ink text-surface'
                : 'text-ink-soft hover:bg-surface hover:text-ink'
            }`}
          >
            {v.label}
          </button>
        ))}

        <button
          onClick={scanNow}
          disabled={scanning}
          className="ml-auto rounded-full border border-ink px-3.5 py-1.5 text-[0.78rem] font-medium transition-colors hover:bg-ink hover:text-surface disabled:opacity-40"
        >
          {scanning ? 'Scanning…' : 'Scan now'}
        </button>
      </div>

      {note && (
        <p className="tnum mb-4 text-[0.8rem] text-signal">{note}</p>
      )}

      {visible.length === 0 ? (
        <p className="border-t border-rule pt-10 text-ink-soft">
          Nothing here yet. Run a scan, or widen the keywords in <code className="tnum">lib/config.ts</code>.
        </p>
      ) : (
        <ol>
          {visible.map((lead, i) => (
            <li
              key={lead.id}
              className="row-in grid grid-cols-[54px_1fr] gap-x-4 border-t border-rule py-6 sm:grid-cols-[84px_1fr] sm:gap-x-6"
              style={{ animationDelay: `${Math.min(i, 12) * 28}ms` }}
            >
              {/* Score rail — the bars form a descending staircase down the page */}
              <div className="flex items-start gap-2">
                <span className="tnum w-8 text-[1.6rem] font-semibold leading-none tracking-tight sm:w-11 sm:text-[2.1rem]">
                  {lead.score ?? '—'}
                </span>
                <div className="relative h-14 w-[3px] bg-rule sm:h-16">
                  <div
                    className="score-bar absolute bottom-0 w-full"
                    style={{
                      height: `${lead.score ?? 0}%`,
                      background:
                        (lead.score ?? 0) >= 85
                          ? 'var(--color-good)'
                          : (lead.score ?? 0) >= threshold
                            ? 'var(--color-signal)'
                            : 'var(--color-ink-soft)',
                    }}
                  />
                </div>
              </div>

              <div className="min-w-0">
                <a
                  href={lead.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[1.05rem] font-semibold leading-snug tracking-[-0.01em] underline-offset-4 hover:underline"
                >
                  {lead.title}
                </a>

                {lead.verdict && (
                  <p className="mt-1.5 text-[0.92rem] leading-relaxed text-ink-soft">
                    {lead.verdict}
                  </p>
                )}

                <p className="tnum mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[0.72rem] uppercase tracking-[0.08em] text-ink-soft">
                  <span>{money(lead)}</span>
                  <span>{lead.bid_count ?? 0} bids</span>
                  {lead.employer_country && <span>{lead.employer_country}</span>}
                  {lead.employer_rating != null && <span>★ {lead.employer_rating.toFixed(1)}</span>}
                  <span>{ago(lead.posted_at)}</span>
                </p>

                {lead.red_flags?.length > 0 && (
                  <p className="mt-2 text-[0.78rem] text-warn">
                    {lead.red_flags.join(' · ')}
                  </p>
                )}

                {lead.angle && (
                  <p className="mt-3 border-l-2 border-signal pl-3 text-[0.88rem] leading-relaxed">
                    {lead.angle}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2 text-[0.75rem]">
                  {lead.status !== 'shortlisted' && (
                    <button
                      onClick={() => setStatus(lead.id, 'shortlisted')}
                      className="rounded border border-rule bg-surface px-2.5 py-1 font-medium hover:border-ink"
                    >
                      Shortlist
                    </button>
                  )}
                  {lead.status !== 'bid' && (
                    <button
                      onClick={() => setStatus(lead.id, 'bid')}
                      className="rounded border border-rule bg-surface px-2.5 py-1 font-medium hover:border-ink"
                    >
                      Mark bid sent
                    </button>
                  )}
                  <button
                    onClick={() => setStatus(lead.id, 'dismissed')}
                    className="rounded px-2.5 py-1 font-medium text-ink-soft hover:text-warn"
                  >
                    Dismiss
                  </button>
                  {lead.status !== 'new' && (
                    <span className="tnum self-center px-1 text-[0.7rem] uppercase tracking-[0.12em] text-ink-soft">
                      {lead.status}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
