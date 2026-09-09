# VoyConPlan — arquitectura y decisiones previas

Fecha: 9 de septiembre de 2026. Documento de diseño basado en las 151 secciones del alcance entregado. Este documento define contratos y criterios: no certifica que las funciones descritas estén implementadas.

## 1. Decisión de plataforma

La implementación inicial usa Vinext, React y TypeScript sobre Cloudflare Workers, D1 y autenticación de ChatGPT facilitada por el entorno de alojamiento. Es una adaptación a la plataforma disponible de la recomendación original Next.js/PostgreSQL/Redis. No se debe describir D1 como PostgreSQL ni dar por disponible toda la infraestructura recomendada.

Separar interfaz, casos de uso, dominio y adaptadores. Ningún componente React consulta proveedores privados directamente. El Worker valida identidad, permisos, datos, plan y cuota antes de persistir o llamar a un proveedor. Los servicios de dominio no dependen del motor SQL; un repositorio permite migrar a PostgreSQL si las necesidades lo justifican.

```text
Web/PWA → API del Worker → identidad + RBAC + validación + cuotas
                        → servicios de viaje / descubrimiento / requisitos
                        → repositorios D1
                        → adaptadores de proveedores oficiales
Programador real → cola de trabajos → servicios → outbox → notificaciones
CMS/admin → mismos permisos del servidor → servicios → auditoría
```

El programador, la cola, el almacenamiento de objetos, el correo y los pagos son dependencias independientes. Que exista un adaptador o una pantalla no significa que esa dependencia esté conectada.

## 2. Invariantes de producto

1. La marca visible es exactamente **VoyConPlan**. El flujo comienza con origen y presupuesto; el registro se pide para persistir, sincronizar o compartir.
2. Los datos de muestra llevan `DEMO` tanto en su objeto como en su representación, exportación, comparación y enlace compartido. No se mezclan silenciosamente con resultados reales.
3. `Sin información`, `No conectado`, `Dato vencido` y `No se exige` son estados diferentes. Ausencia de dato migratorio nunca significa entrada permitida.
4. Toda condición crítica conocida de visa, tránsito, pasaporte, salud obligatoria o admisión aparece en Free. La personalización completa puede ser de pago; la existencia y acción esencial ante un peligro conocido nunca.
5. La IA organiza identificadores de lugares y hechos proporcionados. No origina vuelos, tarifas, reglas migratorias, horarios, clima, disponibilidad, coordenadas o cotizaciones.
6. Los importes se guardan como unidades menores enteras con código de moneda; las tasas conservan fuente, instante y precisión. No sumar monedas sin una conversión explícita.
7. Cada tramo conserva instante UTC, hora local y zona IANA; una fecha sin hora no se convierte arbitrariamente a medianoche UTC.
8. No hay éxito ficticio: «Guardado» requiere escritura confirmada; «Alerta activa» requiere ejecución independiente configurada; «Pago completado» requiere evidencia verificada del procesador.

## 3. Dominios y persistencia

| Dominio | Entidades principales | Reglas y relaciones |
|---|---|---|
| Identidad | User, UserProfile, TravelerProfile, Role, Permission, UserRole, Session | `auth_subject` único; rol y plan controlados por servidor; preferencias separadas de identidad |
| Viaje | Trip, TripMember, TripPreference, TripLeg, TripBudget, Expense, ExpenseSplit | propietario obligatorio; miembro único por viaje/usuario; tipo solo/pareja/familia; versión optimista |
| Descubrimiento | Destination, DestinationCandidate, DestinationScoreConfig, SearchRequest | candidato vinculado a entrada, versión de fórmula y snapshots de precio; nunca score sin explicación |
| Datos externos | FlightSearch, FlightOffer, Accommodation, Place, Activity, CurrencySnapshot, WeatherSnapshot | proveedor, ID externo, fecha, vencimiento, origen real/demo/manual; restricciones de caché |
| Itinerario | ItineraryDay, ItineraryItem, ItineraryVersion | día local; referencias externas; tiempo de traslado y buffers; bloqueos de vuelo/check-in |
| Requisitos | TravelRequirementCheck, TravelRequirementItem, DocumentChecklist | contexto de pasaporte/residencia/tránsitos; severidad independiente del plan; fuente por regla |
| Comercial | Plan, PlanLimit, Subscription, UsageReservation, BillingEvent, Coupon, Redemption, Promotion, Referral, AffiliateClick | límites editables; reservas de consumo idempotentes; nunca convertir un clic en ingreso |
| Comunicación | Alert, Job, JobAttempt, OutboxMessage, Notification, NotificationCampaign, ConsentRecord | trabajo persistente; deduplicación; baja de marketing; estado de entrega probado |
| Contenido | Post, NewsArticle, Category, Tag, MediaAsset, PromptVersion, GeneratedDocument | borrador/publicación/versiones; licencia y origen de imagen; HTML sanitizado |
| Operación | Lead, LeadEvent, AnalyticsEvent, SupportTicket, FeatureFlag, Experiment, ProviderStatus, SharedTripLink, AuditLog, SystemSetting | mínimo acceso necesario; métricas agregadas; auditoría sin secretos |

