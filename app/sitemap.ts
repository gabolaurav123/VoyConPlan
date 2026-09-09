import { db, initialize } from '@/lib/server';
import { databaseConfigured } from '@/db';
import { demoDestinations } from '@/lib/domain';
export default async function sitemap() {
  const base = process.env.APP_ORIGIN || 'http://localhost:3000';
  if (!databaseConfigured()) return [
    { url: base }, { url: base + '/planes' },
    ...demoDestinations.map(d => ({ url: base + '/destinos/' + d.id })),
  ];
  await initialize();
  const posts = await db()
    .prepare('SELECT slug FROM content WHERE status=?')
    .bind('Publicado')
    .all();
  const ds = await db()
    .prepare('SELECT id FROM destinations WHERE hidden=0')
    .all();
  return [
    { url: base },
    { url: base + '/planes' },
    { url: base + '/blog' },
    ...posts.results.map((r: any) => ({ url: base + '/blog/' + r.slug })),
    ...ds.results.map((d: any) => ({ url: base + '/destinos/' + d.id })),
  ];
}
