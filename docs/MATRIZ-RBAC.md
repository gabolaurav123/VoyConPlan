# VoyConPlan — permisos de servidor

Propuesta inicial basada en el alcance. Aplicar denegación por defecto y permisos por acción; los roles son agrupaciones editables y no reemplazan las comprobaciones de propiedad del recurso.

Leyenda: **S** permitido; **L** lectura limitada; **E** requiere permiso especial explícito y auditoría; **—** denegado. Super Admin también registra accesos sensibles.

| Acción | Super Admin | Administrador | Marketing | Contenido | Soporte | Finanzas | Analítica | Solo lectura |
|---|---|---|---|---|---|---|---|---|
| Dashboard agregado | S | S | L | L | L | L | S | L |
| Identidad/contacto de usuarios | S | S | L consentido | — | L | L facturación | — | — |
| Suspender/reactivar usuario | S | S | — | — | E | — | — | — |
| Leer viaje privado | E | E | — | — | E por ticket | — | — | — |
| Cambiar plan manualmente | S | E | — | — | — | E | — | — |
| Editar planes/precios/límites | S | E | — | — | — | E | — | — |
| Ver ingresos y suscripciones | S | S | L agregado | — | L estado | S | L agregado | L agregado |
| Gestionar reembolsos reales | S | E | — | — | — | E | — | — |
| Crear promociones/cupones | S | S | S | — | — | E | — | — |
| CMS, noticias, destinos, SEO | S | S | L | S | — | — | — | L público |
| Multimedia y generación IA | S | S | S con cuota | S con cuota | — | — | — | L publicado |
| Campañas y segmentos | S | S | S | — | — | — | L agregado | — |
| Enviar campaña/prueba | S | E | E | — | — | — | — | — |
| Leads individuales consentidos | S | S | S | — | — | — | L seudónimo | — |
| Embudos/cohortes agregados | S | S | S | L | L | L | S | L |
| IP completa de seguridad | E | E | — | — | — | — | — | — |
| Soporte/notas internas | S | S | — | — | S | L pagos | — | — |
| Exportar datos | E | E | E marketing | E contenido | E ticket | E finanzas | E agregado | — |
| Provider health/costos | S | S | — | — | L salud | L costos | L agregado | L salud |
| Configurar proveedores/prompts | S | E | — | — | — | — | — | — |
| Leer/editar secretos reales | E fuera de UI | — | — | — | — | — | — | — |
| Roles/permisos/propietario | S | — | — | — | — | — | — | — |
| Auditoría | S | E | — | — | L propia | L financiera | — | — |

Los secretos se introducen en el gestor seguro del despliegue; la aplicación puede mostrar si están configurados, nunca su valor completo. Los cambios de rol requieren identidad existente y verificada, sesión administrativa válida y registro de antes/después.

## Permisos del viaje

| Acción | Invitado temporal | Propietario | Editor aceptado | Lector autenticado | Enlace público |
|---|---|---|---|---|---|
| Explorar destino | Sí | Sí | Sí | Sí | Solo vista compartida |
| Guardar viaje persistente | Registro requerido | Sí | Según membresía | No | No |
| Editar itinerario/presupuesto | Local temporal | Sí | Sí | No | No |
| Editar preferencias individuales | Local propio | Propias | Propias | Propias si procede | No |
| Invitar/expulsar miembros | No | Sí, según cuota | No por defecto | No | No |
| Crear/revocar enlace público | No | Sí | No por defecto | No | No |
| Ver código de reserva/documentos | No | Sí | Solo acceso explícito | No por defecto | Nunca |
| Borrar viaje | Local | Sí | No | No | No |
| Ver requisito crítico | Sí cuando disponible | Siempre | Siempre | Siempre | Si incluido en vista segura |

La incorporación por enlace consume la invitación de manera idempotente, valida vencimiento/revocación y requiere aceptación. Una invitación para una persona específica valida identidad; un enlace genérico transferible informa esa propiedad antes de crearlo. No revela información privada antes de aceptar.

Pruebas obligatorias: usuario B no lee ni modifica viaje de A cambiando ID; editor no cambia roles; Marketing no exporta pasaportes/IP; enlace revocado deja de funcionar; plan Free no puede alterar entitlement desde navegador; ningún login público obtiene rol administrativo.
