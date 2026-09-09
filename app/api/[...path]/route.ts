import {
  db,
  initialize,
  currentUser,
  permit,
  getTrip,
  log,
  id,
  now,
  hash,
  runtime,
  ApiError,
  rateLimit,
  body,
} from '@/lib/server';
import {
  validateSearch,
  discover,
  createTrip,
  validateTrip,
  sharedProjection,
  validNumber,
  preferenceMatches,
} from '@/lib/domain';
import {
  providerList,
  essentialRequirements,
  unavailable,
} from '@/lib/providers';
export const dynamic = 'force-dynamic';
const out = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
const clean = (v: any, max = 1000) =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';
async function handle(req: Request) {
  try {
    await initialize();
    await rateLimit(req);
    const url = new URL(req.url),
      p = url.pathname.slice(5).split('/'),
      method = req.method;
    const data = method === 'GET' ? null : await body(req);
    if (p[0] === 'bootstrap' && method === 'GET') {
      const user = await currentUser();
      const ds = await db()
        .prepare('SELECT data FROM destinations WHERE hidden=0')
        .all();
      const plans = await db()
        .prepare('SELECT * FROM plans ORDER BY price')
        .all();
      return out({
        user,
        destinations: ds.results.map((d: any) => JSON.parse(d.data)),
        plans: plans.results.map((p: any) => ({
          ...p,
          features: JSON.parse(p.features),
        })),
        providers: providerList.map(([name, provider]) => ({
          name,
          provider,
          status:
            name === 'Analytics'
              ? 'Eventos con consentimiento'
              : 'No conectado',
        })),
      });
    }
    if (p[0] === 'discover' && method === 'POST') {
      const s = validateSearch(data);
      const ds = await db()
        .prepare('SELECT data FROM destinations WHERE hidden=0')
        .all();
      return out({
        results: discover(
          ds.results.map((d: any) => JSON.parse(d.data)),
          s,
        ),
        search: s,
        mode: 'demo',
      });
    }
    if (p[0] === 'requirements') {
      return out({
        status: 'unknown',
        items: essentialRequirements(),
        checkedAt: null,
        notice:
          'La información puede cambiar. Comprueba siempre los requisitos oficiales antes de viajar. No se ha efectuado una consulta migratoria.',
      });
    }
    if (p[0] === 'provider') {
      return out(unavailable(p[1] || 'Proveedor'), 503);
    }
    if (p[0] === 'content' && method === 'GET') {
      const rows = await db()
        .prepare(
          'SELECT id,kind,slug,title,summary,body,created_at FROM content WHERE status=? ORDER BY created_at DESC LIMIT 100',
        )
        .bind('Publicado')
        .all();
      return out(rows.results);
    }
    if (p[0] === 'share' && method === 'GET') {
      const row: any = await db()
        .prepare(
          'SELECT s.*,t.data FROM share_links s JOIN trips t ON t.id=s.trip_id WHERE s.hash=? AND s.revoked=0 AND s.expires_at>?',
        )
        .bind(await hash(p[1] || ''), now())
        .first();
      if (!row)
        throw new ApiError(404, 'El enlace no existe, venció o fue revocado.');
      if (row.kind === 'invite')
        return out({ kind: 'invite', expiresAt: row.expires_at });
      return out({
        kind: 'read',
        trip: sharedProjection(JSON.parse(row.data)),
        expiresAt: row.expires_at,
      });
    }
    if (p[0] === 'events' && method === 'POST') {
      if (data.consent !== true)
        throw new ApiError(403, 'La analítica requiere consentimiento.');
      if (
        ![
          'landing_view',
          'search_started',
          'destination_results',
          'destination_selected',
          'trip_created',
          'pdf_export',
          'share',
          'requirements_view',
          'pricing_view',
        ].includes(data.name)
      )
        throw new ApiError(400, 'Evento no admitido.');
      await db()
        .prepare(
          'INSERT INTO events(id,name,session_id,created_at) VALUES (?,?,?,?)',
        )
        .bind(id(), data.name, await hash(clean(data.sessionId, 100)), now())
        .run();
      return out({ saved: true });
    }
    const user: any = await currentUser(true);
    if (p[0] === 'me' && method === 'PATCH') {
      const profile = {
        interests: Array.isArray(data.interests)
          ? data.interests.map((x: any) => clean(x, 40)).slice(0, 12)
          : [],
        pace: clean(data.pace, 40),
        accommodation: clean(data.accommodation, 40),
        budget: validNumber(data.budget || 1000, 50, 1000000),
        analytics: !!data.analytics,
        marketing: !!data.marketing,
      };
      await db()
        .prepare('UPDATE users SET name=?,profile=? WHERE id=?')
        .bind(
          clean(data.name, 80) || user.name,
          JSON.stringify(profile),
          user.id,
        )
        .run();
      return out({ saved: true });
    }
    if (p[0] === 'me' && method === 'DELETE') {
      if (data.confirm !== 'ELIMINAR')
        throw new ApiError(400, 'Escribe ELIMINAR para confirmar.');
      await db().batch([
        db().prepare('DELETE FROM records WHERE owner_id=?').bind(user.id),
        db().prepare('DELETE FROM users WHERE id=?').bind(user.id),
      ]);
      return out({ deleted: true });
    }
    if (p[0] === 'export' && method === 'GET') {
      const trips = await db()
        .prepare('SELECT * FROM trips WHERE owner_id=?')
        .bind(user.id)
        .all();
      const fav = await db()
        .prepare('SELECT destination_id FROM favorites WHERE user_id=?')
        .bind(user.id)
        .all();
      return out({
        user,
        trips: trips.results.map((t: any) => ({
          ...t,
          data: JSON.parse(t.data),
        })),
        favorites: fav.results,
        exportedAt: now(),
      });
    }
    if (p[0] === 'favorites') {
      if (method === 'GET')
        return out(
          (
            await db()
              .prepare('SELECT destination_id FROM favorites WHERE user_id=?')
              .bind(user.id)
              .all()
          ).results.map((r: any) => r.destination_id),
        );
      const dest = await db()
        .prepare('SELECT id FROM destinations WHERE id=?')
        .bind(clean(data.destinationId, 80))
        .first();
      if (!dest) throw new ApiError(404, 'Destino no disponible.');
      if (method === 'POST')
        await db()
          .prepare(
            'INSERT OR IGNORE INTO favorites(id,user_id,destination_id) VALUES (?,?,?)',
          )
          .bind(user.id + ':' + data.destinationId, user.id, data.destinationId)
          .run();
      else
        await db()
          .prepare('DELETE FROM favorites WHERE user_id=? AND destination_id=?')
          .bind(user.id, data.destinationId)
          .run();
      return out({ saved: true });
    }
    if (p[0] === 'trips' && !p[1] && method === 'GET') {
      return out(
        (
          await db()
            .prepare(
              'SELECT * FROM trips WHERE owner_id=? OR EXISTS(SELECT 1 FROM members WHERE trip_id=trips.id AND user_id=?) ORDER BY updated_at DESC',
            )
            .bind(user.id, user.id)
            .all()
        ).results.map((t: any) => ({ ...t, data: JSON.parse(t.data) })),
      );
    }
    if (p[0] === 'trips' && !p[1] && method === 'POST') {
      const s = validateSearch(data.search);
      const requestKey = req.headers.get('idempotency-key') || data.requestId;
      if (
        typeof requestKey !== 'string' ||
        !/^[a-zA-Z0-9-]{16,100}$/.test(requestKey)
      )
        throw new ApiError(400, 'Se requiere una clave de creación válida.');
      const tripId = await hash('trip:' + user.id + ':' + requestKey),
        requestId = 'request:' + tripId,
        requestHash = await hash(
          JSON.stringify({ destinationId: data.destinationId, search: s }),
        );
      const existing: any = await db()
        .prepare('SELECT data FROM records WHERE id=? AND owner_id=?')
        .bind(requestId, user.id)
        .first();
      if (existing) {
        if (JSON.parse(existing.data).requestHash !== requestHash)
          throw new ApiError(
            409,
            'Esta clave de creación pertenece a otra solicitud.',
          );
        return out(await getTrip(tripId, user));
      }
      const dest: any = await db()
        .prepare('SELECT data FROM destinations WHERE id=? AND hidden=0')
        .bind(clean(data.destinationId, 80))
        .first();
      if (!dest) throw new ApiError(404, 'Destino no disponible.');
      const plan: any = await db()
        .prepare('SELECT * FROM plans WHERE id=?')
        .bind(user.plan)
        .first();
      const key = user.id + ':' + now().slice(0, 7),
        trip = createTrip(JSON.parse(dest.data), s);
      await db().batch([
        db()
          .prepare(
            'INSERT OR IGNORE INTO usage(id,user_id,used) VALUES (?,?,0)',
          )
          .bind(key, user.id),
        db()
          .prepare(
            'INSERT OR IGNORE INTO trips(id,owner_id,data,created_at,updated_at) SELECT ?,?,?,?,? WHERE (SELECT used FROM usage WHERE id=?)<?',
          )
          .bind(
            tripId,
            user.id,
            JSON.stringify(trip),
            now(),
            now(),
            key,
            plan.trip_limit,
          ),
        db()
          .prepare(
            'UPDATE usage SET used=used+1 WHERE id=? AND EXISTS(SELECT 1 FROM trips WHERE id=?) AND NOT EXISTS(SELECT 1 FROM records WHERE id=?)',
          )
          .bind(key, tripId, requestId),
        db()
          .prepare(
            'INSERT OR IGNORE INTO records(id,kind,owner_id,data,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM trips WHERE id=?)',
          )
          .bind(
            requestId,
            'create_request',
            user.id,
            JSON.stringify({ requestHash, tripId }),
            now(),
            tripId,
          ),
      ]);
      const persisted: any = await db()
        .prepare('SELECT data FROM records WHERE id=?')
        .bind(requestId)
        .first();
      if (!persisted)
        throw new ApiError(
          429,
          'Alcanzaste el límite mensual de ' +
            plan.trip_limit +
            ' viajes de tu plan. Tus viajes existentes siguen disponibles.',
        );
      if (JSON.parse(persisted.data).requestHash !== requestHash)
        throw new ApiError(
          409,
          'Esta clave de creación pertenece a otra solicitud.',
        );
      return out(await getTrip(tripId, user), 201);
    }
    if (p[0] === 'trips' && p[1]) {
      const t = await getTrip(
        p[1],
        user,
        ['DELETE'].includes(method) || ['share', 'links'].includes(p[2]),
      );
      if (!p[2] && method === 'GET') {
        const m = await db()
          .prepare(
            'SELECT m.user_id,m.preferences,u.name FROM members m JOIN users u ON u.id=m.user_id WHERE trip_id=?',
          )
          .bind(t.id)
          .all();
        const owner: any = await db()
          .prepare('SELECT name FROM users WHERE id=?')
          .bind(t.owner_id)
          .first();
        return out({
          ...t,
          members: m.results.map((x: any) => ({
            ...x,
            preferences: JSON.parse(x.preferences),
          })),
          ownerName: owner.name,
          isOwner: t.owner_id === user.id,
        });
      }
      if (!p[2] && method === 'PATCH') {
        const safe = validateTrip(data.data);
        safe.provenance = t.data.provenance;
        if (safe.destinationId !== t.data.destinationId)
          throw new ApiError(
            400,
            'No puedes cambiar el destino de un viaje existente.',
          );
        const version = validNumber(data.version, 1, 100000, true);
        const result = await db()
          .prepare(
            'UPDATE trips SET data=?,version=version+1,updated_at=? WHERE id=? AND version=?',
          )
          .bind(JSON.stringify(safe), now(), t.id, version)
          .run();
        if (!result.meta.changes)
          throw new ApiError(
            409,
            'Este viaje cambió en otra sesión. Recarga antes de volver a guardar.',
          );
        return out({ saved: true, version: version + 1, data: safe });
      }
      if (!p[2] && method === 'DELETE') {
        await db().prepare('DELETE FROM trips WHERE id=?').bind(t.id).run();
        return out({ deleted: true });
      }
      if (p[2] === 'share' && method === 'POST') {
        const token = id().replaceAll('-', '') + id().replaceAll('-', ''),
          linkId = id(),
          kind = data.kind === 'invite' ? 'invite' : 'read';
        const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
        await db()
          .prepare(
            'INSERT INTO share_links(id,trip_id,hash,kind,expires_at,created_at) VALUES (?,?,?,?,?,?)',
          )
          .bind(linkId, t.id, await hash(token), kind, expiresAt, now())
          .run();
        return out({
          id: linkId,
          url: (runtime.APP_ORIGIN || url.origin) + '/compartir/' + token,
          expiresAt,
          kind,
        });
      }
      if (p[2] === 'links') {
        if (method === 'GET')
          return out(
            (
              await db()
                .prepare(
                  'SELECT id,kind,expires_at,revoked FROM share_links WHERE trip_id=? ORDER BY created_at DESC',
                )
                .bind(t.id)
                .all()
            ).results,
          );
        await db()
          .prepare('UPDATE share_links SET revoked=1 WHERE id=? AND trip_id=?')
          .bind(clean(data.id, 80), t.id)
          .run();
        return out({ revoked: true });
      }
      if (p[2] === 'preferences' && method === 'POST') {
        const pref = Object.fromEntries(
          Object.entries(data.preferences || {}).filter(
            ([k, v]) =>
              [
                'Playa',
                'Cultura',
                'Naturaleza',
                'Gastronomía',
                'Aventura',
                'Compras',
                'Vida nocturna',
                'Descanso',
              ].includes(k) &&
              ['Me gusta', 'Neutral', 'Evitar', 'Imprescindible'].includes(
                String(v),
              ),
          ),
        );
        await db()
          .prepare(
            'INSERT INTO members(id,trip_id,user_id,preferences) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET preferences=excluded.preferences',
          )
          .bind(t.id + ':' + user.id, t.id, user.id, JSON.stringify(pref))
          .run();
        return out({ saved: true });
      }
    }
    if (p[0] === 'accept' && method === 'POST') {
      const row: any = await db()
        .prepare(
          'SELECT * FROM share_links WHERE hash=? AND kind=? AND revoked=0 AND expires_at>?',
        )
        .bind(await hash(clean(data.token, 200)), 'invite', now())
        .first();
      if (!row) throw new ApiError(404, 'La invitación no está disponible.');
      const trip: any = await db()
        .prepare(
          'SELECT t.owner_id,p.collaborators FROM trips t JOIN users u ON u.id=t.owner_id JOIN plans p ON p.id=u.plan WHERE t.id=?',
        )
        .bind(row.trip_id)
        .first();
      if (trip.owner_id === user.id) return out({ tripId: row.trip_id });
      if (row.claimed_by && row.claimed_by !== user.id)
        throw new ApiError(410, 'Esta invitación ya fue utilizada.');
      await db().batch([
        db()
          .prepare(
            'INSERT OR IGNORE INTO members(id,trip_id,user_id,preferences) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM members WHERE trip_id=? AND user_id<>?)<? AND EXISTS(SELECT 1 FROM share_links WHERE id=? AND revoked=0 AND julianday(expires_at)>julianday() AND (claimed_by IS NULL OR claimed_by=?))',
          )
          .bind(
            row.trip_id + ':' + user.id,
            row.trip_id,
            user.id,
            '{}',
            row.trip_id,
            trip.owner_id,
            trip.collaborators,
            row.id,
            user.id,
          ),
        db()
          .prepare(
            'UPDATE share_links SET claimed_by=? WHERE id=? AND EXISTS(SELECT 1 FROM members WHERE id=?) AND (claimed_by IS NULL OR claimed_by=?)',
          )
          .bind(user.id, row.id, row.trip_id + ':' + user.id, user.id),
      ]);
      if (
        !(await db()
          .prepare('SELECT id FROM members WHERE id=?')
          .bind(row.trip_id + ':' + user.id)
          .first())
      )
        throw new ApiError(
          409,
          'No quedan plazas o la invitación fue utilizada.',
        );
      return out({ tripId: row.trip_id });
    }
    if (p[0] === 'support') {
      if (method === 'GET')
        return out(
          (
            await db()
              .prepare(
                'SELECT * FROM records WHERE kind=? AND owner_id=? ORDER BY created_at DESC',
              )
              .bind('support', user.id)
              .all()
          ).results.map((r: any) => ({ ...r, data: JSON.parse(r.data) })),
        );
      const title = clean(data.title, 120),
        message = clean(data.message, 3000);
      if (!title || !message)
        throw new ApiError(400, 'Completa el asunto y el mensaje.');
      await db()
        .prepare(
          'INSERT INTO records(id,kind,owner_id,data,created_at) VALUES (?,?,?,?,?)',
        )
        .bind(
          id(),
          'support',
          user.id,
          JSON.stringify({ title, message, status: 'Nuevo' }),
          now(),
        )
        .run();
      return out({ saved: true });
    }
    if (p[0] === 'admin') {
      const section = p[1] || 'overview';
      permit(user, section);
      if (section === 'overview') {
        const queries = [
          'SELECT COUNT(*) as value FROM users',
          'SELECT COUNT(*) as value FROM trips',
          "SELECT COUNT(*) as value FROM content WHERE status='Publicado'",
          'SELECT COUNT(*) as value FROM events',
        ];
        const counts: any = await db().batch(
          queries.map((q) => db().prepare(q)),
        );
        const usage = (
          await db()
            .prepare('SELECT plan,COUNT(*) as total FROM users GROUP BY plan')
            .all()
        ).results;
        return out({
          users: counts[0].results[0].value,
          trips: counts[1].results[0].value,
          posts: counts[2].results[0].value,
          events: counts[3].results[0].value,
          revenue: null,
          usage,
          providersConnected: 0,
        });
      }
      if (section === 'users') {
        if (method === 'GET') {
          await log(user, 'users.read', 'users');
          return out(
            (
              await db()
                .prepare(
                  'SELECT id,email,name,plan,role,suspended,created_at FROM users ORDER BY created_at DESC LIMIT 200',
                )
                .all()
            ).results,
          );
        }
        permit(user, '*');
        const target: any = await db()
          .prepare('SELECT * FROM users WHERE id=?')
          .bind(clean(data.id, 100))
          .first();
        if (!target) throw new ApiError(404, 'Usuario no encontrado.');
        if (
          String(runtime.ADMIN_EMAILS || '')
            .toLowerCase()
            .split(',')
            .map((v) => v.trim())
            .includes(target.email.toLowerCase())
        )
          throw new ApiError(
            400,
            'La cuenta propietaria se gestiona en configuración segura.',
          );
        const role = [
          'user',
          'admin',
          'marketing',
          'content',
          'support',
          'finance',
          'analytics',
          'readonly',
        ].includes(data.role)
          ? data.role
          : target.role;
        await db()
          .prepare('UPDATE users SET role=?,suspended=? WHERE id=?')
          .bind(role, data.suspended ? 1 : 0, target.id)
          .run();
        await log(user, 'user.permissions.updated', target.id);
        return out({ saved: true });
      }
      if (section === 'plans') {
        if (method === 'GET')
          return out(
            (await db().prepare('SELECT * FROM plans ORDER BY price').all())
              .results,
          );
        if (!['Free', 'Plus', 'Max'].includes(data.id))
          throw new ApiError(400, 'Plan inválido.');
        await db()
          .prepare(
            'UPDATE plans SET price=?,trip_limit=?,collaborators=? WHERE id=?',
          )
          .bind(
            data.id === 'Free' ? 0 : validNumber(data.price, 0, 100000, true),
            validNumber(data.trip_limit, 1, 100, true),
            validNumber(data.collaborators, 1, 20, true),
            data.id,
          )
          .run();
        await log(user, 'plan.updated', data.id);
        return out({ saved: true });
      }
      if (section === 'content') {
        if (method === 'GET')
          return out(
            (
              await db()
                .prepare(
                  'SELECT * FROM content ORDER BY updated_at DESC LIMIT 200',
                )
                .all()
            ).results,
          );
        if (method === 'DELETE') {
          await db()
            .prepare('DELETE FROM content WHERE id=?')
            .bind(clean(data.id, 80))
            .run();
          await log(user, 'content.deleted', data.id);
          return out({ saved: true });
        }
        const postId = clean(data.id, 80) || id(),
          title = clean(data.title, 180),
          slug = clean(data.slug, 180);
        if (!title || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
          throw new ApiError(
            400,
            'Usa un título y un slug con letras minúsculas y guiones.',
          );
        if (!['Post', 'Noticia', 'Guía', 'FAQ', 'Página'].includes(data.kind))
          throw new ApiError(400, 'Tipo inválido.');
        await db()
          .prepare(
            'INSERT INTO content(id,kind,slug,title,summary,body,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,slug=excluded.slug,title=excluded.title,summary=excluded.summary,body=excluded.body,status=excluded.status,updated_at=excluded.updated_at',
          )
          .bind(
            postId,
            data.kind,
            slug,
            title,
            clean(data.summary, 400),
            clean(data.body, 15000),
            data.status === 'Publicado' ? 'Publicado' : 'Borrador',
            now(),
            now(),
          )
          .run();
        await log(user, 'content.saved', postId);
        return out({ saved: true, id: postId });
      }
      if (section === 'destinations') {
        if (method === 'GET')
          return out(
            (
              await db().prepare('SELECT * FROM destinations').all()
            ).results.map((d: any) => ({ ...d, data: JSON.parse(d.data) })),
          );
        const dest: any = await db()
          .prepare('SELECT * FROM destinations WHERE id=?')
          .bind(clean(data.id, 80))
          .first();
        if (!dest) throw new ApiError(404, 'Destino no encontrado.');
        const value = JSON.parse(dest.data);
        value.description = clean(data.description, 600) || value.description;
        await db()
          .prepare('UPDATE destinations SET hidden=?,data=? WHERE id=?')
          .bind(data.hidden ? 1 : 0, JSON.stringify(value), dest.id)
          .run();
        await log(user, 'destination.updated', dest.id);
        return out({ saved: true });
      }
      if (section === 'providers')
        return out(
          providerList.map(([name, provider]) => ({
            name,
            provider,
            status:
              name === 'Analytics'
                ? 'Eventos propios disponibles'
                : 'No conectado',
            lastCheck: null,
            latency: null,
            cost: null,
          })),
        );
      if (section === 'audit')
        return out(
          (
            await db()
              .prepare(
                'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 200',
              )
              .all()
          ).results,
        );
      if (section === 'analytics')
        return out({
          events: (
            await db()
              .prepare(
                'SELECT name,COUNT(*) as total FROM events GROUP BY name ORDER BY total DESC',
              )
              .all()
          ).results,
          daily: (
            await db()
              .prepare(
                'SELECT substr(created_at,1,10) as day,COUNT(*) as total FROM events GROUP BY day ORDER BY day DESC LIMIT 30',
              )
              .all()
          ).results,
        });
      if (section === 'finance')
        return out({
          status: 'No conectado',
          revenue: null,
          mrr: null,
          arr: null,
          cost: null,
        });
      if (['promotions', 'coupons', 'support', 'settings'].includes(section)) {
        if (method === 'GET')
          return out(
            (
              await db()
                .prepare(
                  'SELECT * FROM records WHERE kind=? ORDER BY created_at DESC LIMIT 200',
                )
                .bind(section)
                .all()
            ).results.map((r: any) => ({ ...r, data: JSON.parse(r.data) })),
          );
        const recordId = clean(data.id, 80) || id();
        if (method === 'DELETE') {
          await db()
            .prepare('DELETE FROM records WHERE id=? AND kind=?')
            .bind(recordId, section)
            .run();
          await log(user, section + '.deleted', recordId);
          return out({ deleted: true });
        }
        const existing: any = await db()
          .prepare('SELECT kind,data FROM records WHERE id=?')
          .bind(recordId)
          .first();
        if (existing && existing.kind !== section)
          throw new ApiError(404, 'Registro no encontrado.');
        const record = {
          ...(existing ? JSON.parse(existing.data) : {}),
          title: clean(data.title, 120),
          description: clean(data.description, 2000),
          code: clean(data.code, 40),
          status: [
            'Borrador',
            'Activo',
            'Pausado',
            'Nuevo',
            'Abierto',
            'Resuelto',
            'Cerrado',
          ].includes(data.status)
            ? data.status
            : 'Borrador',
          value: validNumber(data.value || 0, 0, 100),
          start: clean(data.start, 10),
          end: clean(data.end, 10),
        };
        if (!record.title) throw new ApiError(400, 'Introduce un título.');
        await db()
          .prepare(
            'INSERT INTO records(id,kind,data,created_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE records.kind=excluded.kind',
          )
          .bind(recordId, section, JSON.stringify(record), now())
          .run();
        await log(user, section + '.saved', recordId);
        return out({ saved: true });
      }
    }
    throw new ApiError(404, 'Función no disponible.');
  } catch (error) {
    if (error instanceof ApiError)
      return out({ error: error.message }, error.status);
    if (
      error instanceof Error &&
      /Revisa|inválid|superpone|límite|nombre del|supera/.test(error.message)
    )
      return out({ error: error.message }, 400);
    console.error(
      'VoyConPlan request failed',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return out(
      {
        error: 'No se pudo completar la operación. Reintenta en unos momentos.',
      },
      500,
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
