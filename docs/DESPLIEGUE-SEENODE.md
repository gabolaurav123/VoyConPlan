# Despliegue web en Seenode

Destino solicitado: grupo Gimnasio-del-Cerebro, repositorio gabolaurav123/VoyConPlan, rama main.
Servicio web creado: 974919. Dominio asignado: https://voyconplan.seenode.app.
Panel: https://seenode.com/dashboard/applications/web?applicationId=974919.
Se despliega únicamente el servicio web. No crear base de datos ni volumen en Seenode.
El usuario conectará una base PostgreSQL externa mediante variables de entorno.

## Servicio

- Runtime: Node 24.
- Build: npm ci --include=dev && npm run build.
- Start: npm start (migra PostgreSQL cuando DATABASE_URL existe y arranca el servidor).
- Puerto: 3000, dirección 0.0.0.0.
- Réplicas iniciales: 1. Sin volumen ni escritura de datos en disco local de producción.
- Healthcheck de disponibilidad web: /api/health.
- Diagnóstico de base de datos: /api/health?database=1.

Sin DATABASE_URL el arranque deja constancia del modo DEMO. La portada, catálogo y descubrimiento funcionan con datos locales DEMO; el alta de cuentas, inicio de sesión, guardado, enlaces privados y administración responden 503 con una explicación. El healthcheck web indica database:not_configured; la comprobación explícita de DB devuelve503. No se crea ningún archivo SQLite en producción, aunque DATABASE_PATH esté establecido.

## Variables

NODE_ENV=production
APP_ORIGIN=https://voyconplan.seenode.app
VINEXT_TRUSTED_HOSTS=voyconplan.seenode.app
ADMIN_EMAILS=gabolaurav@gmail.com
ADMIN_SETUP_TOKEN=token aleatorio de32bytes base64url, secreto
DATABASE_URL=postgresql://usuario:contraseña@host:puerto/base
DATABASE_SSL_MODE=verify-full
DATABASE_POOL_MAX=5
DATABASE_SSL_CA=certificado CA PEM opcional del proveedor

DATABASE_URL y ADMIN_SETUP_TOKEN son secretos. Nunca se incluyen en Git ni en registros. Cuando el usuario facilite su PostgreSQL, debe proporcionar una base ya creada y permisos para crear tablas, índices y ejecutar sus migraciones. No se admite una URL MySQL. Si el proveedor usa PgBouncer, usar una conexión directa o session pooling para migrar: el migrador mantiene un advisory lock de sesión. La aplicación usa conexiones del pool con cada transacción completa en un mismo cliente.

El formulario de Seenode rechaza variables con valor vacío. DATABASE_URL queda sin añadir hasta disponer de la conexión real: añadirla en Entornos y marcarla como secreto. Las opciones SSL y del pool ya están preparadas. No introducir una URL ficticia, pues impediría el arranque.

TLS verifica el certificado y hostname por defecto, incluso si la URL contiene sslmode=require. Los parámetros SSL de la URL se normalizan para evitar que sobrescriban esta verificación. Para una CA privada, configurar DATABASE_SSL_CA con PEM completo. DATABASE_SSL_MODE=disable desactiva TLS solo por configuración explícita; reservarlo para una conexión local o privada de confianza. No se desactiva validación de certificados automáticamente.

Al guardar DATABASE_URL, volver a desplegar o reiniciar. npm start ejecuta las migraciones de drizzle/postgres ordenadas, verifica sus checksums y bloquea migraciones concurrentes. Una URL configurada pero inválida o inaccesible hace fallar el arranque para evitar aparentar un backend listo. La configuración del proveedor externo, firewall, certificados, respaldo y recuperación corresponden a esa base; no se crean recursos adicionales en Seenode.

## Acceso

La identidad proviene de sesiones opacas revocables almacenadas como hash en PostgreSQL. No se confía en headers OpenAI/Cloudflare enviados por visitantes.
El administrador se activa una sola vez en /configurar-admin con ADMIN_SETUP_TOKEN y una contraseña elegida por el propietario. La coincidencia del correo por sí sola no concede permisos. Hasta conectar DB esta activación no está disponible.
El registro normal crea usuarios sin privilegios. No hay verificación ni recuperación por correo mientras no se implemente el proveedor correspondiente.

## Migraciones y desarrollo

PostgreSQL: drizzle/postgres/0000_initial.sql y 0001_auth.sql. No modificar una migración aplicada: añadir otra. Timestamps de sesión usan BIGINT; fechas ISO y documentos JSON conservan TEXT para compatibilidad con el dominio. Batches usan SERIALIZABLE y reintentan la transacción completa ante SQLSTATE40001/40P01.
SQLite se conserva únicamente para desarrollo/tests sin DATABASE_URL. Los archivos locales y sus datos no se suben ni se transfieren automáticamente. Las bases anteriores de Sites tampoco se importan por cambiar hosting.

## Validación y límites

Las pruebas nuevas ejecutan SQL real sobre el motor PostgreSQL embebido PGlite: migraciones, checksums, rollback, RETURNING, autenticación, sesión y cuotas. Un test separado verifica reintentos de serialización y liberación de conexiones. PGlite usa una sesión serializada; estas pruebas no sustituyen validar SSI entre conexiones remotas, red, TLS, backups ni persistencia del proveedor elegido. No se ha usado una base externa del usuario.
La auditoría de dependencias de producción debe verificarse con npm audit --omit=dev. Las herramientas Drizzle de desarrollo conservaban cuatro avisos moderados; no se aplica una actualización forzada que cambie su versión mayor.
El catálogo y los costos siguen siendo DEMO. Servicios turísticos, IA, email y cobros requieren implementación además de credenciales.

## Coste y fuentes

Solo servicio web Basic, 512 MB, una réplica. El panel mostró 4 USD/mes el 9 de septiembre de 2026. No se contrata volumen ni DB Seenode. Los costes de una base externa serán los de su proveedor.
[Seenode Node y runtime](https://seenode.com/docs/reference/runtimes), [puerto](https://seenode.com/docs/how-to/configure/port), [TLS node-postgres](https://node-postgres.com/features/ssl), [transacciones node-postgres](https://node-postgres.com/features/transactions), [aislamiento PostgreSQL](https://www.postgresql.org/docs/current/transaction-iso.html).
