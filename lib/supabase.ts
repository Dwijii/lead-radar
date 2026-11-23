import { createClient } from '@supabase/supabase-js';

export type LeadStatus = 'new' | 'shortlisted' | 'bid' | 'won' | 'dismissed';

export type Lead = {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  url: string;
  project_type: string | null;
  currency: string | null;
  budget_min: number | null;
  budget_max: number | null;
  budget_usd: number | null;
  skills: string[];
  bid_count: number | null;
  bid_avg: number | null;
  employer_country: string | null;
  employer_rating: number | null;
  employer_verified: boolean;
  posted_at: string | null;
  score: number | null;
  verdict: string | null;
  reasons: string[];
  red_flags: string[];
  angle: string | null;
  status: LeadStatus;
  pushed_at: string | null;
  created_at: string;
};

/**
 * Service-role client. Server-side only — never import this into a client component.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars are missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Of the given project IDs, which ones are already stored? */
export async function existingProjectIds(ids: number[]): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const { data, error } = await supabaseAdmin()
    .from('leads')
    .select('project_id')
    .in('project_id', ids);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.project_id as number));
}
