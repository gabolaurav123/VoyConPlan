'use client';
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state">
      <h1 className="page-title">El plan encontró un desvío.</h1>
      <p>No pudimos cargar esta sección. Vuelve a intentarlo.</p>
      <button className="btn lime" onClick={reset}>
        Reintentar
      </button>
    </div>
  );
}
