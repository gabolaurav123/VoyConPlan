# VoyConPlan — arquitectura previa
React + TypeScript + Vinext, Cloudflare Worker, D1, identidad verificada por Sites. Publicación inicial privada. El acceso administrativo corresponde exclusivamente a la lista de correos configurada en servidor.
## Flujo
Invitado → origen, presupuesto, fechas, viajeros, preferencias → descubrimiento determinista → comparación → viaje. Guardar, compartir y colaborar requieren identidad. El catálogo DEMO nunca representa ofertas reales.
## Datos
Users, profiles, trips, members, preferences, expenses, itinerary, checklist, share_links, destinations, plans, subscriptions, usage, consented events, content, promotions, coupons, support, providers, audit, settings. Consultas parametrizadas. Control de versión y propiedad. Tokens aleatorios revocables con expiración.
## Providers
FlightSearch, Accommodation, Places, Activity, Routes, Requirements, Currency, Weather, AI, Billing, Affiliate, Notification, Images, Analytics. Respuesta con estado, fuente, fecha y expiración. Sin integración: no conectado. Nunca se infieren visas, precios confirmados ni disponibilidad.
## Planes y permisos
Free 0 USD, Plus 2.99 USD, Max 4.99 USD; valores configurables en DB. Requisitos críticos disponibles en todos. Roles y planes no se aceptan del cliente. Nada de convertir el primer registro en admin. Cuotas actualizadas atómicamente.
## Diseño y componentes
Tinta verde oscura, lima, blanco. Fotografía editorial, tipografía legible, controles shadcn accesibles. Descubrimiento como superficie principal, espacio de viaje por pestañas, administración con navegación lateral, estados de carga/error/vacío y diseño móvil.
## Fases
1 Fundación: auth, DB, permisos, marca, planes, administración.
2 Viaje: discovery, comparación, persistencia, gastos, checklist, itinerario, exportación y compartir.
3 Monetización: billing skeleton; pagos reales dependen de cuenta y webhooks.
4 Operaciones: CMS, promociones, soporte, eventos.
5 Asistencia: PWA; jobs reales pendientes de scheduler y providers.
La entrega distinguirá implementado, DEMO, preparado y pendiente. No se declarará comercialmente completo sin cubrir todas las fases y sus pruebas.