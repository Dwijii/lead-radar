import type { Lead } from '../supabase';

/**
 * Notion destination.
 *
 * Your database needs these properties (exact names, exact types):
 *   Name          Title
 *   Score         Number
 *   Verdict       Rich text
 *   Budget USD    Number
 *   Type          Select
 *   Bids          Number
 *   Country       Rich text
 *   Red flags     Multi-select
 *   Angle         Rich text
 *   Link          URL
 *   Status        Select   (options: new, shortlisted, bid, won, dismissed)
 */

const NOTION_VERSION = '2022-06-28';

function properties(lead: Lead) {
  return {
    Name: { title: [{ text: { content: lead.title.slice(0, 200) } }] },
    Score: { number: lead.score ?? null },
    Verdict: { rich_text: [{ text: { content: (lead.verdict ?? '').slice(0, 1900) } }] },
    'Budget USD': { number: lead.budget_usd ?? null },
    Type: lead.project_type ? { select: { name: lead.project_type } } : { select: null },
    Bids: { number: lead.bid_count ?? null },
    Country: { rich_text: [{ text: { content: lead.employer_country ?? '' } }] },
    'Red flags': { multi_select: (lead.red_flags ?? []).map((f) => ({ name: f.slice(0, 90) })) },
    Angle: { rich_text: [{ text: { content: (lead.angle ?? '').slice(0, 1900) } }] },
    Link: { url: lead.url },
    Status: { select: { name: 'new' } },
  };
}

export async function pushToNotion(leads: Lead[]): Promise<number> {
  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;
  if (!token || !databaseId) throw new Error('Notion env vars are missing');

  let written = 0;
  for (const lead of leads) {
    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: properties(lead),
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ text: { content: (lead.description ?? '').slice(0, 1900) } }],
            },
          },
        ],
      }),
    });

    if (res.ok) written++;
    else console.error('Notion write failed', lead.project_id, await res.text());
  }
  return written;
}
