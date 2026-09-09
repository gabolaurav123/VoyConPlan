import { ArrowUpRight, Check } from 'lucide-react';
import './plans-preview.css';

export type PlanSummary = {
  id: string;
  price: number;
  trip_limit: number;
  collaborators: number;
  features: string[];
};

export default function PlansPreview({ plans }: { plans: PlanSummary[] }) {
  if (!plans.length) return null;
  return (
    <section className="home-plans" aria-labelledby="home-plans-title">
      <div className="home-plans-heading">
        <div>
          <div className="eyebrow">FREE Y PLANES PREMIUM</div>
          <h2 id="home-plans-title">Un plan a tu medida.</h2>
          <p>Conoce qué incluye cada opción para organizar tus próximos viajes.</p>
        </div>
        <a className="btn outline" href="/planes">
          Comparar todos los planes <ArrowUpRight size={18} />
        </a>
      </div>
      <div className="home-plans-grid">
        {plans.map((plan) => (
          <article className={'home-plan-card' + (plan.id === 'Plus' ? ' highlighted' : '')} key={plan.id}>
            <div className="home-plan-name">
              <h3>{plan.id}</h3>
              <span>{plan.price === 0 ? 'Para empezar' : 'Premium · próximamente'}</span>
            </div>
            <div className="home-plan-price">
              <strong>${(plan.price / 100).toFixed(2)}</strong><span>USD / mes</span>
            </div>
            <ul>
              <li><Check size={17} />{plan.trip_limit} viajes nuevos al mes</li>
              <li><Check size={17} />{plan.collaborators} {plan.collaborators === 1 ? 'acompañante' : 'acompañantes'}</li>
              {plan.features.slice(0, 2).map((feature) => <li key={feature}><Check size={17} />{feature}</li>)}
            </ul>
            <a href={'/planes#plan-' + encodeURIComponent(plan.id)}>
              Ver qué incluye {plan.id} <ArrowUpRight size={17} />
            </a>
          </article>
        ))}
      </div>
      <p className="home-plans-note">Precios de lanzamiento. Las suscripciones premium aún no están disponibles; puedes revisar sus prestaciones antes de elegir.</p>
    </section>
  );
}
