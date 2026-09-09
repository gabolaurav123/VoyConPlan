import { DestinationQueryError, searchDestinations } from '../../../lib/destinations.ts';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const result = searchDestinations(new URL(request.url).searchParams);
    return Response.json(result, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    });
  } catch (error) {
    if (error instanceof DestinationQueryError) {
      return Response.json({ error: error.message }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
    throw error;
  }
}
