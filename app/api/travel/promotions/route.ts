import { getPromotionFeed } from '@/lib/travel/promotions';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(await getPromotionFeed(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
