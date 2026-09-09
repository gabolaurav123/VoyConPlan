'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { LoaderCircle, MapPin, Plane } from 'lucide-react';

export type WorldDestination = {
  id: string;
  iata: string;
  name: string;
  airport: string;
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  latitude: number;
  longitude: number;
};

export type DestinationCatalog = {
  destinations: WorldDestination[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
  };
  facets: {
    countries: {
      code: string;
      name: string;
      count: number;
      region: string;
      regions: string[];
    }[];
    regions: { code: string; name: string; count: number }[];
  };
  source: {
    name: string;
    url: string;
    license: string;
    downloadedAt: string;
    airportCount: number;
    countryCount: number;
    coverage: string;
  };
};

export default function AirportInput({
  label,
  value,
  onChange,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (iata: string) => void;
  required?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(value);
  const [matches, setMatches] = useState<WorldDestination[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(-1);
  const picked = useRef(value);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value && picked.current !== value) {
      setText(value);
      picked.current = value;
    }
  }, [value]);

  useEffect(() => {
    if (!open || text.trim().length < 2) {
      setMatches([]);
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    setError('');
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          '/api/destinations?limit=8&q=' + encodeURIComponent(text.trim()),
          { signal: controller.signal },
        );
        if (!response.ok)
          throw new Error(
            'No pudimos buscar los aeropuertos. Puedes escribir su código de tres letras.',
          );
        const result = (await response.json()) as DestinationCatalog;
        if (!controller.signal.aborted) {
          setMatches(result.destinations);
          setActive(-1);
        }
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : 'No pudimos buscar los aeropuertos.',
          );
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, open]);

  function choose(destination: WorldDestination) {
    picked.current = destination.iata;
    setText(destination.name + ' (' + destination.iata + ')');
    onChange(destination.iata);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div
      className="airport-field"
      ref={box}
      onBlur={(event) => {
        if (!box.current?.contains(event.relatedTarget as Node)) setOpen(false);
      }}
    >
      <label htmlFor={id}>{label}</label>
      <div className="airport-input-wrap">
        <MapPin size={17} aria-hidden="true" />
        <input
          id={id}
          value={text}
          placeholder="Ciudad o aeropuerto"
          autoComplete="off"
          spellCheck={false}
          required={required}
          maxLength={120}
          role="combobox"
          aria-expanded={open && text.trim().length >= 2}
          aria-controls={id + '-options'}
          aria-autocomplete="list"
          aria-activedescendant={
            active >= 0 ? id + '-option-' + active : undefined
          }
          aria-describedby={id + '-hint'}
          onFocus={() => {
            if (!value) setOpen(true);
          }}
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            picked.current = '';
            onChange(
              /^[A-Za-z]{3}$/.test(next.trim())
                ? next.trim().toUpperCase()
                : '',
            );
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              setActive((current) =>
                matches.length
                  ? current < 0
                    ? event.key === 'ArrowDown'
                      ? 0
                      : matches.length - 1
                    : (current +
                        (event.key === 'ArrowDown' ? 1 : -1) +
                        matches.length) %
                      matches.length
                  : -1,
              );
            }
            if (
              event.key === 'Enter' &&
              open &&
              active >= 0 &&
              matches[active]
            ) {
              event.preventDefault();
              choose(matches[active]);
            }
          }}
        />
        {busy && <LoaderCircle size={15} className="spin" aria-hidden="true" />}
      </div>
      <small id={id + '-hint'}>
        {value
          ? 'Aeropuerto seleccionado: ' + value
          : 'Busca una ciudad o escribe un código como LPB.'}
      </small>
      {open && text.trim().length >= 2 && (
        <div className="airport-dropdown">
          {busy && <p role="status">Buscando aeropuertos…</p>}
          {!busy && error && <p role="status">{error}</p>}
          {!busy && !error && matches.length === 0 && (
            <p role="status">
              No encontramos ese aeropuerto. Prueba otra ciudad o país.
            </p>
          )}
          <ul
            id={id + '-options'}
            role="listbox"
            aria-label={'Aeropuertos: ' + label}
          >
            {matches.map((destination, index) => (
              <li
                key={destination.id}
                id={id + '-option-' + index}
                role="option"
                aria-selected={active === index}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  className={active === index ? 'is-active' : ''}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(destination)}
                >
                  <Plane size={17} aria-hidden="true" />
                  <span>
                    <strong>
                      {destination.name} <b>{destination.iata}</b>
                    </strong>
                    <small>
                      {destination.country} · {destination.airport}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
