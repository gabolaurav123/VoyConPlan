# Validación de la versión Node

npm test ejecuta 32 pruebas: 10 de dominio, 8 de SQLite y 14 de autenticación. Cada prueba SQLite/auth usa una base temporal y la limpia al finalizar.
npx tsc --noEmit y npm run build verifican el servidor/cliente.

## Integración local de API

tests/node-api.integration.mjs contiene 27 comprobaciones HTTP. Sólo acepta host localhost/127.0.0.1 y debe ejecutarse sobre una base vacía dedicada exclusivamente a pruebas.
Configura .env.local con APP_ORIGIN=http://localhost:3000, DATABASE_PATH=ruta absoluta de una nueva base de prueba, ADMIN_EMAILS=admin@example.test y ADMIN_SETUP_TOKEN=una cadena base64url local de 43 caracteres o más. Nunca usar secretos ni datos de producción.
Inicia npm run dev. Ejecuta npm run test:api en otra terminal. La suite crea un administrador y dos usuarios sintéticos, consume cuota y mantiene viajes para verificar un reinicio. No se puede repetir sobre la misma base sin preparar un estado nuevo.
Las credenciales de prueba del archivo son ficticias y exclusivamente locales.
La suite original tests/api.integration.mjs corresponde al antiguo simulador de identidad Sites y se conserva como evidencia histórica; no es válida para Node.

## Resultado registrado

32/32 dominio+SQLite+auth aprobadas y 27/27 comprobaciones API aprobadas el 9 septiembre 2026.
Incluye separación entre dos cuentas, bootstrap único, cookies/sesiones, cuotas concurrentes desde cero, idempotencia, conflictos de edición, compartir/revocar/aceptar, permisos de miembro y CMS.
El navegador completó el inicio y cierre de sesión. Los dos viajes y la sesión persistieron tras reiniciar el servidor sobre la misma base.
Build de producción y TypeScript aprobados. La validación HTTP integrada utilizó el servidor local de desarrollo; los atributos Secure de cookies de producción se probaron en la suite auth.
El aviso experimental node:sqlite proviene de Node 24. El lint completo conserva deuda preexistente; no se presenta como aprobado.

Regresión adicional: node tests/anonymous.integration.mjs aprobó 160 lecturas públicas sin bloquear a otros visitantes. Bootstrap se activó correctamente después de 50 claves inválidas en la suite auth.
