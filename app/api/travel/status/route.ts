import { getTravelService } from '@/lib/travel/service';
export const dynamic = 'force-dynamic';
export async function GET() {
  return getTravelService().handleStatus();
}
