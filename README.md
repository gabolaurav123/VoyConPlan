# VoyConPlan

Planificador de viajes con descubrimiento DEMO, itinerarios, gastos, checklist, enlaces y administración.
Esta rama está adaptada a Seenode: Node 24, Vinext y SQLite durable. La instalación anterior de Sites se conserva en el historial y en su alojamiento independiente.

## Arranque local

Requiere Node 24 y npm.

1. Ejecuta npm ci.
2. Copia .env.example a .env.local.
3. Configura APP_ORIGIN=http://localhost:3000. Deja DATABASE_PATH vacío para usar work/local-voyconplan.sqlite, o indica una ruta absoluta.
4. Genera ADMIN_SETUP_TOKEN con 32 bytes aleatorios codificados base64url y guárdalo únicamente en .env.local. ADMIN_EMAILS indica el correo reservado para el primer administrador.
5. Ejecuta npm run dev. El arranque aplica las migraciones.
6. Abre http://localhost:3000/configurar-admin y activa el administrador con ese token y una contraseña elegida por ti.
7. El resto de las cuentas se registra en /crear-cuenta y entra por /entrar.

Las sesiones son revocables y se guardan mediante hash en la base de datos. No se aceptan cabeceras de identidad de terceros. Un visitante no puede obtener privilegios escribiendo el correo administrativo.

## Seenode

Consulta docs/DESPLIEGUE-SEENODE.md y seenode.json para la configuración preparada.
Node 24; build npm ci --include=dev && npm run build; start npm start; puerto 3000; una réplica.
Se requiere un volumen persistente de 5 GB en /data y DATABASE_PATH=/data/voyconplan.sqlite. La base no debe quedar en disco efímero.
APP_ORIGIN debe ser el origen HTTPS exacto del servicio. VINEXT_TRUSTED_HOSTS debe contener su hostname exacto. Marcar ADMIN_SETUP_TOKEN como secreto.

## Desarrollo y pruebas

npm test ejecuta 32 pruebas de dominio, SQLite y autenticación.
npx tsc --noEmit valida TypeScript.
npm run build genera el cliente y servidor Node de producción.
Las pruebas sqlite y auth usan bases temporales y nunca deben apuntar a producción.
tests/api.integration.mjs describe la antigua identidad local de Sites: es histórica y no se usa en Seenode. La nueva suite de integración verifica sesiones y aislamiento entre cuentas.
La migración inicial de 14 tablas se preserva; la migración de autenticación agrega cuentas, sesiones y límites. El arranque detecta cambios en migraciones ya aplicadas mediante checksum.

## Alcance

Los registros del usuario y las funciones de planificación persisten. Costos, cambio de moneda, tiempos de vuelo y afinidad usan un catálogo DEMO de 6 destinos. Requisitos, disponibilidad, tarifas, IA, pagos y correo no están conectados.
No existe verificación ni recuperación por email en esta entrega. El alta inicial del administrador depende de un secreto de un solo uso.
La matriz docs/ESTADO-DE-ENTREGA.md corresponde a la primera entrega en Sites; la adaptación posterior y su validación están en docs/DESPLIEGUE-SEENODE.md.
Los proveedores aún requieren implementación, además de claves. No se vende ninguna suscripción ni se generan reservas reales.

## Seguridad y operación

Los enlaces de lectura excluyen notas, PNR y gastos; se guardan como hash, caducan y pueden revocarse.
Mutaciones con origen exacto y permisos de propietario/miembro. Cuotas transaccionales, creación idempotente y edición con versión optimista.
La PWA no almacena APIs privadas. Los borradores que fallan al guardar se conservan en la sesión y pueden descargarse.
Antes del lanzamiento comercial: completar integraciones, pruebas de carga/roles, revisión de accesibilidad y deuda de lint/tipado; establecer respaldo y recuperación de la base, retención y textos legales definitivos.
Las imágenes reales tienen atribución en public/image-sources.json; las escenas editoriales generadas se identifican como tales.
