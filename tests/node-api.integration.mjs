import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { defaultSearch } from '../lib/domain.ts';
const base = process.env.VCP_TEST_URL || 'http://localhost:3000';
assert.ok(
  ['localhost', '127.0.0.1'].includes(new URL(base).hostname),
  'Only local test servers are permitted',
);
const pass = 'Local-fixture-only-Password-42!';
let passed = 0;
const ok = (check, label) => {
  assert.ok(check, label);
  console.log('PASS ' + label);
  passed++;
};
async function req(path, method = 'GET', body, cookie = '', extra = {}) {
  const r = await fetch(base + '/api/' + path, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(method !== 'GET'
        ? { 'Content-Type': 'application/json', Origin: base }
        : {}),
      ...extra,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: r.status,
    data: await r.text().then(t=>{try{return JSON.parse(t);}catch{return {error:t};}}),
    cookie: r.headers.get('set-cookie')?.split(';')[0] || '',
    headers: r.headers,
  };
}
ok(
  (await req('health')).status === 200,
  'Node health and SQLite available',
);
const spoof = await req('bootstrap', 'GET', undefined, '', {
  'oai-authenticated-user-id': 'owner',
  'oai-authenticated-user-email': 'admin@example.test',
});
ok(
  spoof.status === 200 && !spoof.data.user,
  'forged dispatcher headers never authenticate',
);
ok((await req('trips')).status === 401, 'anonymous trips rejected');
ok(
  (
    await req('auth/register', 'POST', {
      email: 'admin@example.test',
      name: 'Reserved',
      password: pass,
    })
  ).status === 400,
  'reserved administrator cannot be claimed by signup',
);
ok(
  (
    await req('auth/setup', 'POST', {
      email: 'admin@example.test',
      name: 'Local admin',
      password: pass,
      token: 'wrong',
    })
  ).status === 403,
  'invalid bootstrap rejected',
);
const admin = await req('auth/setup', 'POST', {
  email: 'admin@example.test',
  name: 'Local admin',
  password: pass,
  token: process.env.ADMIN_SETUP_TOKEN,
});
ok(admin.status === 201 && admin.cookie, 'one-time local administrator setup');
ok(
  /HttpOnly/i.test(admin.headers.get('set-cookie')) &&
    /SameSite=Lax/i.test(admin.headers.get('set-cookie')),
  'session cookie protections present',
);
ok(
  (await req('admin/overview', 'GET', undefined, admin.cookie)).status === 200,
  'administrator has server-verified role',
);
ok(
  (
    await req('auth/setup', 'POST', {
      email: 'admin@example.test',
      name: 'Duplicate',
      password: pass,
      token: process.env.ADMIN_SETUP_TOKEN,
    })
  ).status === 403,
  'bootstrap cannot be reused',
);
const users = await Promise.all(
  ['one', 'two'].map((n) =>
    req('auth/register', 'POST', {
      email: n + '@example.test',
      name: 'Test ' + n,
      password: pass,
      role: 'super_admin',
      plan: 'Max',
    }),
  ),
);
ok(
  users.every((r) => r.status === 201 && r.cookie),
  'two independent users registered',
);
const [a, b] = users.map((r) => r.cookie);
const me = await req('bootstrap', 'GET', undefined, a);
ok(
  me.data.user.role === 'user' && me.data.user.plan === 'Free',
  'registration cannot set role or plan',
);
ok(
  (await req('admin/overview', 'GET', undefined, a)).status === 403,
  'normal user blocked from administrator API',
);
ok(
  (
    await req('me', 'PATCH', { name: 'Wrong origin' }, a, {
      Origin: 'https://invalid.example',
    })
  ).status === 403,
  'cross-origin writes rejected',
);
const inputs = Array.from({ length: 8 }, () => ({
  destinationId: 'cusco',
  search: defaultSearch,
  requestId: randomUUID(),
}));
const created = await Promise.all(
  inputs.map((i) => req('trips', 'POST', i, a)),
);
ok(
  created.filter((r) => r.status === 201).length === 2 &&
    created.filter((r) => r.status === 429).length === 6,
  'eight simultaneous creations admit exactly Free quota two',
);
const idx = created.findIndex((r) => r.status === 201),
  tripId = created[idx].data.id;
