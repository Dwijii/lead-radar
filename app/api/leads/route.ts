import { NextResponse } from 'next/server';
import { supabaseAdmin, type LeadStatus } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID: LeadStatus[] = ['new', 'shortlisted', 'bid', 'won', 'dismissed'];

export async function PATCH(req: Request) {
  const { id, status } = (await req.json()) as { id?: number; status?: LeadStatus };

  if (!id || !status || !VALID.includes(status)) {
    return NextResponse.json({ error: 'Send an id and a valid status.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin().from('leads').update({ status }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