Índices mínimos: miembros por usuario/viaje; viajes por propietario y fecha; ítems por viaje/día/orden; alertas y jobs por estado/próxima ejecución; eventos por fecha/tipo; contenidos por slug/idioma/estado; snapshots por proveedor/clave/vencimiento. Restricciones únicas sobre IDs de facturación, tokens hasheados y claves de idempotencia. No guardar todo el negocio en un JSON global.

El perfil familiar guarda cantidades y rangos de edad necesarios, no nombres, fechas exactas de nacimiento ni perfiles identificables de menores. Para requisitos se usa país de pasaporte; no se pide número de pasaporte.

## 4. Descubrimiento y viabilidad

El presupuesto total se desglosa en vuelo, alojamiento, comida, transporte, actividades, documentación/visa cuando se conoce su costo, extras opcionales y contingencia. Separar costo por viajero de costo por habitación o grupo y definir número de noches explícitamente.

Una fórmula inicial configurable en backend puede ponderar presupuesto 35 %, preferencias 25 %, logística 15 %, duración/ritmo 10 %, temporada/clima 10 % y requisitos 5 %. Primero se aplican restricciones duras: tramo temporal imposible, presupuesto incompleto, restricciones confirmadas que el usuario no cumple, vuelo superior al máximo solicitado. Un resultado con requisitos desconocidos no se etiqueta «listo para viajar»; el score conserva la incertidumbre.

Cada score devuelve versión, componentes, explicación, datos ausentes y base de estimación. Económico, realista y cómodo son escenarios trazables; no multiplicadores secretos sobre el vuelo. Los colores de viabilidad usan el total completo y umbrales configurables. No ocultar presupuesto/documentación desconocidos asignándoles cero.

El algoritmo de itinerarios valida ventanas de apertura, tiempo de viaje, husos horarios, llegada, equipaje, check-in, descansos y ritmo. Si falta un horario, se marca «por confirmar» y se evita afirmar viabilidad operacional. Una dirección o ruta calculada no prueba disponibilidad de reserva.

## 5. Planes y derechos

Los valores iniciales son Free USD 0, Plus USD 2.99/mes y Max USD 4.99/mes; las cuotas de creación IA iniciales son 2/10/30 por mes. El precio, moneda comercial, cuota, regeneraciones, colaboradores, alertas y funciones se leen de Plan/PlanLimit versionados. Elegir y documentar si la ventana de uso es mes UTC o ciclo de suscripción; no combinar ambos sin reglas de migración.

| Derecho | Free | Plus | Max |
|---|---|---|---|
| Requisitos críticos y aviso de incertidumbre | Siempre | Siempre | Siempre |
| Tipos solo/pareja/familia, descubrimiento | Sí | Sí | Sí |
| Creaciones IA iniciales por mes | 2 | 10 | 30 |
| PDF / compartir | Con marca / sí | Diseños y marca opcional / sí | Plantillas premium / sí |
| Colaborador | 1 | Configurable | Configurable |
| Requisitos ampliados y checklist automático | Esencial | Sí | Por trayecto, más seguimiento |
| Comparación, gastos compartidos y versiones | Según alcance Free | Sí | Sí |
| Alertas / revalidación / offline | Actualización manual | Si infraestructura conectada | Funciones avanzadas si conectadas |
| Replanificación, multidestino y grupo avanzado | No | Según configuración | Sí |

No vender como activa una función que depende de una API o job no configurado. Un cupón o concesión administrativa se registra como derecho promocional separado; no fabrica pagos ni aumenta MRR. La promoción manual requiere permiso específico, motivo, duración y auditoría.

## 6. Seguridad, privacidad y administración

Identificar al usuario mediante sesión validada por el servidor. Nunca dar Super Admin al primer registro, a un parámetro URL o a un email sin verificar. El propietario inicial se aprovisiona mediante identidad verificada explícita en configuración privada o migración controlada. Si el proveedor no ofrece MFA o identidad de recuperación requerida para operadores, documentar esa limitación y proteger administración con un control adicional antes de operar producción.

Todas las lecturas y mutaciones comprueban autorización por recurso. Una lista filtrada no protege un endpoint de detalle. Los administradores con acceso a contenido o marketing no heredan acceso a itinerarios privados. El acceso de soporte a información privada requiere permiso específico, motivo o ticket y AuditLog. No imprimir tokens, claves, códigos de reserva ni cuerpos sensibles en logs.

Las peticiones con cookies usan protección CSRF y comprobación de origen; sesiones seguras; validación de esquemas y tamaños; consultas parametrizadas; HTML del CMS sanitizado; enlaces externos con protocolos permitidos. Paginación y límites de exportación evitan respuestas ilimitadas. Los errores de producción no muestran SQL o secretos.

