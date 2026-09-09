'use client';
import { useEffect, useRef, useState } from 'react';
export default function DestinationMap({
  destinations,
  onSelect,
}: {
  destinations: any[];
  onSelect: (d: any) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let map: any,
      alive = true;
    import('leaflet')
      .then((L) => {
        if (!alive || !el.current) return;
        map = L.map(el.current, {
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
        }).setView([-9, -56], 3);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 18,
        }).addTo(map);
        const colors: Record<string, string> = {
          green: '#4c873c',
          yellow: '#aaa42e',
          orange: '#d1843c',
          red: '#af5348',
        };
        for (const d of destinations) {
          const marker = L.circleMarker([d.lat, d.lon], {
            radius: 12,
            color: '#fff',
            weight: 3,
            fillColor: colors[d.level],
            fillOpacity: 1,
          }).addTo(map);
          marker.bindTooltip(d.name + ' · ' + d.label);
          marker.on('click', () => onSelect(d));
        }
        if (destinations.length)
          map.fitBounds(
            destinations.map((d) => [d.lat, d.lon]),
            { padding: [45, 45], maxZoom: 6, animate: false },
          );
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
      map?.stop();
      map?.remove();
    };
  }, [destinations, onSelect]);
  return (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      {error && (
        <p role="alert" className="notice">
          No se pudo cargar el mapa. Puedes seguir comparando los destinos en
          tarjetas.
        </p>
      )}
      <div
        className="world-map"
        ref={el}
        aria-label="Mapa de destinos por presupuesto"
      />
      <div className="inline" aria-label="Destinos del mapa">
        {destinations.map((d) => (
          <button
            key={d.id}
            className="btn outline small"
            onClick={() => onSelect(d)}
          >
            {d.name} · {d.label}
          </button>
        ))}
      </div>
      <div className="map-legend">
        <span>
          <i className="status-dot green" /> Con margen
        </span>
        <span>
          <i className="status-dot yellow" /> Posible
        </span>
        <span>
          <i className="status-dot orange" /> Ajustado
        </span>
        <span>
          <i className="status-dot red" /> Fuera del presupuesto
        </span>
      </div>
    </>
  );
}
