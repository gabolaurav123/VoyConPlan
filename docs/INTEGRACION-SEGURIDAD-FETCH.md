# VoyConPlan — 15 aserciones de integración con fetch

Checklist acotado para la implementación inmediata: catchall API, D1, viajes con JSON y versión optimista, cuotas 2/10/30, perfiles, gastos, admin mediante identidad verificada y enlaces de lectura con token hasheado y duración de siete días. No representa resultados ya ejecutados.

## Preparación y reglas del harness

- Usar una base de pruebas aislada. Crear tres identidades mediante el mecanismo real de autenticación: **A** viajero Free, **B** otro viajero Free y **C** administrador autorizado. Para probar admin local se puede sustituir el allowlist por una identidad de prueba verificada; producción debe usar la identidad configurada en `ADMIN_EMAILS`.
- Preparar usuarios Plus y Max con derechos escritos desde fixtures de servidor, no mediante una ruta pública de cambio de plan. Cada usuario de cuota empieza con consumo cero en la ventana que se prueba.
- Definir un mapa de rutas conforme a la API real: `me`, `profile`, `trips`, `trip(id)`, `expenses(id)`, `shareCreate(id)`, `shareRead(token)`, `shareRevoke(id,shareId)`, `admin`, `requirements(id)`. Los nombres son alias del harness, no rutas nuevas que deba añadir el producto.
- `fetch` de Node no tiene cookie jar automático. Pasar una cookie de sesión real por identidad cuando el sistema autentica con cookies, o el bearer emitido realmente si ese es el contrato. Nunca inventar un header `x-user-id` para simular un login en producción.
- Para mutaciones legítimas pasar `Origin` del sitio y protección CSRF real cuando corresponda. `redirect: 'manual'` evita confundir un redirect a login con éxito. El catchall devuelve errores JSON de API coherentes, no HTML con 200.
- Las fixtures vencidas, planes, contadores, requisitos y usuarios se insertan desde el entorno de prueba. No publicar endpoints `reset`, `become-admin`, `seed` o `set-plan` para que las pruebas funcionen.
- Comparar estado antes/después de todo rechazo. Un 403/409/422 no basta si la escritura ocurrió de todas maneras. Redactar cookies, tokens y cuerpos sensibles en reportes.

## Aserciones

