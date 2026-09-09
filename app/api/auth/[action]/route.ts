import { getNodeDb } from '@/db/node';
import { createAuthService } from '@/lib/auth';

type Context = { params: Promise<{ action: string }> };
export async function POST(request: Request, context: Context) {
  const { action } = await context.params;
  return createAuthService({ db: getNodeDb(), env: process.env }).handle(
    request,
    action,
  );
}
export async function GET(request: Request, context: Context) {
  const { action } = await context.params;
  return createAuthService({ db: getNodeDb(), env: process.env }).handle(
    request,
    action,
  );
}
