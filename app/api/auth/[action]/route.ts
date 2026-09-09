import { databaseConfigured, getNodeDb } from '@/db/node';
import { createAuthService } from '@/lib/auth';
type Context = { params: Promise<{ action: string }> };
export const dynamic = 'force-dynamic';
async function handle(request: Request, context: Context) {
  const { action } = await context.params;
  if (!databaseConfigured()) {
    const headers = { 'Cache-Control': 'no-store' };
    if (request.method === 'GET' && action === 'session') return Response.json({ user: null, databaseConfigured: false }, { headers });
    if (request.method === 'GET' && action === 'status') return Response.json({ setupAvailable: false, emailVerificationAvailable: false, passwordResetAvailable: false, databaseConfigured: false }, { headers });
    return Response.json({ error: 'Las cuentas todavía no están disponibles. Puedes seguir explorando y descargar el PDF de ejemplo.', code: 'DATABASE_NOT_CONFIGURED' }, { status: 503, headers });
  }
  try { return await createAuthService({ db: getNodeDb(), env: process.env }).handle(request, action); }
  catch { return Response.json({ error: 'No se pudo conectar con la base de datos. Intenta más tarde.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
export const POST = handle;
export const GET = handle;