ok(
  (await req('trips', 'POST', inputs[idx], a)).data.id === tripId,
  'idempotent replay returns the same trip after quota exhaustion',
);
ok(
  (await req('trips/' + tripId, 'GET', undefined, b)).status === 404,
  'second account cannot read private trip',
);
ok(
  (await req('trips/' + tripId, 'DELETE', {}, b)).status === 404,
  'second account cannot delete private trip',
);
const t = (await req('trips/' + tripId, 'GET', undefined, a)).data;
t.data.flight.reservation = 'SECRET_PNR';
t.data.preferences.passport = 'PRIVATE_PASSPORT';
t.data.itinerary[0].items[0].notes = 'PRIVATE_NOTE';
t.data.provenance = 'user_entered';
const edits = await Promise.all([
  req('trips/' + tripId, 'PATCH', { version: t.version, data: t.data }, a),
  req('trips/' + tripId, 'PATCH', { version: t.version, data: t.data }, a),
]);
ok(
  edits
    .map((r) => r.status)
    .sort((x, y) => x - y)
    .join(',') === '200,409',
  'simultaneous edits protect optimistic version',
);
ok(
  (await req('trips/' + tripId, 'GET', undefined, a)).data.data.provenance ===
    'demo',
  'DEMO provenance cannot be removed',
);
const shared = await req(
  'trips/' + tripId + '/share',
  'POST',
  { kind: 'read' },
  a,
);
const token = shared.data.url.split('/').at(-1);
const read = await req('share/' + token);
ok(
  read.status === 200 &&
    !/SECRET_PNR|PRIVATE_PASSPORT|PRIVATE_NOTE/.test(JSON.stringify(read.data)),
  'public share uses safe projection',
);
await req('trips/' + tripId + '/links', 'POST', { id: shared.data.id }, a);
ok(
  (await req('share/' + token)).status === 404,
  'revoked read link is unusable',
);
const invite = await req(
  'trips/' + tripId + '/share',
  'POST',
  { kind: 'invite' },
  a,
);
const accepted = await req(
  'accept',
  'POST',
  { token: invite.data.url.split('/').at(-1) },
  b,
);
ok(
  accepted.status === 200 &&
    (await req('trips/' + tripId, 'GET', undefined, b)).status === 200,
  'second account accepts invitation and gains intended membership',
);
ok(
  (await req('trips/' + tripId, 'DELETE', {}, b)).status === 404,
  'member still cannot delete owner trip',
);
const invite2 = await req(
  'trips/' + tripId + '/share',
  'POST',
  { kind: 'invite' },
  a,
);
await req('trips/' + tripId + '/links', 'POST', { id: invite2.data.id }, a);
ok(
  (
    await req(
      'accept',
      'POST',
      { token: invite2.data.url.split('/').at(-1) },
      admin.cookie,
    )
  ).status === 404,
  'revoked invitation cannot enroll another account',
);
await req('auth/logout', 'POST', {}, b);
ok(
  (await req('trips', 'GET', undefined, b)).status === 401,
  'logout revokes persisted session',
);
const login = await req('auth/login', 'POST', {
  email: 'two@example.test',
  password: pass,
});
ok(login.status === 200 && login.cookie !== b, 'login creates a fresh session');
const content = await req(
  'admin/content',
  'POST',
  {
    title: 'Local integration draft',
    slug: 'local-integration-draft',
    kind: 'Post',
    status: 'Borrador',
    summary: 'Local test',
    body: 'Local test content.',
  },
  admin.cookie,
);
ok(content.status === 200, 'administrator CMS saves to SQLite');
writeFileSync(
  'work/local-api-fixture.json',
  JSON.stringify({ cookie: a, tripId, adminCookie: admin.cookie }),
);
console.log(
  'PASSED ' +
    passed +
    ' Node API assertions. Local fixture saved for restart verification.',
);
