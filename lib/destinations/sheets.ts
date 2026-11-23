import { google } from 'googleapis';
import type { Lead } from '../supabase';

const HEADERS = [
  'Found',
  'Score',
  'Title',
  'Verdict',
  'Budget (USD)',
  'Type',
  'Bids',
  'Employer country',
  'Red flags',
  'Suggested angle',
  'Link',
];

function client() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('Google service account env vars are missing');

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

function row(lead: Lead) {
  return [
    new Date().toISOString().slice(0, 16).replace('T', ' '),
    lead.score ?? '',
    lead.title,
    lead.verdict ?? '',
    lead.budget_usd ?? '',
    lead.project_type ?? '',
    lead.bid_count ?? '',
    lead.employer_country ?? '',
    (lead.red_flags ?? []).join('; '),
    lead.angle ?? '',
    lead.url,
  ];
}

/** Creates the header row on first use, then appends. Returns rows written. */
export async function pushToSheet(leads: Lead[]): Promise<number> {
  if (!leads.length) return 0;

  const sheets = client();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;
  const tab = process.env.GOOGLE_SHEET_TAB ?? 'Leads';

  const head = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A1:K1`,
  });
  if (!head.data.values?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tab}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: leads.map(row) },
  });

  return leads.length;
}
