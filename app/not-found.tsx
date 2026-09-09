import Shell from '@/components/shell';
export default function NotFound() {
  return (
    <Shell>
      <div className="empty-state">
        <h1 className="page-title">Este camino aún no existe.</h1>
        <a className="btn lime" href="/">
          Volver a explorar
        </a>
      </div>
    </Shell>
  );
}
