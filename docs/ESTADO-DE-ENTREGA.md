# VoyConPlan — estado de entrega frente al alcance solicitado

**Fecha de revisión: 9 de septiembre de 2026.**

VoyConPlan cuenta con una base funcional de planificación: descubrimiento mediante un catálogo DEMO, viajes guardados, edición de itinerario y presupuesto, gastos, checklist, enlaces compartidos y una administración inicial. **Esta entrega no constituye el SaaS completo descrito en las 151 secciones del encargo ni está lista para vender todas las prestaciones de Plus y Max.**

La persistencia y las acciones propias de la aplicación son reales. Los precios de viaje, tipos de cambio, tiempos de vuelo y afinidad del catálogo son DEMO. No se consultan ofertas, disponibilidad, requisitos migratorios, clima ni lugares en tiempo real. La generación automática de itinerarios mediante IA, los pagos y los trabajos programados todavía requieren desarrollo.

La revisión corresponde al código disponible y a las pruebas detalladas abajo. La publicación y su comprobación final estaban pendientes al cerrar esta versión del documento.

## Cómo leer la matriz

- **Implementado:** existe código funcional y persistencia cuando corresponde; puede quedar una verificación específica pendiente.
- **Verificado:** se cuenta con una prueba ejecutada o una comprobación de navegador descrita en este documento. Su alcance se indica expresamente.
- **DEMO:** datos de ejemplo identificados; no son cotizaciones ni hechos actuales comprobados.
- **Pendiente de desarrollo:** faltan lógica, integración, interfaz, infraestructura o pruebas necesarias. Añadir credenciales no lo resuelve por sí solo.
- **Pendiente de configuración externa:** hace falta activar un servicio, cuenta, secreto o acceso. Cuando además falta código, se indican ambas cosas.

Las fases se valoran por sus criterios completos; tener algunos módulos de una fase no equivale a terminarla.

## Fase 1 — Fundación: implementada parcialmente, con núcleo operativo verificado

| Componente del alcance | Estado actual | Alcance y límite |
|---|---|---|
| Marca y sistema visual | Implementado | Nombre VoyConPlan, paleta verde oscuro/lima/marfil, tipografía, componentes, favicon e iconos. Se incorporaron seis fotografías de destinos con procedencia y tres imágenes editoriales generadas para solo, pareja y familia. No está terminado el inventario completo de activos de marca solicitado para todos los canales. |
| Aplicación y backend | Implementado y compilación verificada | React, TypeScript y Vinext sobre Cloudflare Worker y D1. Es una adaptación a la plataforma de alojamiento disponible, no una implementación de PostgreSQL/Redis. |
| Base de datos y migración | Implementado; persistencia verificada localmente | Usuarios, viajes, miembros, planes, consumo, enlaces, favoritos, contenido, registros, eventos y auditoría. Perfil, itinerario, gastos y checklist se almacenan en JSON dentro de entidades principales. El modelo completo de todas las entidades comerciales del encargo no está implementado. |
| Autenticación | Implementado; identidad local verificada | Inicio de sesión integrado con el mecanismo de Sites/ChatGPT. En desarrollo se probó el rechazo de lectura anónima y de cabeceras de identidad falsificadas. Falta completar la prueba con dos identidades reales y la validación del acceso en el despliegue final. |
| Administración y roles | Implementado parcialmente | Allowlist administrativo en servidor, ocho roles y permisos por sección, suspensión de usuarios y cambios auditados. No se han ejecutado todos los cruces de la matriz RBAC con identidades independientes. MFA administrativo y gestión comercial completa no están incorporados. |
| Planes | Implementado como configuración | Free USD 0, Plus USD 2.99 y Max USD 4.99 por mes; precio, número de viajes y colaboradores editables. Los límites iniciales son 2/10/30 viajes creados, no generaciones de IA, ya que no hay IA conectada. Las diferencias completas de funcionalidades entre planes siguen pendientes. |
| Cuotas, idempotencia y guardado | Implementado; pruebas locales parciales superadas | La creación usa un lote transaccional y clave idempotente; los reintentos reutilizan el viaje. Ediciones simultáneas con la misma versión generan un éxito y un 409. Se probó rechazo concurrente con Free ya agotado; falta la prueba de admisión simultánea desde consumo cero para los tres planes. |
| Seguridad básica | Implementado; casos concretos verificados | Consultas parametrizadas, validación, origen exacto en escrituras, permisos por propietario/miembro, rate limit, respuestas privadas sin caché y exclusión de secretos de enlaces. Las monedas heredadas de prototipo y la alteración de identidad/plan desde perfil se rechazan. No equivale a una auditoría de seguridad exhaustiva. |
| Analítica y consentimiento | Implementado básico | Lista de eventos permitidos y consentimiento requerido; panel de conteos. No hay rastreadores publicitarios activos. No se han desarrollado todas las políticas de retención, jurisdicción y atribución solicitadas. |
| Billing skeleton | Preparado como contrato; pendiente de desarrollo | Existe la interfaz BillingProvider y un adaptador que responde «no conectado». No hay checkout, portal ni webhooks funcionales. |

