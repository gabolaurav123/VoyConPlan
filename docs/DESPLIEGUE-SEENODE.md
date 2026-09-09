# Despliegue en Seenode

Destino solicitado: grupo Gimnasio-del-Cerebro, repositorio gabolaurav123/VoyConPlan, rama main.
La rama actual funciona en Node 24. La versión anterior de Sites se conserva en el historial.

## Servicio

- Runtime: Node 24.
- Build: npm ci --include=dev && npm run build.
- Start: npm start (aplica migraciones y ejecuta el servidor de producción).
- Puerto:3000, dirección 0.0.0.0.
- Réplicas: exactamente 1.
- Volumen persistente: 5 GB montado en /data.
- DATABASE_PATH=/data/voyconplan.sqlite.
- Healthcheck: /api/health.
- Auto-deploy desde main cuando se habilite en Seenode.

El volumen es obligatorio. El filesystem ordinario del contenedor es efímero. Esta configuración SQLite no admite añadir réplicas; para escalar horizontalmente hay que migrar a PostgreSQL.

## Variables

NODE_ENV=production
APP_ORIGIN=origen HTTPS exacto entregado por Seenode, sin barra final
VINEXT_TRUSTED_HOSTS=hostname exacto de ese origen
DATABASE_PATH=/data/voyconplan.sqlite
ADMIN_EMAILS=gabolaurav@gmail.com
ADMIN_SETUP_TOKEN=token aleatorio 32 bytes base64url; marcarlo secreto con asterisco en Seenode.

No usar datos de producción ni el token real en GitHub. No reusar tokens de la instalación privada de Sites.

## Acceso

La identidad proviene de sesiones revocables almacenadas en SQLite. No se aceptan cabeceras de identidad de OpenAI/Cloudflare suministradas por visitantes.
El administrador se activa una sola vez en /configurar-admin, con el token secreto y una contraseña elegida por el propietario. La coincidencia del correo por sí sola no concede permisos.
El registro normal crea usuarios sin privilegios; no hay verificación ni recuperación por correo mientras no se conecte un proveedor de email.

## Operación

Las migraciones SQL son versionadas y transaccionales. No modificar una migración que haya sido aplicada: agregar la siguiente.
La copia antigua de Sites y sus datos no se transfieren automáticamente. Los datos locales de pruebas tampoco se suben.
Respaldar el archivo SQLite mediante el mecanismo de backup SQLite o una copia coherente de la base pausada; no copiar únicamente el archivo principal mientras WAL tiene escrituras activas.
La exportación de cuenta permite al usuario descargar su información, pero no sustituye un backup operativo.
El resto del alcance sigue descrito en ESTADO-DE-ENTREGA: APIs turísticas, IA y cobros no se activan por cambiar de hosting.

## Coste documentado

Basic web: $3/mes; volumen 5 GB: $2.50/mes; total básico: $5.50/mes. Se descuenta del saldo del grupo por tiempo de ejecución. Verificar precio mostrado en Seenode al activar. No requiere comprar créditos automáticamente.
Fuentes: https://seenode.com/docs/reference/pricing y https://seenode.com/docs/how-to/persistent-storage.
