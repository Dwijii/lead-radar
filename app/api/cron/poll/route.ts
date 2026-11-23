import { NextResponse } from 'next/server';
import { runPipeline } from '@/lib/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured — local dev
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  try {
    const result = await runPipeline();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** Same thing, for the "Scan now" button in the dashboard. */
export const POST = GET;