## Fase 2 — MVP de viaje: planificador manual operativo con descubrimiento DEMO

| Componente del alcance | Estado actual | Alcance y límite |
|---|---|---|
| Entrada sin registro | Implementado y verificado en navegador | Un invitado puede indicar presupuesto y explorar; el registro aparece al guardar. Se comprobó el paso desde invitado a viaje persistido con la identidad local. |
| Origen, fechas, duración y viajeros | Implementado | Cinco orígenes predefinidos, tres tipos de viaje, USD/BOB/EUR, presupuesto total o por persona, duración e intereses. No existe cobertura internacional abierta de ciudades/aeropuertos ni todo el cuestionario avanzado solicitado. |
| «¿Hasta dónde llego?» y descubrimiento | Implementado y verificado, con datos DEMO | Seis destinos: Cartagena, Cusco, Buenos Aires, Río de Janeiro, Ciudad de México y Lisboa. El cálculo incluye grupo, noches, gastos diarios, extras y contingencia. No demuestra viabilidad con precios actuales ni condiciones reales de entrada. |
| Destination Fit Score | Implementado parcialmente, DEMO | Fórmula determinista en backend basada en presupuesto, intereses y duración; explica coincidencias. No incorpora datos reales de vuelos, estacionalidad, seguridad, clima, requisitos o conexiones; sus ponderaciones aún no son administrables. |
| Escenarios económico/realista/cómodo | Implementado, DEMO | Se muestran escenarios sobre costos de ejemplo. El escenario económico y el cómodo son multiplicadores del escenario base; no son cotizaciones independientes. Documentación/visa comienzan sin costo verificado y se advierte que ello no significa gratuidad. |
| Mapa de posibilidades | Implementado; carga OSM verificada | Mapa real de OpenStreetMap con los seis destinos y colores de viabilidad DEMO; slider de presupuesto. No ofrece rutas reales de actividades ni los filtros migratorios y logísticos completos del encargo. |
| Comparador | Implementado con datos DEMO | Selección de dos a cinco destinos, categorías de gasto, afinidad y duración de vuelo de ejemplo. Visa, clima, escalas y seguridad no se comparan con datos verificados. La segmentación completa de este derecho por plan está pendiente. |
| Viajes persistidos | Implementado y verificado localmente | Crear, listar, editar y borrar; estado del viaje y preferencias. Autoguardado con control de versión; ante fallo conserva cambios en memoria y ofrece reintento o descarga de borrador. No existe historial restaurable de versiones de itinerario. |
| Itinerario | Implementado como editor manual | Días, actividades con hora, duración, costo, notas y marcado; validación de superposiciones. La creación inicial incluye un bloque orientativo de llegada/descanso. **No genera un itinerario completo por IA** ni valida aperturas reales, transporte, check-in o disponibilidad. |
| Presupuesto y gastos | Implementado; gasto guardado verificado | Categorías, presupuesto previsto, gasto registrado, saldo y edición manual. Pareja tiene un reparto básico 50/50 con «yo», «mi pareja» y «compartido». No existe contabilidad avanzada multimoneda, conciliación ni reparto configurable completo. |
| Checklist | Implementado; persistencia verificada | Lista inicial editable y pendientes personales con marcado. No se genera una lista documental personalizada a partir de requisitos oficiales. Marcar un elemento no confirma admisibilidad migratoria. |
| Vuelo y alojamiento | Implementado solo para datos manuales | Campos para registrar reservas existentes; códigos privados excluidos de la vista compartida. Las búsquedas, comparación de ofertas, equipaje, impuestos y disponibilidad reales están pendientes. |
| Restaurantes, lugares, actividades y rutas | Pendiente de desarrollo e integración | Existen contratos de proveedor; no hay catálogo real consultado ni recomendaciones verificadas, cálculo de recorridos o reserva de experiencias. |
| Centro de requisitos | Interfaz implementada; información específica pendiente | Muestra visa, pasaporte, tránsito, entrada, salud y menores como **sin verificar**, sin esconder avisos críticos por plan. Guarda país de pasaporte, residencia y tránsitos. No determina qué exige un país para una persona concreta ni se ha consultado una fuente migratoria. |
| Monedas | Implementado con conversión DEMO | USD, BOB y EUR mediante tasas de ejemplo. No hay cotización vigente ni timestamp de consulta real. |
| Solo, pareja y familia | Implementado parcialmente | Variantes de entrada, preferencias, ocasión, alimentación, movilidad y edades aproximadas sin nombres de menores. Pareja permite invitación y preferencias individuales con coincidencias; falta el equilibrio automático del itinerario y la personalización profunda de los tres modos. |
| Colaboración | Implementado; prueba con dos cuentas reales pendiente | Invitación de uso controlado, aceptación autenticada y cupo de colaboradores. No se ha completado el E2E A/B real, la administración granular de miembros ni las preferencias grupales avanzadas. |
| Compartir y WhatsApp | Implementado; privacidad y revocación verificadas por API local | Enlaces aleatorios hasheados, duración de siete días y revocación. Vista de lectura con campos permitidos; excluye códigos de reserva, gastos y notas privadas. WhatsApp prepara un enlace para envío por el usuario. No se implementaron todas las variantes de compartir día/actividad/hotel/vuelo/comparación. |
| PDF | Implementado; descarga y muestra de páginas verificadas visualmente | Se descargó un PDF de nueve páginas y 447.247 bytes. Se renderizó con Poppler y se inspeccionaron las páginas 1, 2, 3 y 9 sin problemas de composición; las páginas 4–8 corresponden a días aún sin actividades. Contiene marca, presupuesto, itinerario, checklist, requisitos sin verificar y reservas sin códigos privados; puede incluir QR de enlace. No ofrece todavía todas las plantillas, mapas embebidos, clima y secciones enriquecidas del alcance. |
| Favoritos / «Algún día» | Implementado para destinos | Guardar y quitar destinos. Favoritos de hoteles, restaurantes y actividades, y avisos posteriores de oportunidad, están pendientes. |

