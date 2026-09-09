# VoyConPlan

Planificador de viajes con descubrimiento DEMO, itinerarios, gastos, checklist, documentos y administración. Node 24 con Vinext. La versión anterior de Sites permanece en el historial.

## Seenode: solo servicio web

Grupo **Gimnasio-del-Cerebro**, repositorio **gabolaurav123/VoyConPlan**, rama **main**.

- Runtime Node 24. Build: `npm ci --include=dev && npm run build`.
- Inicio: `npm start`. Puerto 3000, escucha 0.0.0.0.
- Web Basic. No se crea una base de datos ni un volumen.
- PostgreSQL externo mediante `DATABASE_URL`, marcada secreta.
- Origen exacto en `APP_ORIGIN` y hostname en `VINEXT_TRUSTED_HOSTS`.

Sin DATABASE_URL se puede explorar el catálogo DEMO y descargar el PDF de ejemplo. Las cuentas, el guardado y la administración necesitan conectar la base. En producción no se abre SQLite ni se guardan datos en disco efímero. Al conectar una base PostgreSQL vacía dedicada y desplegar de nuevo, el arranque aplica las migraciones.

Configuración de TLS y operación: [docs/DESPLIEGUE-SEENODE.md](docs/DESPLIEGUE-SEENODE.md). seenode.json es una referencia humana, no un manifiesto nativo.

## Identidad y PDF

Logo, icono de aplicación, portada social y cuatro escenas editoriales creados con ImageGen en public/brand. Verde bosque #173F35, lima #DBED9E y crema #F7F6EE. Los destinos conservan fotografías documentales y créditos en public/image-sources.json.

El PDF compone fotografía, resumen, presupuesto, reservas, itinerario y preparativos de manera continua. Los saltos dependen del espacio disponible. El ejemplo público usa el mismo constructor que los PDF de los viajes.

## Desarrollo local

1. Instala Node 24 y ejecuta `npm ci`.
2. Copia .env.example a .env.local.
3. Configura APP_ORIGIN=http://localhost:3000.
4. Sin PostgreSQL, usa DATABASE_PATH absoluto o deja el valor vacío para SQLite local en work/.
5. Define ADMIN_EMAILS y un ADMIN_SETUP_TOKEN aleatorio de 32 bytes en base64url, solo en el archivo local.
6. Ejecuta `npm run dev`; activa el administrador en /configurar-admin con una contraseña elegida por ti.

DATABASE_URL reemplaza el almacenamiento local en producción. Nunca subir .env, claves, bases ni datos de prueba a GitHub.

## Verificación

`npm test` ejecuta pruebas de dominio, SQLite, autenticación y PostgreSQL. `npx tsc --noEmit` verifica tipos. `npm run build` compila cliente y servidor. Los tests usan datos sintéticos; PostgreSQL se valida con PGlite. Falta comprobar TLS, red y concurrencia de conexiones con el proveedor real.

## Alcance

Costos, cambio de moneda, tiempos de vuelo y afinidad usan un catálogo DEMO de seis destinos. Disponibilidad, requisitos migratorios, clima, IA, cobros y correo no están conectados. Los proveedores requieren implementación además de claves. No se generan reservas reales.

No existe verificación ni recuperación de contraseña por email. Las sesiones se pueden revocar y el correo administrativo por sí solo no concede privilegios. Los enlaces de lectura omiten datos privados y pueden caducar o revocarse. La PWA no almacena APIs privadas.

docs/ESTADO-DE-ENTREGA.md es el registro histórico de la primera entrega en Sites.