| ID | Peticiones fetch | Resultado obligatorio y evidencia |
|---|---|---|
| 01. Sesión obligatoria | Sin credenciales: GET perfil/listado privado, POST viaje, PATCH perfil, POST gasto, POST enlace y GET admin. Repetir con sesión inválida o vencida. | 401 JSON, sin datos ni mutación. Ninguna respuesta crea usuario admin o acepta identidad enviada en JSON/headers inventados. Las rutas públicas de descubrimiento y lectura compartida válidas se prueban aparte. |
| 02. Propiedad en cada ruta | A crea un viaje privado. B intenta GET/PATCH/DELETE de ese ID, leer/crear/borrar gastos, crear/revocar enlaces. B intenta añadir `ownerId=A`, `userId=A` o `tripId=A` en body/query. | 403 o 404 consistente, sin contenido de A. Estado y presupuesto de A idénticos antes/después. Toda ruta hija verifica propietario/membresía mediante servidor, no solo la ruta del viaje. |
| 03. Origin malicioso | Con sesión válida de A y payload válido, repetir POST/PATCH/DELETE usando `Origin: https://evil.example`. Añadir variante `https://sitio-valido.evil.example` y `Origin: null`. | 403 antes de escribir. Comparación exacta de origen permitido; no `includes`/`endsWith` vulnerable. GET público puede mantener su política independiente. Probar ausencia de Origin según contrato documentado: no debe convertirse en bypass de peticiones con cookies que requieren protección CSRF. |
| 04. Mass assignment | PATCH perfil y POST/PATCH viaje con `role: 'super_admin'`, `roles`, `permissions`, `plan: 'max'`, `subscriptionStatus: 'active'`, `ownerId`, `authSubject` y email del admin. | Rechazo de campos no editables o descarte explícito; al hacer GET `/me`, rol/plan/propietario/identidad siguen siendo los originales. GET admin sigue prohibido. El cambio de email editable de perfil nunca modifica la identidad que autoriza admin. |
| 05. Allowlist admin verificado | B solicita API admin; también envía `email` del allowlist en body, query y headers no autenticados. C con identidad verificada solicita el dashboard. Sin sesión probar el mismo email. | B y anónimo siguen denegados; C obtiene 200 según permiso. El primer registro no adquiere admin. El allowlist se compara contra identidad verificada del proveedor, no contra un perfil mutable ni un email declarado por cliente. Probar email con dominio sufijado y espacios internos como denegado. |
| 06. Perfil persistente y aislado | A PATCH un campo permitido; A hace GET con nueva petición y sesión. B hace GET de su perfil y repite la escritura con ID de A en body/query. | A conserva su cambio; B no observa ni cambia datos de A. Tipo/rango/longitud inválidos producen 400/422 sin escritura parcial. Un formulario vacío no borra campos privados accidentalmente. |
| 07. Gastos y totales íntegros | A registra un gasto válido con importe entero en unidades menores y moneda válida. Leer lista y presupuesto. Probar string numérico, negativo no permitido, fracción de unidad menor, `null`, entero inseguro, moneda no válida y viaje de B. | El válido persiste una vez y actualiza el total según moneda/política. Inválidos 400/422, ajenos 403/404; no aparecen importes `NaN`, conversiones implícitas ni aumentos de total tras rechazo. Si se admiten reembolsos, su tipo explícito sustituye a «aceptar negativos arbitrarios». |
| 08. Conflicto optimista | Leer viaje A en versión v. Enviar simultáneamente dos PATCH distintos, ambos con versión v. Volver a leer. | Exactamente uno tiene éxito y el otro 409. La versión final es v+1 y el contenido corresponde íntegramente al ganador, sin combinar accidentalmente objetos ni perder silenciosamente cambios. Versión ausente o inválida se rechaza según contrato; no omite la protección. |
| 09. Cuotas concurrentes | Con fixture Free de consumo cero lanzar 20 POST de creación válidos en paralelo y claves de operación distintas. Repetir Plus con 20 frente a límite 10 y Max con 40 frente a 30 en base de prueba. | Éxitos exactamente 2/10/30 si no existen otros límites ni fallos deliberados; nunca más. El resto devuelve código documentado de cuota, por ejemplo 429 con `QUOTA_EXCEEDED`. Recuento persistido y consumo coinciden; ningún viaje huérfano creado fuera del cupo. Si rate limit interfiere, aislarlo en esta prueba, no interpretar menos éxitos como prueba suficiente. |
| 10. Reintentos idempotentes | Lanzar diez POST simultáneos con mismo usuario, payload y `Idempotency-Key`. Repetir después de recibir respuesta. Después reutilizar la clave con payload distinto. | Un solo viaje y un solo cupo consumido; las respuestas exitosas señalan el mismo ID. Payload distinto con clave existente se rechaza 409/422. Si la implementación aún no admite idempotencia, marcar este caso pendiente explícito; no declarar robustez ante reintentos. |
| 11. Emisión de enlaces restringida | A crea enlace de su viaje; B intenta crear uno del viaje de A; anónimo intenta igual. A envía duración arbitraria, `expiresAt` futuro lejano o `scope:'write'`. | Solo A recibe enlace válido; duración máxima siete días calculada en servidor; los campos de expiración/permiso del cliente se rechazan o se ignoran. B/anónimo no generan registros. El token tiene entropía criptográfica suficiente comprobada por código, no por apariencia de string. |
| 12. Proyección compartida y secretos | Introducir en fixture A campos centinela: email privado, código de reserva, notas privadas, preferencias individuales, identificador de propietario, token hash. Crear enlace y leerlo sin sesión. Enumerar todas las claves y buscar centinelas recursivamente. | 200 con allowlist explícita de solo lectura; ninguno de los centinelas ni `tokenHash`/secrets aparece. El token claro puede devolverse al propietario al emitir el enlace; nunca devolver hashes. Añadir una nueva clave privada a la fixture no debe filtrarla por copia genérica del JSON. `Cache-Control` evita caché pública sensible y la política de referrer evita propagar token a terceros. |
| 13. Enlace estrictamente de lectura | Sin sesión, usar token válido en PATCH/POST/DELETE de la ruta compartida y en rutas privadas de viaje/gastos/perfil. Probar token como query/header/body de autorización. | 401/403/405 y ninguna mutación. El token no equivale a usuario ni a miembro. Token inválido no devuelve detalle del viaje ni pistas sobre propietario. |
| 14. Revocación y siete días | Leer enlace válido; A revoca; volver a GET, incluso con cabeceras condicionales. Crear fixture con expiración anterior a la hora del servidor; leerla. B intenta revocar el enlace de A. | Revocado/vencido responde 404/410 sin datos; B denegado y enlace permanece válido hasta que A lo revoca. La validación de expiración se ejecuta en toda lectura, aunque no haya job de limpieza. La respuesta no reaparece desde caché tras revocación. |
| 15. Requisitos sin falsa autorización | Para A Free preparar tres casos: proveedor no conectado, snapshot vencido y requisito crítico confirmado por fixture de fuente. Leer requisitos, viaje, vista compartida y exportación serializada si existe. Repetir con Plus/Max. | No conectado/vencido muestra `unknown`/`stale`, origen/fecha reales y verificación pendiente; nunca `cleared`, `visaNotRequired`, `readyToTravel` o «comprobado ahora» inventados. El crítico confirmado conserva existencia, acción esencial y fuente en Free. DEMO sigue marcado en todos los canales. Cambiar el plan no oculta el problema ni elimina su severidad. |