## Fase 3 — Monetización: pendiente como servicio comercial

| Componente del alcance | Estado actual | Alcance y límite |
|---|---|---|
| Compra de Plus/Max | No disponible | Los botones de suscripción están deshabilitados y se indica que no hay cobros. No existe una suscripción comercial activa por pulsar un botón. |
| Lemon Squeezy | Contrato preparado; desarrollo y configuración pendientes | Faltan solicitudes reales, asociación de variantes/usuarios, checkout, portal, verificación e idempotencia de webhooks, renovación, cancelación, gracia y reembolsos. También se requieren cuenta comercial y secretos. |
| Derechos de Plus/Max | Parciales | Se usan límites de viajes y colaboradores. PDFs premium, restauración de versiones, revalidación, importación, calendarios y asistente avanzado no están implementados. No deben venderse como activos. |
| Cupones y promociones | Registros administrativos implementados | Se guardan borradores de campañas y códigos. No se aplican descuentos ni se validan canjes, topes concurrentes o condiciones comerciales ante un procesador. |
| Referidos y afiliados | Pendiente de desarrollo | No hay recompensa de referidos, atribución de conversiones ni red afiliada activa. No se contabilizan clics como ingresos ficticios. |
| Alertas de vuelos y recordatorios | Pendiente de desarrollo e infraestructura | No hay alertas que se ejecuten autónomamente, programador desplegado, cola ni correo de entrega. Un campo de configuración o contrato de proveedor no equivale a una alerta activa. |

