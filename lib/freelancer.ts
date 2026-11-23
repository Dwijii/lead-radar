/**
 * Freelancer.com API client (API version 0.1).
 * Docs: https://developers.freelancer.com
 *
 * Auth is a single OAuth token passed in the `freelancer-oauth-v1` header.
 * Generate one from your Freelancer developer account and put it in FREELANCER_OAUTH_TOKEN.
 */

const BASE = process.env.FREELANCER_BASE_URL ?? 'https://www.freelancer.com';

export type FreelancerProject = {
  id: number;
  owner_id: number;
  title: string;
  seo_url: string;
  type: 'fixed' | 'hourly';
  status: string;
  submitdate: number;
  time_submitted: number;
  description?: string;
  preview_description?: string;
  currency?: { code: string; sign: string; exchange_rate?: number };
  budget?: { minimum?: number; maximum?: number };
  hourly_project_info?: { commitment?: { hours: number; interval: string } };
  jobs?: Array<{ id: number; name: string }>;
  bid_stats?: { bid_count?: number; bid_avg?: number };
  owner?: {
    id: number;
    location?: { country?: { name?: string } };
    status?: { payment_verified?: boolean; email_verified?: boolean; deposit_made?: boolean };
    employer_reputation?: { entire_history?: { overall?: number } };
  };
};

type ActiveProjectsResponse = {
  status: string;
  result?: { projects?: FreelancerProject[]; total_count?: number };
  message?: string;
};

function authHeaders() {
  const token = process.env.FREELANCER_OAUTH_TOKEN;
  if (!token) throw new Error('FREELANCER_OAUTH_TOKEN is not set');
  return { 'freelancer-oauth-v1': token, Accept: 'application/json' };
}

export type SearchArgs = {
  keywords?: string[];
  jobIds?: number[];
  projectTypes?: Array<'fixed' | 'hourly'>;
  fromTime?: number; // unix seconds
  limit?: number;
};

export async function searchActiveProjects(args: SearchArgs): Promise<FreelancerProject[]> {
  const p = new URLSearchParams();

  p.set('limit', String(args.limit ?? 100));
  p.set('sort_field', 'time_updated');
  p.set('full_description', 'true');
  p.set('job_details', 'true');
  p.set('user_details', 'true');
  p.set('user_status', 'true');
  p.set('user_location', 'true');
  p.set('user_reputation', 'true');

  if (args.keywords?.length) p.set('or_search_query', args.keywords.join(' '));
  for (const id of args.jobIds ?? []) p.append('jobs[]', String(id));
  for (const t of args.projectTypes ?? []) p.append('project_types[]', t);
  if (args.fromTime) p.set('from_time', String(args.fromTime));

  const url = `${BASE}/api/projects/0.1/projects/active/?${p.toString()}`;
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });

  if (res.status === 401 || res.status === 403) {
    throw new Error('Freelancer rejected the token. Regenerate FREELANCER_OAUTH_TOKEN.');
  }
  if (res.status === 429) {
    throw new Error('Freelancer rate limit hit. Increase the interval between runs.');
  }
  if (!res.ok) {
    throw new Error(`Freelancer API returned ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as ActiveProjectsResponse;
  if (data.status !== 'success') {
    throw new Error(`Freelancer API error: ${data.message ?? 'unknown'}`);
  }
  return data.result?.projects ?? [];
}

/** Look up skill (job) IDs by name — used by `npm run jobs`. */
export async function listJobs(): Promise<Array<{ id: number; name: string; category?: string }>> {
  const url = `${BASE}/api/projects/0.1/jobs/?job_names=true&seo_details=true`;
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error(`Job lookup returned ${res.status}`);
  const data = await res.json();
  const raw = data?.result ?? [];
  const arr = Array.isArray(raw) ? raw : Object.values(raw);
  return (arr as any[]).map((j) => ({ id: j.id, name: j.name, category: j.category?.name }));
}

export function projectUrl(p: FreelancerProject) {
  return `${BASE}/projects/${p.seo_url ?? p.id}`;
}

/** Budget midpoint in USD. Falls back to whichever bound exists. */
export function budgetUsd(p: FreelancerProject): number | null {
  const rate = p.currency?.exchange_rate ?? 1;
  const min = p.budget?.minimum;
  const max = p.budget?.maximum;
  if (min == null && max == null) return null;
  const mid = min != null && max != null ? (min + max) / 2 : (min ?? max)!;
  return Math.round(mid * rate);
}
