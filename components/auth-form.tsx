'use client';
import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  LockKeyhole,
  Route,
  ShieldCheck,
} from 'lucide-react';

type Mode = 'login' | 'register' | 'setup';
export function AuthForm({ mode }: { mode: Mode }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [setupAvailable, setSetupAvailable] = useState<boolean | null>(null);
  const [returnTo, setReturnTo] = useState('/viajes');
  const create = mode !== 'login';
  useEffect(() => {
    setReturnTo(
      new URLSearchParams(window.location.search).get('return_to') || '/viajes',
    );
    if (mode === 'setup') {
      fetch('/api/auth/status', { cache: 'no-store' })
        .then(async (response) => {
          if (!response.ok)
            throw new Error('No se pudo consultar la configuración.');
          const value = await response.json();
          setSetupAvailable(value.setupAvailable === true);
        })
        .catch(() =>
          setError(
            'No se pudo comprobar la configuración. Recarga esta página.',
          ),
        );
    }
  }, [mode]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const password = String(fields.get('password') || '');
    if (create && password !== fields.get('passwordConfirm')) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/' + mode, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: fields.get('email'),
          password,
          ...(create ? { name: fields.get('name') } : {}),
          ...(mode === 'setup' ? { token: fields.get('token') } : {}),
          returnTo,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || 'No se pudo completar la solicitud.');
      form.reset();
      // Destination is validated by the server and checked again before navigation.
      const destination = String(result.returnTo || '/viajes');
      window.location.assign(
        destination.startsWith('/') &&
          !destination.startsWith('//') &&
          !destination.includes('\\')
          ? destination
          : '/viajes',
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo conectar. Intenta de nuevo.',
      );
      setBusy(false);
    }
  }
  const title =
    mode === 'setup'
      ? 'Configura tu administración'
      : create
        ? 'Tu próximo viaje empieza aquí'
        : 'Tu plan te está esperando';
  return (
    <main
      className="page"
      style={{
        minHeight: '100vh',
        background: '#f3f6ef',
        padding: '28px 20px',
      }}
    >
      <a
        href="/"
        className="brand"
        style={{
          display: 'inline-flex',
          gap: 9,
          alignItems: 'center',
          color: '#132b2c',
          textDecoration: 'none',
        }}
      >
        <Route size={26} /> VoyConPlan
      </a>
      <section
        className="panel"
        style={{
          width: '100%',
          maxWidth: 500,
          margin: '38px auto',
          padding: 'clamp(22px, 5vw, 40px)',
        }}
      >
        <div style={{ color: '#526943', marginBottom: 18 }}>
          {mode === 'setup' ? (
            <ShieldCheck size={32} />
          ) : (
            <LockKeyhole size={30} />
          )}
        </div>
        <p className="eyebrow">
          {mode === 'setup' ? 'ACCESO DEL PROPIETARIO' : 'TODO LISTO PARA IR'}
        </p>
        <h1
          style={{
            fontSize: 'clamp(29px, 5vw, 37px)',
            lineHeight: 1.1,
            margin: '12px 0 18px',
            letterSpacing: '-1.1px',
          }}
        >
          {title}
        </h1>
        <p style={{ color: '#63736d', marginBottom: 25 }}>
          {mode === 'setup'
            ? 'Usa la clave de configuración y el correo autorizado. Elige una contraseña que sólo tú conozcas.'
            : create
              ? 'Guarda tus itinerarios, organiza tus gastos y viaja con un plan.'
              : 'Entra con el correo y la contraseña de tu cuenta VoyConPlan.'}
        </p>
        {mode === 'setup' && setupAvailable === false ? (
          <div role="status" className="notice">
            La configuración inicial ya está completa o aún no está habilitada.{' '}
            <a href="/entrar">Ir a iniciar sesión</a>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'grid', gap: 17 }}>
            {create && (
              <label style={{ display: 'grid', gap: 7 }}>
                Tu nombre
                <input
                  className="input"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </label>
            )}
            <label style={{ display: 'grid', gap: 7 }}>
              Correo electrónico
              <input
                className="input"
                name="email"
                type="email"
                autoComplete="username"
                required
                maxLength={254}
                inputMode="email"
              />
            </label>
            {mode === 'setup' && (
              <label style={{ display: 'grid', gap: 7 }}>
                Clave de configuración
                <input
                  className="input"
                  name="token"
                  type="password"
                  autoComplete="off"
                  required
                  minLength={43}
                  maxLength={512}
                  spellCheck={false}
                />
                <small style={{ color: '#63736d' }}>
                  La clave de un solo uso está en la configuración privada del
                  despliegue.
                </small>
              </label>
            )}
            <label style={{ display: 'grid', gap: 7 }}>
              Contraseña
              <input
                className="input"
                name="password"
                type="password"
                autoComplete={create ? 'new-password' : 'current-password'}
                required
                minLength={create ? 12 : 1}
                maxLength={128}
              />
              {create && (
                <small style={{ color: '#63736d' }}>
                  Entre 12 y 128 caracteres. Puedes usar una frase larga.
                </small>
              )}
            </label>
            {create && (
              <label style={{ display: 'grid', gap: 7 }}>
                Repite la contraseña
                <input
                  className="input"
                  name="passwordConfirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                />
              </label>
            )}
            {error && (
              <p
                role="alert"
                style={{
                  color: '#a13725',
                  background: '#fff1ec',
                  borderRadius: 9,
                  padding: 13,
                  margin: 0,
                }}
              >
                {error}
              </p>
            )}
            <button
              className="btn lime"
              type="submit"
              disabled={busy || (mode === 'setup' && setupAvailable !== true)}
              style={{ width: '100%', justifyContent: 'center', minHeight: 48 }}
            >
              {busy
                ? 'Guardando acceso…'
                : mode === 'setup'
                  ? 'Crear cuenta administradora'
                  : create
                    ? 'Crear mi cuenta'
                    : 'Iniciar sesión'}
              <ArrowRight size={18} />
            </button>
            {create && (
              <small style={{ color: '#63736d', lineHeight: 1.6 }}>
                Tu correo quedará sin verificar. Por ahora no hay recuperación
                de contraseña por correo; guarda tu contraseña en un lugar
                seguro.
              </small>
            )}
          </form>
        )}
        {mode !== 'setup' && (
          <p style={{ marginTop: 24, textAlign: 'center' }}>
            {create ? '¿Ya tienes cuenta? ' : '¿Primera vez por aquí? '}
            <a
              style={{ fontWeight: 700 }}
              href={
                (create ? '/entrar' : '/crear-cuenta') +
                '?return_to=' +
                encodeURIComponent(returnTo)
              }
            >
              {create ? 'Iniciar sesión' : 'Crear una cuenta'}
            </a>
          </p>
        )}
        <a
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 22,
            fontSize: 14,
          }}
        >
          <ArrowLeft size={15} /> Seguir explorando
        </a>
      </section>
    </main>
  );
}
