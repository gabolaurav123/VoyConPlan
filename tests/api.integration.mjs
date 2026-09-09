import assert from 'node:assert/strict';
import { defaultSearch } from '../lib/domain.ts';
const base = process.env.VCP_TEST_URL || 'http://localhost:3000';
let passed = 0;
const ok = (condition, label) => {
  assert.ok(condition, label);
  console.log('PASS ' + label);
  passed++;
};
async function req(path, method = 'GET', data, auth = true, extra = {}) {
  const r = await fetch(base + '/api/' + path, {
    method,
    headers: {
      ...(auth ? { Cookie: '__sites_local_auth=1' } : {}),
      ...(method === 'GET'
        ? {}
        : { Origin: base, 'Content-Type': 'application/json' }),
      ...extra,
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  let value;
  try {
    value = await r.json();
  } catch {
    value = {};
  }
  return { status: r.status, data: value };
}
const anon = await req('trips', 'GET', undefined, false);
ok(anon.status === 401, 'anonymous trip reads rejected');
const spoof = await req('bootstrap', 'GET', undefined, false, {
  'oai-authenticated-user-id': 'fake',
  'oai-authenticated-user-email': 'gabolaurav@gmail.com',
});
ok(spoof.data.user === null, 'local dispatcher strips forged auth headers');
const before = await req('bootstrap');
ok(before.status === 200, 'authenticated profile loads');
const origin = await req('me', 'PATCH', { name: 'Attack' }, true, {
  Origin: 'https://evil.example',
});
ok(origin.status === 403, 'cross-origin writes rejected');
const currency = await req('discover', 'POST', {
  ...defaultSearch,
  currency: '__proto__',
});
ok(currency.status === 400, 'prototype currency rejected at API');
const discover = await req('discover', 'POST', defaultSearch);
ok(
  discover.status === 200 &&
    discover.data.results.length === 6 &&
    discover.data.mode === 'demo',
  'discovery returns six labelled DEMO candidates',
);
const requirements = await req('requirements');
ok(
  requirements.data.items.every(
    (i) => i.status === 'unknown' && i.checkedAt === null,
  ),
  'critical requirements never imply clearance',
);
const oldPlan = before.data.user.plan,
  oldEmail = before.data.user.email;
await req('me', 'PATCH', {
  name: before.data.user.name,
  budget: 1000,
  plan: 'Max',
  role: 'super_admin',
  email: 'intruder@example.test',
});
const after = await req('bootstrap');
ok(
  after.data.user.plan === oldPlan && after.data.user.email === oldEmail,
  'profile mutation cannot change plan or identity',
);
const requestId = crypto.randomUUID();
const created = await req('trips', 'POST', {
  destinationId: 'cartagena',
  search: defaultSearch,
  requestId,
});
ok(created.status === 201, 'trip persisted');
const duplicate = await req('trips', 'POST', {
  destinationId: 'cartagena',
  search: defaultSearch,
  requestId,
});
ok(
  duplicate.status === 200 && duplicate.data.id === created.data.id,
  'create retry reuses trip',
);
const mismatch = await req('trips', 'POST', {
  destinationId: 'cusco',
  search: defaultSearch,
  requestId,
});
ok(
  mismatch.status === 409,
  'idempotency key cannot be reused for other payload',
);
const tripId = created.data.id;
const initial = await req('trips/' + tripId);
const data = initial.data.data;
data.flight.reservation = 'PRIVATE_RESERVATION';
data.itinerary[0].items[0].notes = 'PRIVATE_NOTES';
data.provenance = 'user_entered';
const mutations = await Promise.all([
  req('trips/' + tripId, 'PATCH', { version: initial.data.version, data }),
  req('trips/' + tripId, 'PATCH', { version: initial.data.version, data }),
]);
ok(
  mutations
    .map((r) => r.status)
    .sort()
    .join(',') === '200,409',
  'concurrent edits enforce optimistic version',
);
const saved = await req('trips/' + tripId);
ok(
  saved.data.data.provenance === 'demo',
  'client cannot remove DEMO provenance',
);
const shared = await req('trips/' + tripId + '/share', 'POST', {
  kind: 'read',
});
const token = shared.data.url.split('/').pop();
const projection = await req('share/' + token, 'GET', undefined, false);
ok(
  projection.status === 200 &&
    !JSON.stringify(projection.data).includes('PRIVATE_'),
  'shared view omits private fields',
);
const attempts = await Promise.all(
  Array.from({ length: 8 }, () =>
    req('trips', 'POST', {
      destinationId: 'cusco',
      search: defaultSearch,
      requestId: crypto.randomUUID(),
    }),
  ),
);
ok(
  attempts.every((r) => r.status === 429),
  'parallel creation cannot exceed Free quota',
);
await req('trips/' + tripId + '/links', 'POST', { id: shared.data.id });
ok(
  (await req('share/' + token, 'GET', undefined, false)).status === 404,
  'revoked link immediately rejected',
);
const links = await req('trips/' + tripId + '/links');
ok(
  !JSON.stringify(links.data).includes(token) &&
    !JSON.stringify(links.data).includes('hash'),
  'management list exposes no share secret',
);
await req('trips/' + tripId, 'DELETE', {});
ok(
  (await req('trips/' + tripId)).status === 404,
  'test trip removed and unavailable',
);
console.log(
  JSON.stringify({
    passed,
    scope:
      'local developer identity; live providers/billing and multiple SIWC identities not tested',
  }),
);
