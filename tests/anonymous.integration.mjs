import assert from 'node:assert/strict';

const base = process.env.VCP_TEST_URL || 'http://localhost:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Local test servers only');

// Exceed the old shared anonymous quota within one minute.
for (let batch = 0; batch < 8; batch++) {
  const responses = await Promise.all(Array.from({ length: 20 }, () => fetch(base + '/api/bootstrap')));
  for (const response of responses) {
    assert.equal(response.status, 200, 'Public discovery must not share a visitor quota');
    assert.equal((await response.json()).user, null, 'Requests remain anonymous');
  }
}
console.log('PASS 160 anonymous reads do not exhaust a shared visitor quota');
