# Tarifas de vuelos y ofertas

La portada de `/ofertas` muestra **Ofertas publicadas** dentro de VoyConPlan,
con filtros por ciudad y aerolínea y condiciones desplegables. La consulta por
fechas está en **Vuelos para mis fechas**. Los enlaces externos quedan como
referencia secundaria de cada publicación.

## Ofertas publicadas, sin credenciales

`GET /api/travel/promotions` lee un conjunto fijo de páginas públicas de Avianca:
Bogotá–La Paz, Bogotá–Santa Cruz, Cali–La Paz y Medellín–La Paz. El parser verifica
el encabezado de la ruta, sus códigos, el precio en efectivo y el tipo de viaje.
Son mínimos publicados en COP, mercado Colombia; no constituyen cotizaciones
para las fechas o el grupo de una búsqueda. La cobertura se limita a esas fuentes.

Cada tarjeta muestra precio original, ruta, viaje de ida y vuelta, fuente y fecha
de revisión. No se atribuyen al precio fechas de calendarios ni datos de millas.
Fechas, cabina y tasas quedan nulas si no constan en el encabezado. SRZ conserva
el significado de ciudad usado por la fuente; no se convierte en VVI.

La lectura se reutiliza durante una hora como máximo, con dos consultas simultáneas,
siete segundos de espera y 500 KB por fuente. Una fuente que falla o cambia no
aporta ofertas anteriores. Los reintentos por fallo esperan diez minutos. Las
solicitudes concurrentes comparten la misma revisión. Avianca declara actualización
de sus tarifas cada 24 horas: releer la página no garantiza inventario nuevo.

BoA y LATAM no se incluyeron porque sus páginas devolvieron controles de acceso
automatizado. No se integraron mediante redirecciones, iframes o consultas a
servicios internos. Ningún precio fijo de prueba se usa como respaldo de producción.

## Cotizaciones para fechas concretas

La búsqueda de `/ofertas` está conectada al adaptador de **Duffel Flights v2**. Permite consultar ida o ida y vuelta para 1–9 adultos, con origen y destino IATA, fechas, cabina y un máximo de conexiones. No crea reservas, billetes, pagos ni cuentas externas. No necesita PostgreSQL para funcionar.

**Sin una conexión activada devuelve ofertas vacías y un estado explícito.** El catálogo de destinos y los presupuestos DEMO de itinerarios son contenidos separados: no acreditan rutas disponibles, tarifas de avión ni descuentos.

## Activación en Seenode

Guarda estas variables en el entorno del servicio web y vuelve a desplegarlo:

```dotenv
TRAVEL_SEARCH_ENABLED=false
DUFFEL_ACCESS_TOKEN=
DUFFEL_MODE=live
TRAVEL_SEARCH_DAILY_LIMIT=100
```

`DUFFEL_ACCESS_TOKEN` debe ser una variable secreta. Cuando la cuenta y el token estén listos, cambia `TRAVEL_SEARCH_ENABLED=true`. Nunca uses un prefijo `NEXT_PUBLIC_`, incluyas el token en el repositorio o lo copies al navegador. `APP_ORIGIN` debe coincidir exactamente con la URL HTTPS pública, sin barra final.

