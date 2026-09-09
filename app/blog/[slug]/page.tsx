import { db, initialize } from '@/lib/server';
import Shell from '@/components/shell';
import { notFound } from 'next/navigation';
export const dynamic = 'force-dynamic';
async function post(slug: string) {
  await initialize();
  return await db()
    .prepare('SELECT * FROM content WHERE slug=? AND status=?')
    .bind(slug, 'Publicado')
    .first<any>();
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const p = await post((await params).slug);
  return p
    ? {
        title: p.title,
        description: p.summary,
        openGraph: { title: p.title, description: p.summary, images: [] },
        twitter: { title: p.title, description: p.summary, images: [] },
      }
    : { title: 'Publicación no encontrada' };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const p = await post((await params).slug);
  if (!p) notFound();
  return (
    <Shell>
      <article className="article">
        <div className="eyebrow">{p.kind}</div>
        <h1 className="page-title">{p.title}</h1>
        <p className="subheading">{p.summary}</p>
        <div className="article-body">
          {p.body.split('\n').map((line: string, i: number) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        <a className="text-link" href="/blog">
          Volver a las guías
        </a>
      </article>
    </Shell>
  );
}
