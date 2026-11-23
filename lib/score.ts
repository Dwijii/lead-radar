import Anthropic from '@anthropic-ai/sdk';
import { fitProfile } from './config';
import type { FreelancerProject } from './freelancer';
import { budgetUsd } from './freelancer';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = process.env.SCORING_MODEL ?? 'claude-sonnet-5-5';

export type Score = {
  score: number;
  verdict: string;
  reasons: string[];
  red_flags: string[];
  angle: string;
};

const SYSTEM = `You screen freelance project briefs for one specific consultant and decide how well each one fits.

Here is the consultant's profile:
<profile>
${fitProfile}
</profile>

Score each brief 0-100 on fit. Calibrate as follows:
- 85-100: squarely in their wheelhouse, realistic budget, retainer potential
- 70-84: good fit with a caveat (budget slightly light, scope a bit fuzzy)
- 50-69: adjacent work they could do but wouldn't seek out
- 25-49: wrong discipline, or the brief has real warning signs
- 0-24: spam, content mill, unrealistic budget, or scope they don't do

Be harsh. Most posts on a marketplace are mediocre and should score below 50.
Do not inflate scores to be encouraging.

Respond with a single JSON object and nothing else. No markdown fences, no preamble.
Shape:
{
  "score": <integer 0-100>,
  "verdict": "<one sentence, max 15 words, on why it scored that way>",
  "reasons": ["<short phrase>", ...],   // 2-4 concrete fit signals
  "red_flags": ["<short phrase>", ...], // 0-4 concerns, empty array if none
  "angle": "<one sentence: the strongest opening line for a proposal, or empty if score < 50>"
}`;

function brief(p: FreelancerProject) {
  const usd = budgetUsd(p);
  return [
    `Title: ${p.title}`,
    `Type: ${p.type}`,
    `Budget: ${p.currency?.code ?? ''} ${p.budget?.minimum ?? '?'}-${p.budget?.maximum ?? '?'}` +
      (usd ? ` (~$${usd} USD)` : ''),
    `Skills tagged: ${(p.jobs ?? []).map((j) => j.name).join(', ') || 'none'}`,
    `Bids so far: ${p.bid_stats?.bid_count ?? 0}`,
    `Employer country: ${p.owner?.location?.country?.name ?? 'unknown'}`,
    `Employer payment verified: ${p.owner?.status?.payment_verified ? 'yes' : 'no'}`,
    `Employer rating: ${p.owner?.employer_reputation?.entire_history?.overall?.toFixed(1) ?? 'none yet'}`,
    '',
    'Description:',
    (p.description ?? p.preview_description ?? '').slice(0, 4000),
  ].join('\n');
}

export async function scoreProject(p: FreelancerProject): Promise<Score> {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: SYSTEM,
    messages: [{ role: 'user', content: brief(p) }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .replace(/```json|```/g, '')
    .trim();

  try {
    const parsed = JSON.parse(text) as Partial<Score>;
    return {
      score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
      verdict: parsed.verdict ?? '',
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 4) : [],
      red_flags: Array.isArray(parsed.red_flags) ? parsed.red_flags.slice(0, 4) : [],
      angle: parsed.angle ?? '',
    };
  } catch {
    // A malformed response shouldn't kill the run — park it at neutral for manual review.
    return { score: 50, verdict: 'Scoring failed, review manually', reasons: [], red_flags: ['unscored'], angle: '' };
  }
}

/** Score in small batches so a burst of new projects doesn't trip rate limits. */
export async function scoreAll(projects: FreelancerProject[], concurrency = 4) {
  const out: Array<{ project: FreelancerProject; score: Score }> = [];
  for (let i = 0; i < projects.length; i += concurrency) {
    const chunk = projects.slice(i, i + concurrency);
    const scored = await Promise.all(
      chunk.map(async (project) => ({ project, score: await scoreProject(project) })),
    );
    out.push(...scored);
  }
  return out;
}
