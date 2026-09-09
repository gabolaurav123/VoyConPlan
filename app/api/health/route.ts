import { databaseConfigured, getNodeDb } from '@/db/node';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!databaseConfigured()) return Response.json({ status: 'ok', database: 'not_configured', mode: 'public_demo' }, { status: new URL(request.url).searchParams.get('database') === '1' ? 503 : 200, headers });
  try { await getNodeDb().prepare('SELECT 1 AS ok').first(); return Response.json({ status: 'ok', database: 'connected' }, { headers }); }
  catch { return Response.json({ status: 'unavailable', database: 'unavailable' }, { status: 503, headers }); }
}
