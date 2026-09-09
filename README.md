# VoyConPlan

Base funcional de planificación de viajes, con datos de costos DEMO y persistencia real.
Interfaz en español. Esta entrega no completa las cinco fases del producto comercial.
Consulta docs/ESTADO-DE-ENTREGA.md para el alcance y las limitaciones.

## Desarrollo local

Requisitos: Node.js 22.13 o superior, npm, Git. No requiere claves de proveedores para el modo DEMO.

1. Ejecuta `npm ci`.
2. Copia `.env.example` a `.env.local`.
3. Configura `APP_ORIGIN=http://localhost:3000`. Para probar el panel con la identidad ficticia del servidor local de Sites, configura `ADMIN_EMAILS=seedy@sites.test` solo en ese archivo local.
4. Ejecuta `npm run db:local`.
5. Ejecuta `npm run dev -- --host 127.0.0.1 --port 3000`.
6. Abre http://localhost:3000. La simulación de acceso local no constituye una cuenta real.

En producción, la identidad procede exclusivamente del dispatcher de Sites. Nunca expongas el Worker directamente ni confíes en cabeceras de identidad suministradas por un cliente externo. El correo administrador se configura en el entorno del sitio, no en el navegador.

## Arquitectura

- React 19, TypeScript, Vinext y Vite. Worker compatible con Cloudflare.
- D1 SQLite mediante consultas parametrizadas; Drizzle mantiene el esquema y las migraciones.
- shadcn con Base UI, estilos adaptables propios, Leaflet/OpenStreetMap.
- jsPDF y QRCode para exportar; service worker con pantalla offline y copia HTML descargable.
- Identidad de Sites; rol y permisos comprobados en el servidor.

`lib/domain.ts`: cálculo orientativo, validación y proyecciones compartidas.
`lib/server.ts`: identidad, RBAC, D1, cuotas, origen y límites.
`app/api/[...path]/route.ts`: API persistente.
`lib/providers.ts`: contratos y estados sin configurar; los adaptadores externos aún necesitan implementación.
`components/`: explorador, editor de viajes, administración y herramientas WebMCP.
`db/schema.ts`: esquema; `drizzle/0000_rapid_centennial.sql`: migración inicial con 14 tablas.

## Datos y seguridad

Los costos, tiempos estimados y cambios de moneda del catálogo son ejemplos, no cotizaciones. Las fotos de destinos tienen atribución y procedencia en `public/image-sources.json`; las escenas editoriales generadas están identificadas.
La documentación de viaje nunca afirma que el usuario puede entrar a un país. Los seis grupos de requisitos permanecen sin verificar.
Los enlaces compartidos usan tokens aleatorios, hash SHA-256 en DB, caducidad y revocación. La proyección excluye códigos de reserva, notas privadas, gastos y datos documentales. En la publicación privada, compartir un enlace no amplía el acceso al sitio.
Las mutaciones exigen identidad, permisos y origen permitido. Creación idempotente, cuotas transaccionales y versiones optimistas evitan duplicados y sobreescrituras silenciosas.
La PWA no almacena respuestas privadas de API. Si falla un guardado, el borrador se mantiene en memoria, se avisa al salir y se permite reintentar o descargarlo; cerrar definitivamente esa sesión puede perder los cambios no guardados.

## Validación

- `npm test`: 10 pruebas de dominio.
- `npx tsc --noEmit`: comprobación TypeScript.
- `npm run build`: Worker y cliente de producción.
- `node --experimental-strip-types tests/api.integration.mjs`: suite local de 18 comprobaciones de API. Lee tests/README.md antes: consume cuota local y requiere un estado de prueba específico. No ejecutar en producción.
- `npm run lint`: regla estricta del scaffold. Hay diagnósticos pendientes, principalmente tipado amplio de datos JSON y convenciones de navegación/imagen; no se presenta como aprobada.
- Auditoría realizada: cero avisos en dependencias de producción y cuatro moderados en herramientas de desarrollo. Repetir auditoría antes del lanzamiento comercial.

La revisión de navegador incluye autenticación local, creación y guardado, gasto, checklist, CMS, mapa, comparación y móvil a 390 × 844. El PDF descargado fue renderizado para revisión visual. No se ha certificado aún la matriz multicuenta real ni todos los navegadores.

## Publicación y operación

`.openai/hosting.json` identifica el sitio existente y declara DB. No contiene secretos.
Configura variables de producción mediante Sites: APP_ORIGIN con el origen exacto y ADMIN_EMAILS con correos verificados separados por coma. No publiques `.env.local`.
La publicación aplica las migraciones empaquetadas. Los datos locales de pruebas no se suben.
Antes de abrir a terceros: completar las pruebas multicuenta, cerrar deuda de lint/tipado y accesibilidad, revisar retención y textos legales, añadir monitorización/recuperación, y terminar los proveedores que se ofrezcan comercialmente.

## Integraciones pendientes

Vuelos, hoteles, lugares, rutas, requisitos oficiales, tipos de cambio, clima, IA, correo y facturación están sin conectar. Añadir variables no los activa: faltan solicitudes, validación de respuestas, caché, normalización, webhooks y pruebas de integración. No hay cobros ni envío de campañas.
La configuración de Free/Plus/Max persiste y controla creación de viajes y colaboradores; no implica que todas las prestaciones comerciales estén implementadas.
