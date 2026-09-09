# VoyConPlan — contratos de proveedores

Recomendación de diseño. Las firmas se implementan en servidor; una interfaz TypeScript no equivale a integración conectada. No fijar nombres comerciales más allá de los solicitados sin confirmar cobertura, términos, credenciales y precios reales.

## Sobre común de resultados

```ts
type DataOrigin = 'live' | 'official_editorial' | 'user_entered' | 'demo';
type Freshness = 'fresh' | 'stale' | 'unknown';
type Source = {
  provider: string;
  externalId?: string;
  url?: string;
  fetchedAt: string | null;
  expiresAt: string | null;
  origin: DataOrigin;
  freshness: Freshness;
};
type Money = { amountMinor: number; currency: string };
type ProviderErrorCode = 'NOT_CONFIGURED' | 'UNSUPPORTED' | 'NO_RESULTS'
  | 'RATE_LIMITED' | 'TIMEOUT' | 'UNAVAILABLE' | 'INVALID_RESPONSE';
type ProviderResult<T> =
  | { ok: true; data: T; sources: Source[]; warnings: string[];
      requestId: string; isEstimate: boolean }
  | { ok: false; code: ProviderErrorCode; message: string;
      retryable: boolean; retryAfterSeconds?: number; requestId: string };
type ProviderContext = {
  locale: string; requestId: string; signal: AbortSignal;
  idempotencyKey?: string;
};
```

Validar esquemas de entrada y salida en runtime. La respuesta común evita convertir fallos en arrays vacíos silenciosos. `NO_RESULTS` se diferencia de caída de proveedor. Precios, horarios y requisitos tienen además procedencia por ítem cuando difiere dentro de la misma respuesta. `fetchedAt: null` no se reemplaza con la hora de abrir la pantalla.

## Contratos por dominio

| Provider | Entrada mínima | Salida y restricciones |
|---|---|---|
| FlightSearchProvider | tramos, aeropuertos IATA, fechas, viajeros por rango, clase, equipaje/filtros | ofertas con segmentos, instantes/timezones, aerolínea, desglose, equipaje, moneda, vencimiento y deep link; adaptadores Duffel/Amadeus preparados sin scraping |
| AccommodationProvider | destino/coordenadas, check-in/out, habitaciones, ocupación y filtros | establecimientos/ID real, noches, impuestos/cargos, habitación, cancelación, precio total y enlace; disponibilidad solo de proveedor |
| PlacesProvider | área/consulta, categorías, idioma, fechas | ID, nombre, coordenadas, dirección, ratings y conteo, horario regular/excepcional, fotos con atribución; no inventar restaurante |
| RoutesProvider | puntos ordenados, modo, fecha/hora local | geometría, metros, duración, legs, restricciones y fuente; geografía recta no se rotula ruta real |
| ActivityProvider | lugar/fechas/intereses/edades aproximadas | experiencia con duración, reservas, inclusiones, precio y disponibilidad; afiliación separada del ranking |
| TravelRequirementsProvider | país pasaporte, residencia, origen, todos los tránsitos/destinos, fechas/duración, propósito, rangos familiares relevantes | reglas con severidad, aplicabilidad, estado, fuente, fecha, enlaces oficiales, acciones; sin dato = desconocido, nunca exento |
| CurrencyProvider | moneda base, cotizadas, fecha | tasa por par y dirección, timestamp, precisión; restricción de antigüedad y política de redondeo |
| WeatherProvider | coordenadas, fechas | `forecast` o `historical_average`, periodo, timezone, probabilidad/unidad y procedencia; fuera de horizonte no fabricar pronóstico |
| AIProvider | tarea/prompt versionado, referencias verificadas, preferencias y restricciones | JSON validado con IDs de entidades existentes, explicación y advertencias; rechazar lugares o hechos no presentes en entrada |
| BillingProvider | usuario autenticado, plan/variante del servidor, cupón validado, retorno permitido | checkout/portal; consulta/gestión de suscripción; webhook verificado normalizado; nunca aceptar precio ni usuario facturable del cliente |
| AffiliateProvider | recurso verificado, contexto y consentimiento aplicable | URL permitida, disclosure, click ID; conversión separada si existe callback real |
| NotificationProvider | destinatario autorizado, categoría, plantilla, idioma, datos mínimos, clave idempotente | ID del proveedor, accepted/sent/delivered/bounced según evidencia; bajas y supresiones antes de marketing |
| ImageGenerationProvider | prompt aprobado, estilo versionado, formato/dimensiones y categoría | archivo/URL temporal, modelo, fecha, costo, procedencia generada, estado de revisión; no publicar contenido delicado automáticamente |
| AnalyticsProvider | evento permitido, consentimiento, ID seudónimo, datos minimizados | aceptación y almacenamiento; no capturar pasaporte, código de reserva, texto libre sensible ni IP completa para marketing |

## TravelRequirementsProvider en detalle

```ts
type RequirementItem = {
  id: string;
  category: 'visa' | 'passport' | 'transit' | 'health' | 'entry'
    | 'minor_documents' | 'customs' | 'driving' | 'other';
  severity: 'critical' | 'important' | 'informational';
  applicability: 'required' | 'not_required' | 'conditional' | 'unknown';
  title: string;
  essentialAction: string;
  detailedGuidance?: string;
  conditions: string[];
  sources: Source[];
};
```

El filtrado por plan siempre conserva `critical` con título, aplicabilidad, acción esencial y fuentes. Las reglas esenciales también incluyen incertidumbre y verificación de visa/pasaporte/tránsito. Si el proveedor no puede determinar un caso, devolver la carencia explícita y un enlace oficial revisado, sin simular consulta automática. La IA puede explicar una regla recibida; nunca decidir que un país no exige visa por memoria del modelo.

## Política de adaptadores

- Registro backend por capacidad, cobertura y estado; selección/fallback explícitos. Si falla uno, la UI conoce cuál contestó o si no hay resultado.
- Las credenciales se leen del entorno privado. Guardar en DB configuración no secreta y estado; usar validación estricta de URLs para evitar SSRF y redirecciones a destinos arbitrarios.
- Caché por entrada normalizada, proveedor, idioma, moneda, fechas y contexto relevante; pasaporte/residencia/tránsito cambian la clave de requisitos. Nunca compartir respuestas privadas por una clave pública.
- TTL según contrato y dinamismo. Un fallback a caché vencida queda marcado `stale`; evitarlo para decisiones de admisión o reserva sin advertencia clara.
- Presupuesto de llamadas, timeout, reintentos limitados con backoff y circuit breaker. No reintentar automáticamente mutaciones externas sin garantías de idempotencia.
- Los mocks existen para pruebas; los adaptadores DEMO permanecen identificados y deshabilitados como fuente de hechos en producción.
- La salud combina última consulta, latencia, tasa de error y configuración. Clave presente significa configurado, no necesariamente saludable.

## Variables y disponibilidad

Separar `DB`, auth, IA, flights, accommodation, places/routes, requirements, weather, currency, billing, email, images, storage y analytics. Un `.env.example` contiene nombres y valores vacíos/documentales; nunca secrets. La documentación de despliegue debe nombrar cada binding realmente creado, programador realmente registrado y webhook realmente configurado.

Para cada adaptador mantener una ficha: proveedor elegido, capacidades implementadas, países/cobertura, credenciales requeridas, modo test/live, política de caché, costo, prueba ejecutada y limitaciones. Si la ficha carece de evidencia de llamada real, el estado correcto es preparado o no conectado.