## Fase 4 — Admin y crecimiento: operación inicial, alcance completo pendiente

| Componente del alcance | Estado actual | Alcance y límite |
|---|---|---|
| Dashboard | Implementado básico | Conteos reales de usuarios, viajes, publicaciones y eventos de la base de datos. Ingresos y costos aparecen sin conexión/dato, no como valores inventados. |
| Usuarios y planes | Implementado parcialmente | Listado, roles, suspensión y configuración de precio/límites. No incluye toda la gestión de suscripciones, historial financiero, consumo detallado y soporte operativo solicitado. |
| CMS y noticias | Implementado básico; creación de borrador verificada | Crear/editar/eliminar contenido, borrador/publicado, título, slug, resumen y cuerpo de texto; tipos Post, Noticia, Guía, FAQ y Página. Se creó un borrador desde el admin y se comprobó su persistencia en D1 local. No hay editor enriquecido completo, programación, galerías, idiomas, versiones ni flujo editorial avanzado. |
| Destinos y SEO | Implementado básico | Descripción y visibilidad administrables; páginas de destino y blog, metadatos, Open Graph, sitemap y robots. No existe panel SEO completo, redirecciones, structured data exhaustiva ni todos los tipos de páginas previstos. |
| Soporte | Implementado básico | El usuario registra solicitudes y consulta estado; el admin puede gestionarlas. El guardado conserva el mensaje original. Asignación, prioridad, conversación, SLA y notas internas completas están pendientes. |
| Eventos y analítica | Implementado básico | Conteos por evento y día con consentimiento. No hay un CRM de leads completo, embudos, cohortes, DAU/WAU/MAU completos, atribución UTM ni conectores de marketing. |
| Promociones, cupones y configuración | Implementado como registros | Persistencia y auditoría básicas. No implican ejecución de campañas, envío de correo ni efecto en pagos. |
| Auditoría y salud de proveedores | Implementado básico | Registro de acciones administrativas y estados explícitos de servicios no conectados. No existe trazabilidad/costos/latencia/cuotas reales de proveedores todavía. |
| Multimedia, generación IA administrativa, campañas, notificaciones, A/B y reportes avanzados | Pendiente de desarrollo | Las imágenes creadas para la entrega no son una biblioteca administrativa ni un generador integrado. El CSV básico de tablas no reemplaza todos los reportes XLSX y segmentaciones del encargo. |

## Fase 5 — Asistencia durante el viaje: base PWA, automatización pendiente

| Componente del alcance | Estado actual | Alcance y límite |
|---|---|---|
| PWA | Implementado básico | Manifest, iconos y service worker con página de contingencia offline. La instalación en dispositivos reales requiere comprobación final. |
| Offline de viaje | Implementado como copia descargable | HTML de lectura con itinerario y checklist, sin códigos de reserva. No sincroniza cambios ni equivale a disponer de toda la aplicación privada offline. El service worker no almacena APIs privadas. |
| Modo Hoy | Parcial | Vista del plan del día basada en el itinerario introducido. No es asistencia contextual con clima, rutas o información revalidada. |
| Clima y replanificación | Pendiente de desarrollo e integración | Sin pronóstico real, promedios históricos integrados ni alternativas automáticas. |
| Revalidación de requisitos y horarios | Pendiente de desarrollo e infraestructura | No hay comprobaciones automáticas a siete días, 24 horas o durante el viaje. |
| Multidestino, escalas e importación | Pendiente de desarrollo | El modelo actual no implementa el análisis completo de tramos y conexiones, OCR de reservas, importación de PDF ni correo autorizado. |
| Notificaciones y jobs | Pendiente de desarrollo e infraestructura | No hay programador autónomo, cola, reintentos, outbox, correo ni push. No se simulan estos trabajos mediante visitas del usuario. |

