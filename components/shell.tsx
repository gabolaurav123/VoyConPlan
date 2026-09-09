'use client';
import {
  ArrowUpRight,
  Globe,
  LogIn,
  ShieldCheck,
  LoaderCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/toast';
import { toast } from '@/lib/toast';
import { usePathname } from 'next/navigation';
import BrandLogo from './brand-logo';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
export async function api(
  path: string,
  method = 'GET',
  data?: unknown,
): Promise<any> {
  if (
    path === 'trips' &&
    method === 'POST' &&
    data &&
    typeof data === 'object' &&
    !('requestId' in data)
  )
    data = { ...data, requestId: crypto.randomUUID() };
  const r = await fetch('/api/' + path, {
    method,
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  const value: any = await r.json();
  if (!r.ok)
    throw new Error(
      value.error || value.message || 'No se pudo completar la solicitud.',
    );
  return value;
}
export async function logout(returnTo = '/') {
  try {
    await api('auth/logout', 'POST', {});
    location.assign('/entrar?return_to=' + encodeURIComponent(returnTo));
  } catch (e) {
    notify(e);
  }
}
export function notify(error: unknown) {
  toast.error(
    error instanceof Error
      ? error.message
      : 'No se pudo completar la operación.',
  );
}
export function Loading() {
  return (
    <div className="loading-state">
      <LoaderCircle className="spin" size={25} />
      <p>Cargando tu plan…</p>
    </div>
  );
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="app-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description || 'Organiza los detalles a tu manera.'}
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function SignIn({ returnTo = '/viajes' }: { returnTo?: string }) {
  return (
    <div className="empty-state">
      <LogIn size={34} />
      <h2>Tu plan, siempre contigo.</h2>
      <p>
        Inicia sesión para guardar, compartir y recuperar tus viajes desde
        cualquier dispositivo.
      </p>
      <a
        className="btn lime"
        target="_top"
        href={'/entrar?return_to=' + encodeURIComponent(returnTo)}
      >
        Entrar a mi cuenta <ArrowUpRight size={17} />
      </a>
      <a href="/">Seguir explorando</a>
    </div>
  );
}
export function track(name: string) {
  try {
    if (localStorage.getItem('vcp-consent') !== 'analytics') return;
    let s = sessionStorage.getItem('vcp-session');
    if (!s) {
      s = crypto.randomUUID();
      sessionStorage.setItem('vcp-session', s);
    }
    void api('events', 'POST', { name, sessionId: s, consent: true }).catch(
      () => {},
    );
  } catch {}
}
export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [consent, setConsent] = useState(false),
    [offline, setOffline] = useState(false);
  useEffect(() => {
    try {
      setConsent(!localStorage.getItem('vcp-consent'));
    } catch {
      setConsent(true);
    }
    const update = () => setOffline(!navigator.onLine);
    update();
    addEventListener('online', update);
    addEventListener('offline', update);
    if ('serviceWorker' in navigator)
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    return () => {
      removeEventListener('online', update);
      removeEventListener('offline', update);
    };
  }, []);
  function choose(v: string) {
    try {
      localStorage.setItem('vcp-consent', v);
    } catch {
      /* Session-only choice when browser storage is unavailable. */
    }
    setConsent(false);
    if (v === 'analytics') track('landing_view');
  }
  return (
    <>
      <header className="topbar">
        <a className="brand" href="/">
          <BrandLogo />
        </a>
        <nav>
          {[
            ['/', 'Explorar'],
            ['/viajes', 'Mis viajes'],
            ['/favoritos', 'Algún día'],
            ['/planes', 'Planes'],
          ].map(([href, label]) => (
            <a key={href} className={path === href ? 'active' : ''} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <a className="btn small" href="/cuenta">
          Mi cuenta <ArrowUpRight size={16} />
        </a>
      </header>
      {offline && (
        <div className="notice warning">
          Sin conexión. Los cambios y consultas requieren internet. Puedes abrir
          la copia de viaje que hayas descargado.
        </div>
      )}
      <main className="page">
        {children}
        <footer>
          <a className="brand" href="/">
            <BrandLogo />
          </a>
          <span>Tu viaje, con plan.</span>
          <a href="/blog">Guías</a>
          <a href="/soporte">Ayuda</a>
          <a href="/privacidad">Privacidad</a>
          <a href="/terminos">Términos</a>
          <a href="/admin">
            <ShieldCheck size={16} />
            <span className="sr-only">Administración</span>
          </a>
        </footer>
      </main>
      {consent && (
        <div className="consent">
          <div>
            <b>Tú eliges qué compartes.</b>
            <p>
              Usamos almacenamiento necesario para tus preferencias. La
              analítica es opcional; no usamos rastreadores publicitarios.
            </p>
          </div>
          <button
            className="btn outline small"
            onClick={() => choose('necessary')}
          >
            Solo necesarias
          </button>
          <button className="btn small" onClick={() => choose('analytics')}>
            Aceptar analítica
          </button>
        </div>
      )}
      <Toaster />
    </>
  );
}
