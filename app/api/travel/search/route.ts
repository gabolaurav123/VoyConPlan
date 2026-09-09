import { getTravelService } from '@/lib/travel/service';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  return getTravelService().handleSearch(request);
}