## Credenciales que faltan y desarrollo que falta

**En esta versión, las APIs de viaje y pagos no están esperando únicamente una clave.** En `lib/providers.ts` se definen interfaces; los adaptadores Duffel, Amadeus y Lemon Squeezy responden «NOT_CONFIGURED» y no realizan peticiones externas.

| Área | Configuración/cuenta necesaria | Trabajo de implementación todavía necesario |
|---|---|---|
| Vuelos, alojamiento, lugares, actividades y rutas | Proveedor con cobertura y condiciones aceptadas; credenciales y acuerdos aplicables | Cliente HTTP, mapeo de solicitudes y resultados, precios/impuestos, errores, timeout, caché, atribución, enlaces y pruebas reales |
| Requisitos migratorios | Servicio especializado y fuentes oficiales adecuadas para pasaporte/residencia/tramos | Reglas estructuradas, vigencia, severidad, fuentes por ítem, incertidumbre, filtrado seguro por plan y pruebas de casos críticos |
| Currency y Weather | Fuente de tasas y meteorología | Consultas reales, snapshots/TTL, precisión, forecast frente a histórico, fechas/timezones y estados vencidos |
| IA | Proveedor, credenciales, modelo y presupuesto | Organización sobre datos verificados, esquema de salida, restricciones operacionales, versionado de prompts, cuotas/costos y rechazo de datos inventados |
| Billing | Cuenta comercial, productos/variantes, secreto de webhook y entorno de prueba | Flujo completo de suscripción, eventos firmados/idempotentes, estado persistido, reconciliación y pruebas de pago |
| Correo y notificaciones | Proveedor, dominio/remitente verificado y canales | Plantillas, preferencias/bajas, colas, envío y seguimiento real de entrega |
| Jobs | Programador/cola y bindings o servicios equivalentes | Productores/consumidores, deduplicación, próxima ejecución, reintentos, historial y monitorización |
| Afiliados e imágenes administrativas | Acuerdos/redes y servicio de generación/almacenamiento | Atribución y conversiones; biblioteca multimedia, subida, permisos y revisión editorial |

## Pruebas y evidencia disponibles