Para probar con datos simulados, utiliza un token de test de Duffel y `DUFFEL_MODE=test`. La aplicación comprueba el modo de cada respuesta y nunca muestra esos resultados como tarifas reales. Los tokens de test empiezan por `duffel_test_`; sus precios y horarios pueden ser irreales. [Documentación oficial de modo de prueba](https://duffel.com/docs/api/overview/test-mode).

Una cuenta activa de Duffel y un token **live** son necesarios para datos reales. El token debe permitir crear solicitudes de ofertas, porque la búsqueda usa un POST. Configurar sólo una base de datos no habilita este proveedor. [Puesta en marcha de Duffel](https://duffel.com/guides/getting-started), [autenticación y versiones](https://duffel.com/docs/api/overview/making-requests).

El coste del proveedor es independiente del hosting. Duffel publica un cargo de búsqueda excedente de 0,005 USD cuando se supera su proporción de 1500 búsquedas por reserva. Esta aplicación sólo consulta; hay que revisar las condiciones de la cuenta antes de activar tráfico público. No se contrató ni activó una cuenta de Duffel durante el desarrollo. [Precios oficiales consultados el 9 de septiembre de 2026](https://duffel.com/pricing).

## Contrato HTTP

`GET /api/travel/status` responde 200 con `provider`, `available`, `mode`, `message`, `cacheSeconds`, `coverage` y `bookingAvailable:false`. `available` indica que hay configuración válida local; esta lectura no gasta una consulta ni comprueba que Duffel acepte el token o tenga una ruta concreta.

El listado de proveedores en bootstrap y administración utiliza esa misma configuración y distingue «Configurado para consultas», «Modo de prueba» y «No conectado». Conserva `lastCheck:null` y `verification:'not_checked'`, porque listar proveedores no hace una consulta de red. La métrica numérica heredada `providersConnected` es un alias de `providersConfigured`, con `providersConnectedMeaning:'configured_not_verified'`. Los otros proveedores externos siguen siendo interfaces o adaptadores pendientes de implementación; añadir sus claves al entorno no los conecta. Los eventos propios con consentimiento son una función interna separada.

`POST /api/travel/search` requiere `Content-Type: application/json` y un encabezado `Origin` igual a `APP_ORIGIN`:

```json
{
  "origin": "LPB",
  "destination": "MAD",
  "departureDate": "2026-10-10",
  "returnDate": "2026-10-20",
  "adults": 2,
  "cabinClass": "economy",
  "maxConnections": 1
}
```

Las fechas se validan entre el día UTC actual y los próximos 330 días. El regreso es opcional y no puede ser anterior a la ida. Se admiten `economy`, `premium_economy`, `business`, `first` y 0–2 conexiones. La validación IATA admite aeropuertos y códigos metropolitanos; el proveedor determina si la ruta existe.

Un resultado válido contiene `provider:'Duffel'`, `mode:'live'|'test'`, `dataKind:'live'|'simulated'`, `consultedAt`, `expiresAt`, `cached`, `query`, `offers` y `message`. `expiresAt` es nulo cuando no hay ofertas. Cada oferta contiene:

- `id`, `provider`, `mode` y `dataKind`.
- `price:{amount,currency,totalPassengers}`: importe decimal original y moneda devuelta, para todos los adultos de la consulta.
- `consultedAt` y `expiresAt`, sin renovar la fecha al servir caché.
- `carrierName` y `operatingCarriers`, más cada tramo en `slices[].segments[]` con aeropuertos, horarios locales, operadora, número de vuelo y duración si está disponible.
- `availability:'subject_to_confirmation'` y `bookingAvailable:false`.

No se inventan precios anteriores, descuentos, conversiones de moneda, equipaje incluido ni enlaces de compra. Las compañías operadoras se muestran de forma destacada al presentar el resultado. Se consulta el endpoint de solicitudes de ofertas y se conserva el precio total que devuelve. [Contrato oficial de solicitudes](https://duffel.com/docs/api/v2/offer-requests).

Se devuelven como máximo 30 ofertas, agrupadas por moneda y ordenadas por importe dentro de cada moneda. El resultado no garantiza ser el más barato del mercado. La cobertura depende del proveedor, las aerolíneas y las fechas: no equivale a “todos los destinos con vuelos disponibles”. Los extras y cargos por pago pueden modificar el total final; la oferta puede cambiar antes de reservar y debe revalidarse en un futuro flujo de compra. [Vigencia y contenido de una oferta](https://duffel.com/docs/api/v2/offers).

Los errores contienen `code`, `error`, `message`, `offers:[]`, `provider` y `mode`. Estados: 400 búsqueda inválida, 403 origen inválido, 413 cuerpo excesivo, 415 formato inválido, 429 límite local, 502 respuesta/fallo del proveedor, 503 conexión no activada o no disponible y 504 timeout. Los errores internos del proveedor y las credenciales nunca se reenvían.

## Actualización y límites

Cada búsqueda nueva consulta el proveedor. Solicitudes iguales comparten la respuesta durante **90 segundos como máximo**; el plazo se acorta a 15 segundos antes de que caduque la primera oferta. Una consulta de nuevo después del plazo actualiza los precios. No hay un cron que consulte todas las rutas ni búsquedas en segundo plano sin interacción.

La memoria del proceso acota la caché a 200 búsquedas y las consultas simultáneas a 3. Hay un máximo de 20 consultas al proveedor por minuto y un máximo diario configurable (100 por defecto, rango permitido 1–2000). Leer la caché no consume esos límites. Las cabeceras IP del cliente no eluden los topes globales.

Estos límites son **por proceso, se reinician al reiniciar el servicio y no sustituyen un límite de gasto del proveedor**. Para varias réplicas o uso intensivo conviene un contador compartido y protección de abuso adicional. La implementación actual prioriza un servicio web único, sin crear bases de datos o volúmenes.

El servidor sólo llama a `https://api.duffel.com`, no admite una URL remota del cliente y rechaza redirecciones. El timeout es de 12 s y el proveedor dispone de 8 s para responder con las aerolíneas que hayan completado su búsqueda. Los cuerpos de entrada se limitan a 4 KiB y la respuesta remota a 8 MiB. No se devuelven registros de pasajeros, `client_key`, tokens ni cuerpos brutos.

## Verificación

```sh
node --experimental-strip-types --test tests/travel.test.mjs
```

Las pruebas usan un transporte simulado y cubren validación, origen, separación live/test, normalización y exclusión de datos privados, ida y vuelta, códigos metropolitanos, ofertas vencidas o inválidas, caché, concurrencia, límites, timeout y errores sin filtración de secretos. No se realizaron consultas pagadas ni una validación con una cuenta Duffel real. La prueba final con credenciales sigue pendiente hasta activar el proveedor.
