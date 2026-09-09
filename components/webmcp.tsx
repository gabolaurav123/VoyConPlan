'use client';
import { useEffect, useRef, useLayoutEffect } from 'react';
import { flushSync } from 'react-dom';
import { defaultSearch, validateSearch } from '@/lib/domain';
import { api } from './shell';
export default function WebTools({
  onResults,
  results,
}: {
  onResults: (s: any, r: any[]) => void;
  results: any[];
}) {
  const current = useRef({ onResults, results });
  useLayoutEffect(() => {
    current.current = { onResults, results };
  }, [onResults, results]);
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: any) => {
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    };
    register({
      name: 'discover_destinations',
      title: 'Descubrir destinos por presupuesto',
      description:
        'Calcula costos DEMO de viaje completo y actualiza el formulario y los resultados visibles. No consulta tarifas, clima o requisitos reales. No guarda viajes.',
      inputSchema: {
        type: 'object',
        properties: {
          budget: { type: 'number', minimum: 50, maximum: 1000000 },
          currency: { type: 'string', enum: ['USD', 'BOB', 'EUR'] },
          travelers: { type: 'integer', minimum: 1, maximum: 12 },
          days: { type: 'integer', minimum: 1, maximum: 30 },
          origin: { type: 'string' },
          interests: { type: 'array', items: { type: 'string' } },
        },
        required: ['budget'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input: any) => {
        if (
          !input ||
          typeof input !== 'object' ||
          Object.keys(input).some(
            (k) =>
              ![
                'budget',
                'currency',
                'travelers',
                'days',
                'origin',
                'interests',
              ].includes(k),
          )
        )
          throw new Error('Entrada inválida.');
        const s = validateSearch({ ...defaultSearch, ...input });
        const r = await api('discover', 'POST', s);
        flushSync(() => current.current.onResults(s, r.results));
        return {
          mode: 'demo',
          count: r.results.length,
          results: r.results.map((d: any) => ({
            id: d.id,
            name: d.name,
            total: d.real,
            currency: s.currency,
            score: d.score,
            requirements: 'unknown',
          })),
        };
      },
    });
    register({
      name: 'read_discovery_results',
      title: 'Leer destinos visibles',
      description:
        'Lee los resultados DEMO de la búsqueda visible, sin modificar el viaje.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: () => ({
        results: current.current.results.map((d) => ({
          id: d.id,
          name: d.name,
          total: d.real,
          score: d.score,
          level: d.level,
          requirements: 'unknown',
        })),
      }),
    });
    return () => lifecycle.abort();
  }, []);
  return null;
}