| Validación | Resultado registrado | Qué demuestra y qué no |
|---|---|---|
| `node --experimental-strip-types --test tests/domain.test.mjs` | **10 de 10 aprobadas**; ejecutadas nuevamente durante esta revisión | Costos por grupo/noches, monotonicidad de afinidad, presupuesto por persona, conversión DEMO, monedas inválidas, rangos, cambio de año UTC, superposición, proyección compartida y preferencias. No valida precios reales ni migración. |
| `tests/api.integration.mjs` | **18 aserciones aprobadas**, ejecución confirmada por el responsable de QA | Identidad local, Origin, descubrimiento, requisitos desconocidos, perfil protegido, persistencia, reintentos idempotentes, conflicto 409, DEMO inmutable, privacidad/revocación del enlace, cuota Free ya agotada y borrado de viaje de prueba. No usa dos identidades reales ni procesa pagos. |
| Build | **Exitoso**, confirmado por QA | Compilación del proyecto. No demuestra todas las funcionalidades comerciales o la publicación. |
| `npx tsc --noEmit` | **Aprobado**, confirmado por QA | Comprobación de tipos con la configuración actual. El uso de `any` reduce la cobertura efectiva y sigue siendo deuda técnica. |
| `npm run lint` | **No aprobado**: último conteo comunicado, 219 diagnósticos; cifra provisional durante correcciones de QA | Incluye 126 casos de `no-explicit-any`, 26 sobre enlaces/anchors de Next, diagnósticos en componentes de terceros incorporados al proyecto y algunos hallazgos de accesibilidad propios. Se están corrigiendo problemas de runtime y accesibilidad; no se elimina todo el uso de `any` en esta entrega. Que TypeScript y build pasen no significa que lint pase. |
| Auditoría de dependencias de producción | **0 vulnerabilidades informadas** en `npm audit --omit=dev`; reporte revisado | Foto del estado del árbol auditado. No equivale a ausencia universal de riesgos de seguridad. |
| Auditoría completa de dependencias | **4 avisos moderados de tooling**, confirmados por QA | Residual del loader legado de Drizzle Kit. Se actualizaron React/RSC, Vite, Vinext, Cloudflare y Sharp. El tooling pendiente debe mantenerse bajo seguimiento. |
| Navegador | Flujo invitado → autenticación local → viaje guardado; gasto de 32 y checklist persistidos; mapa OSM cargado; borrador CMS persistido | Verifica acciones concretas. No sustituye los E2E completos Free/Plus/Max/Pareja/Admin con cuentas reales. |
| Móvil 390 × 844 | Formulario, tarjetas y comparación de dos destinos inspeccionados | La tabla comparativa se desplaza horizontalmente. Es una revisión de estas superficies y tamaño de pantalla, no una auditoría completa de accesibilidad ni de todos los dispositivos. |
| WebMCP | Descubrimiento con presupuesto 900 y lectura del estado verificados; presupuesto negativo rechazado | Herramientas de descubrimiento DEMO integradas con el estado visible. No conectan datos externos ni generan itinerarios por IA. |
| PDF | Nueve páginas; descarga de 447.247 bytes; render con Poppler y revisión visual de páginas 1, 2, 3 y 9 correctos | Las páginas 4–8 corresponden a días sin actividades. Verifica generación, descarga y composición de la muestra revisada; no completa las plantillas y secciones pendientes del alcance. |
| Publicación y acceso final | Pendiente al cierre de esta matriz | Falta registrar URL final, visibilidad, migración remota, autenticación y smoke test del despliegue. |

La suite API consume cuota local y presupone una base preparada; no debe ejecutarse contra producción. Se conservaron correcciones de integridad: preservación de procedencia DEMO desde servidor, guardado administrativo limitado por tipo de registro, conservación del mensaje de soporte, revalidación de invitaciones y preservación del borrador ante errores de guardado.

## Trabajo transversal que todavía impide declarar el alcance completo

1. Integraciones externas reales y validación de sus datos; el descubrimiento actual no puede presentarse como recomendación de compra respaldada por tarifas vigentes.
2. Planes comerciales, cobros, derechos completos por plan, canjes, afiliados y seguimiento financiero real.
3. Motor de itinerarios factibles, rutas/horarios, multidestino y requisitos personalizados con fuentes.
4. Programador autónomo, alertas, revalidaciones, correo, push y asistencia durante el viaje.
5. Administración amplia, leads, marketing, editor enriquecido, biblioteca multimedia y métricas avanzadas.
6. Inglés funcional y arquitectura de traducciones completa; la interfaz actual está en español. No basta mostrar moneda internacional para afirmar internacionalización.
7. Pruebas con dos cuentas reales, todos los roles, planes Plus/Max, tránsito, timezones de tramos, billing/webhooks y cuotas concurrentes desde cero.
8. Validación sistemática de accesibilidad y dispositivos, además de las comprobaciones visuales y funcionales realizadas; resolver los diagnósticos propios pendientes de lint y reducir la deuda de tipado basada en `any`.
9. Backups con restauración probada, retenciones, responsables y textos legales definitivos para los mercados de operación. Las páginas legales actuales se identifican como borradores de revisión.

**La entrega permite revisar y utilizar un planificador persistente con límites claramente indicados. Las cinco fases del producto integral continúan abiertas en los componentes que esta matriz identifica como pendientes.**