Compartir genera un token aleatorio criptográfico, almacena únicamente su hash, admite vencimiento y revocación, y utiliza una proyección explícita de campos permitidos. Excluir documentos, códigos de reserva, contactos privados, notas internas, preferencias individuales y gastos no autorizados. Diferenciar invitación a colaborar —autenticación y aceptación— de enlace de lectura. WhatsApp abre un mensaje redactado para que el usuario lo envíe.

La PWA guarda el shell público. Los datos personales offline requieren elección explícita, caché por usuario y limpieza al cerrar sesión o borrar cuenta. No cachear auth, APIs privadas o enlaces de invitación globalmente. Todo dato offline indica momento de sincronización; no presentar requisitos vencidos como recién revisados.

Analítica, seguridad y marketing tienen consentimientos, finalidades, permisos y retenciones separados. Presupuesto/origen se agregan o agrupan para marketing; no segmentar por nacionalidad de pasaporte, salud o condiciones de menores. La IP no es identidad personal fiable. La descarga y eliminación de cuenta incluyen datos dependientes, enlaces compartidos y archivos; las retenciones se explican cuando correspondan.

## 7. Cuotas correctas bajo concurrencia

No usar `SELECT contador → si queda cuota → llamar IA → incrementar`: dos peticiones pueden gastar el mismo cupo. Recomendación para D1: una reserva persistente creada mediante una sola sentencia condicional que cuenta consumo/reservas de esa ventana y obtiene el límite desde la configuración del servidor. Un índice único sobre usuario, métrica, ventana y clave de idempotencia evita doble consumo por reintento. Un request hash impide reutilizar la clave con otro contenido.

El estado pasa de `reserved` a `consumed` cuando el resultado está persistido, o a `released` si falla antes de producir resultado; usar operaciones condicionales y una misma transacción/batch para guardar el resultado y confirmar consumo. Reservas vencidas no deben liberarse mientras un trabajo todavía tiene una concesión de ejecución válida. El proceso de recuperación necesita su propio estado y evidencia de ejecución para no duplicar llamadas externas. Una respuesta repetida devuelve el resultado previo.

Cloudflare documenta que `D1Database.batch()` ejecuta las sentencias del lote de forma transaccional y revierte el lote si una falla. Esto permite escrituras relacionadas, pero no convierte una lectura y una escritura en peticiones separadas en una operación atómica. [Documentación de D1](https://developers.cloudflare.com/d1/worker-api/d1-database/).

Probar 20 solicitudes paralelas contra Free con límite 2: como máximo dos reservas y dos generaciones; mismo idempotency key produce una; fallo libera solo su reserva. La deduplicación y rate limit protegen también las búsquedas anónimas.

## 8. Pagos, jobs y observabilidad reales

BillingProvider entrega checkout/portal reales solo si configurado. El retorno del navegador desde checkout no activa el plan. Verificar firma sobre cuerpo original, entorno test/live, tienda, variante, vínculo al usuario y evento; persistir y deduplicar antes de aplicar la transición. Manejar eventos repetidos y fuera de orden mediante versión/fecha del objeto y reconciliación. Lemon Squeezy firma los webhooks con HMAC-SHA256 en `X-Signature`. [Documentación de firmas](https://docs.lemonsqueezy.com/help/webhooks/signing-requests).

Los trabajos independientes se disparan mediante un programador desplegado y persisten intentos, próxima ejecución, resultado y deduplicación. Un cron real de Workers usa `scheduled()` y se configura aparte del manejo de HTTP; opera en UTC. [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).

Estados de infraestructura: `not_configured`, `ready`, `degraded`, `down`, `disabled`. Mostrar salud a partir de comprobaciones reales, con fecha; no indicadores verdes basados únicamente en la presencia de una clave. La tabla de jobs presenta `pending`, `running`, `succeeded`, `failed`, `cancelled`; separar «programado» de «enviado» y de «entregado».

Eventos y costos son reales o desconocidos, nunca métricas sembradas sin DEMO. Conservar latencia, proveedor, errores normalizados, uso y costo estimado con versión de tarifa. Documentar exportación/backup y prueba de restauración; no afirmar que existe un respaldo por tener un botón.

## 9. Orden de implementación y entrega

Prioridad 0: fronteras de datos reales/DEMO, identidad, propiedad, planes/cuotas, requisitos críticos, persistencia y errores. Prioridad 1: recorrido Free completo con datos auténticos allí donde haya proveedor, colaboración, PDF, compartir y presupuesto. Prioridad 2: pagos y jobs verificables. Prioridad 3: operación editorial, adquisición y analítica. Prioridad 4: asistencia proactiva.

La entrega de cada fase debe incluir lo implementado, rutas/archivos, migraciones, variables, APIs conectadas, comportamiento real, DEMO, pendientes, riesgos y pruebas ejecutadas. Una integración no conectada puede estar arquitectónicamente preparada; no cumple por sí sola la fase comercial. Consultar la matriz de aceptación complementaria.