## Patrones de código para las pruebas

Ejemplos que deben conectarse a las rutas y fixtures reales. No crean un protocolo alternativo de autenticación.

```js
import assert from 'node:assert/strict';

const base = process.env.TEST_BASE_URL;
const origin = new URL(base).origin;

async function api(path, { sessionCookie, method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(new URL(path, base), {
    method,
    redirect: 'manual',
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(sessionCookie ? { Cookie: sessionCookie } : {}),
      ...(method === 'GET' ? {} : { Origin: origin }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const raw = await res.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = { nonJson: true }; }
  return { status: res.status, ok: res.ok, headers: res.headers, data };
}

// fixtures y routes se definen según la implementación real.
const before = await api(routes.trip(fixtures.tripA), { sessionCookie: fixtures.cookieA });
const denied = await api(routes.trip(fixtures.tripA), {
  sessionCookie: fixtures.cookieA, method: 'PATCH',
  body: { version: before.data.version, title: 'MUTACION_NO_AUTORIZADA' },
  headers: { Origin: 'https://evil.example' },
});
assert.equal(denied.status, 403);
const after = await api(routes.trip(fixtures.tripA), { sessionCookie: fixtures.cookieA });
assert.deepEqual(after.data, before.data);
```

Adaptar comparación de respuestas si hay timestamps de lectura, IDs de petición o metadatos dinámicos: comparar datos persistidos, no campos volátiles. Si la app usa protección CSRF por token, el helper debe obtener y enviar el token real para las mutaciones autorizadas.

```js
// Conflicto optimista: la fixture parte de una versión conocida.
const results = await Promise.all([
  api(routes.trip(fixtures.tripA), {
    sessionCookie: fixtures.cookieA, method: 'PATCH',
    body: { version: fixtures.version, title: 'CAMBIO_A' },
  }),
  api(routes.trip(fixtures.tripA), {
    sessionCookie: fixtures.cookieA, method: 'PATCH',
    body: { version: fixtures.version, title: 'CAMBIO_B' },
  }),
]);
assert.equal(results.filter(x => x.ok).length, 1);
assert.equal(results.filter(x => x.status === 409).length, 1);

// Cuota: rutas, payload y cuenta freshFree pertenecen a la base de pruebas.
const creates = await Promise.all(Array.from({ length: 20 }, (_, i) =>
  api(routes.trips, {
    sessionCookie: fixtures.freshFreeCookie,
    method: 'POST',
    headers: { 'Idempotency-Key': `quota-run-${fixtures.runId}-${i}` },
    body: fixtures.validTrip({ title: `Cuota ${i}` }),
  })
));
assert.equal(creates.filter(x => x.ok).length, 2);
assert.equal(creates.filter(x => x.data.code === 'QUOTA_EXCEEDED').length, 18);
// Comprobar además listado persistido y contador; no deducirlos solo del HTTP.
```

## Límites de lo que fetch puede demostrar

Fetch demuestra fronteras HTTP, rechazo de mutaciones, persistencia observable, exclusión de campos, cuotas y conflictos. **No demuestra por sí solo** que D1 almacene únicamente el hash del token, que el generador use un CSPRNG, que los secrets estén ausentes del bundle o que la transacción esté bien construida en todos sus caminos de error. Esas cuatro garantías requieren revisión de código y/o lectura de la base de pruebas.

Revisión complementaria acotada: verificar generación con Web Crypto, hash antes de INSERT y ausencia de token claro en DB/logs; `UPDATE ... WHERE version = ?` con recuento de filas afectadas; reserva/cuota y creación atómicas; consultas de recursos con identidad del servidor; allowlist admin ligado a identidad verificada. Ninguna prueba debe introducir acceso especial público para inspeccionar estas garantías.
