import { db, initialize } from '@/lib/server';
import { databaseConfigured } from '@/db';
import { demoDestinations } from '@/lib/domain';
import Shell from '@/components/shell';
import { notFound } from 'next/navigation';
export const dynamic = 'force-dynamic';
async function destination(slug: string) {
  if (!databaseConfigured()) return demoDestinations.find(d => d.id === slug) || null;
  await initialize();
  const row = await db()
    .prepare('SELECT data FROM destinations WHERE id=? AND hidden=0')
    .bind(slug)
    .first<{ data: string }>();
  return row ? JSON.parse(row.data) : null;
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const d = await destination((await params).slug);
  return d
    ? {
        title: d.name,
        description: d.description,
        openGraph: {
          title: d.name + ' | VoyConPlan',
          description: d.description,
          images: [
            { url: (process.env.APP_ORIGIN || 'http://localhost:3000') + d.image },
          ],
        },
        twitter: {
          title: d.name + ' | VoyConPlan',
          description: d.description,
          images: [(process.env.APP_ORIGIN || 'http://localhost:3000') + d.image],
        },
      }
    : { title: 'Destino no encontrado' };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const d = await destination((await params).slug);
  if (!d) notFound();
  return (
    <Shell>
      <article className="article">
        <div className="eyebrow">{d.country}</div>
        <h1 className="page-title">{d.name}</h1>
        <p className="subheading">{d.description}</p>
        <img className="destination-hero" src={d.image} alt={d.name} />
        <a className="source-link" href={d.source}>
          Fotografía: {d.author} / Unsplash
        </a>
        <div className="notice warning">
          Los costos del catálogo son DEMO. Requisitos, clima, moneda y
          disponibilidad no verificados.
        </div>
        <div className="filter-row">
          {d.tags.map((t: string) => (
            <span key={t} className="pill">
              {t}
            </span>
          ))}
        </div>
        <a className="btn lime space-top" href="/">
          Calcular mi presupuesto
        </a>
      </article>
    </Shell>
  );
}
