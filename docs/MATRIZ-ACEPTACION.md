# VoyConPlan — aceptación por fases

**Este es un plan de verificación, no una declaración de pruebas pasadas.** Cada fila debe terminar con evidencia: comando/prueba, resultado, fecha y limitación. Estados recomendados: pendiente, implementado sin verificar, verificado, DEMO, depende de proveedor.

| Fase | Entrega observable | Criterio de aceptación | Impide afirmar fase completa |
|---|---|---|---|
| 1 Fundación | Registro/login, sesión, perfiles, administración protegida | Usuario creado y recuperado tras recarga; sesión inválida rechazada; ningún visitante obtiene admin | Auth simulada, admin público o basado en localStorage |
| 1 Fundación | D1 y migraciones | Migración limpia reproducible; claves/índices; persistencia y errores documentados | Datos solo en memoria, JSON global sin aislamiento |
| 1 Fundación | Planes y cuotas configurables | 2/10/30 iniciales; permisos backend; 20 peticiones concurrentes respetan cuota 2 | Cambio de plan desde cliente; read-then-write no atómico |
| 1 Fundación | Sistema visual y PWA base | Marca exacta, mobile, teclado, contraste, labels, estados de error y carga | Solo captura/landing, acciones sin resultado |
| 1 Fundación | Billing skeleton, analítica | «No conectado» hasta configurar; eventos solo al ocurrir y con consentimiento adecuado | Checkout fake, ingresos demo sin señalizar |
| 2 MVP | Origen, presupuesto y descubrimiento | Total por grupo/persona; vuelos incluidos/excluidos; categorías completas; fórmula backend explicable | Ranking puramente IA o costos inventados como actuales |
| 2 MVP | Exploración/mapa/comparación | Slider actualiza viabilidad; filtros aplicados; comparaciones 2–5 cuando derecho habilitado | Mapa decorativo o tarjetas sin vínculo con presupuesto |
| 2 MVP | Vuelo/alojamiento/lugares/moneda | Adaptador real o estado no disponible; moneda/fecha/proveedor visibles | Ofertas y disponibilidad ficticias |
| 2 MVP | Requisitos | Contexto pasaporte/residencia/tránsito; incertidumbre visible; críticos Free | «Sin visa» por falta de datos; alerta crítica detrás de pago |
| 2 MVP | Itinerario, presupuesto y guardado | Persistencia; conflictos temporales detectados; horarios y distancias trazables; edición y versión | Horarios IA sin fuente, guardado indicado sin escritura |
| 2 MVP | Solo/pareja/familia | Una persona completa sola; pareja invita/acepta y combina preferencias; familia usa rangos anónimos | Misma pantalla sin adaptación, invitación insegura |
| 2 MVP | PDF y WhatsApp | PDF real con datos/fuentes y DEMO donde aplique; enlace abre vista segura y revocable | Exportación solo botón, compartir expone reservas |
| 3 Monetización | Checkout y suscripción | Sandbox verificado; firma inválida rechazada; replay no duplica; transición fuera de orden no retrocede estado | Pago activado por redirect o por botón de prueba |
| 3 Monetización | Plus/Max y descuentos | Límites y funciones aplicados servidor; cupones con tope global/usuario atómico; reglas de vigencia | Controles solo UI o promoción que simula cobro |
| 3 Monetización | Alertas y afiliados | Job corre sin tráfico HTTP; deduplica envío; enlace afiliado real; ingreso solo con conversión conocida | «Alerta activa» sin cron/cola o clic contabilizado como venta |
| 4 Operación | CMS/noticias/medios/SEO | Crear, editar, publicar/despublicar, programar con job real; HTML seguro; metadatos en página | Contenido estático presentado como CMS completo |
| 4 Operación | Campañas/leads/analítica | Consentimiento y baja; envíos reales; dashboard basado en eventos; permisos/exportaciones filtradas | Métricas sembradas mezcladas con producción |
| 4 Operación | Admin amplio, RBAC y auditoría | Roles de la matriz; búsquedas; soporte; planes; costos; logs sensibles auditados | «Solo lectura» accede a viajes privados; secretos visibles |
| 5 Asistente | Revalidación/clima/replanificación | Programador real; snapshots nuevos; cambios explicados; usuario aprueba mover reservas fijas | Replanificación sobre pronóstico inventado o clima histórico disfrazado |
| 5 Asistente | Hoy/offline/notificaciones | Día por timezone correcto; caché por usuario; fecha offline; limpieza logout; entrega comprobada | Datos privados compartidos por caché, alerta sin entrega |
| Todas | Exportación/borrado/backup/documentación | Datos descargables; eliminación trazable; estrategia y restauración probada si se anuncia backup | «Backup completado» sin archivo o respaldo verificable |

## Flujos E2E del alcance

| Flujo | Secuencia mínima | Datos que deben existir |
|---|---|---|
| Free | Entrar → presupuesto → destino → requisitos esenciales → crear → PDF → compartir | Cuenta al guardar, viaje persistido, fuente de requisitos o ausencia explícita, token revocable |
| Plus | Buscar → comparar → requisitos ampliados → checklist → alerta | Derecho verificado y proveedor/job configurados; si faltan, flujo marcado pendiente |
| Max | Multidestino → escala → requisitos por tramo → replanificar | Todos los tramos con fechas/timezones, fuentes y ventanas; cambios persistidos |
| Pareja | A crea → invita → B acepta → preferencias individuales → coincidencias → itinerario | Dos identidades, membresía, preferencias por persona y explicación de compromisos |
| Admin | Login autorizado → dashboard → leads → post → noticia → promoción → cupón → notificación → métricas | RBAC, auditoría, escrituras reales, proveedor de envío para notificación real |

## Casos límite de alto valor

- Bajar plan conserva viajes existentes sin regalar nuevas cuotas; define lectura/exportación de datos premium ya creados.
- Un proveedor vencido no se muestra como actualizado por refrescar el navegador; el timestamp procede de la consulta efectiva.
- Las comparaciones no suman USD, EUR y BOB directamente; una tasa ausente impide un total engañoso.
- Los vuelos que cruzan medianoche y línea de fecha mantienen orden temporal; días del itinerario pertenecen al destino.
- La alerta de tránsito esencial se mantiene visible aunque expire Plus/Max.
- La exportación de PDF conserva marcas DEMO y avisos de fuente/fecha; no filtra datos a enlaces públicos.
- Dos canjes simultáneos no superan el último uso de un cupón; un webhook duplicado no renueva dos veces.
- Sin credenciales comerciales, la aplicación puede funcionar como planificador con datos manuales y muestras explícitas; no se declara SaaS comercial completo por ello.
