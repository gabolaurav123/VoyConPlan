import { db, initialize } from '@/lib/server';
export default async function sitemap() {
  await initialize();
  const base = 'https://voyconplan.gabolaurav2.chatgpt.site';
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
