# Catálogo de destinos

Fuente primaria: [OurAirports — Open data](https://ourairports.com/data/).
Diccionario: https://ourairports.com/help/data-dictionary.html.
Licencia de los datos: **dominio público**, según la página de descargas de OurAirports.

`destinations.json` es una instantánea local de `airports.csv` y `countries.csv`.
El bloque `source` conserva fecha de descarga, URL, fecha HTTP de modificación y
SHA-256 de cada archivo de origen. OurAirports actualiza sus archivos cada noche;
esta aplicación sirve su instantánea incluida en el despliegue, sin atribuirle
actualización continua. No necesita base de datos.

Se incluyen registros con IATA de tres letras, `scheduled_service=yes` y tipo
`large_airport`, `medium_airport`, `small_airport` o `seaplane_base`. Las coordenadas
corresponden al aeropuerto; `name` es el municipio servido que indica la fuente
(o el aeropuerto cuando falta). Un municipio puede tener varios aeropuertos.
Los países y territorios se traducen al español con `Intl.DisplayNames` de Node.
Las regiones de exploración son continentes de OurAirports; `NA` incluye
Norteamérica, Centroamérica y el Caribe. Los países transcontinentales conservan
la región principal del país en `facets.countries[].region`; el campo `regions`
enumera todas las regiones con aeropuertos de ese país para los filtros. Cada
resultado conserva la región del aeropuerto. Los datos comunitarios pueden estar
incompletos o contener errores.

El catálogo no incluye precios, disponibilidad, aerolíneas ni garantía de rutas
comerciales actuales. Una coincidencia geográfica no equivale a una oferta de
viaje. Las cotizaciones corresponden al proveedor de viajes configurado.

## Actualización manual

Desde la raíz: `node scripts/update-destinations.mjs`.
El script descarga únicamente los dos CSV públicos, valida formato, cobertura,
IATA duplicados y coordenadas, y escribe el JSON. No instala tareas programadas.
Después, ejecutar `node --experimental-strip-types --test tests/destinations.test.mjs`,
revisar el cambio del catálogo y desplegar la nueva versión.

## API

`GET /api/destinations?q=la+paz&country=BO&region=SA&page=1&limit=24`

- `q`: hasta 100 caracteres y 12 palabras; busca municipio, aeropuerto, IATA, país
  y palabras clave de la fuente, sin distinguir mayúsculas ni acentos latinos.
- `country`: código de dos letras de un país/territorio incluido.
- `region`: `AF`, `AN`, `AS`, `EU`, `NA`, `OC` o `SA`.
- `page`: entero 1–10000; `limit`: entero 1–60 (24 por defecto).
- Las respuestas incluyen `destinations`, `pagination`, `facets` globales y `source`.
- Las búsquedas IATA exactas aparecen primero. Parámetros inválidos reciben 400.
- No se consulta una base de datos ni un proveedor de tarifas en esta ruta.
