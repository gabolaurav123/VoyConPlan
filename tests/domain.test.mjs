import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultSearch,
  validateSearch,
  estimate,
  createTrip,
  validateTrip,
  sharedProjection,
  demoDestinations,
  dateAt,
  preferenceMatches,
} from '../lib/domain.ts';
test('cost covers group, nights, daily categories and 10% reserve', () => {
  const d = demoDestinations[0],
    s = { ...defaultSearch };
  const r = estimate(d, s);
  assert.equal(r.amounts.length, 9);
  assert.equal(r.amounts[0], 580);
  assert.equal(r.amounts[1], 225);
  assert.equal(r.real, Math.round(r.amounts.reduce((a, b) => a + b, 0)));
  assert.equal(r.checkedAt, null);
  assert.equal(r.source, d.source);
});
test('higher budget cannot reduce affordability', () => {
  for (const d of demoDestinations) {
    const a = estimate(d, { ...defaultSearch, budget: 500 }),
      b = estimate(d, { ...defaultSearch, budget: 2000 });
    assert.ok(b.score >= a.score);
  }
});
test('per-person budget scales group allowance, not costs', () => {
  const a = estimate(demoDestinations[0], defaultSearch),
    b = estimate(demoDestinations[0], { ...defaultSearch, perPerson: true });
  assert.equal(a.real, b.real);
  assert.equal(b.budget, a.budget * 2);
});
test('currency conversion is consistent and explicitly demo', () => {
  const a = estimate(demoDestinations[0], defaultSearch),
    b = estimate(demoDestinations[0], { ...defaultSearch, currency: 'BOB' });
  assert.ok(Math.abs(b.real - a.real * 6.96) < 4);
  assert.match(b.costSource, /DEMO/);
});
test('inherited and invalid currencies are rejected', () => {
  for (const currency of [
    'constructor',
    '__proto__',
    'toString',
    'JPY',
    {},
    null,
  ])
    assert.throws(() => validateSearch({ ...defaultSearch, currency }));
});
test('invalid travelers, budgets and durations fail', () => {
  for (const value of [0, -1, Infinity, NaN])
    assert.throws(() => validateSearch({ ...defaultSearch, budget: value }));
  assert.throws(() => validateSearch({ ...defaultSearch, travelers: 1.5 }));
  assert.throws(() => validateSearch({ ...defaultSearch, days: 31 }));
});
test('calendar preserves UTC dates across year boundary', () => {
  assert.equal(dateAt('2026-12-31', 1), '2027-01-01');
  assert.throws(() => validateSearch({ ...defaultSearch, date: '2026-02-30' }));
});
test('overlapping activities cannot be saved', () => {
  const t = createTrip(demoDestinations[0], defaultSearch);
  t.itinerary[0].items.push({
    ...t.itinerary[0].items[0],
    id: 'two',
    time: '16:30',
  });
  assert.throws(() => validateTrip(t), /superponen/);
});
test('shared projection excludes notes, reservations, expenses and passport', () => {
  const t = createTrip(demoDestinations[0], defaultSearch);
  t.flight.reservation = 'SECRET_PNR';
  t.preferences.passport = 'PRIVATE_PASSPORT';
  t.itinerary[0].items[0].notes = 'SECRET_NOTE';
  t.expenses.push({ id: 'x', amount: 50, title: 'PRIVATE_EXPENSE' });
  const data = JSON.stringify(sharedProjection(t));
  assert.doesNotMatch(data, /SECRET|PRIVATE/);
  assert.equal(sharedProjection(t).provenance, 'demo');
});
test('avoid preference takes precedence, must-have preserved', () => {
  assert.equal(
    preferenceMatches({ Playa: 'Imprescindible' }, { Playa: 'Evitar' })[0]
      .status,
    'Uno prefiere evitarlo',
  );
  assert.equal(
    preferenceMatches({ Cultura: 'Me gusta' }, { Cultura: 'Me gusta' })[0]
      .status,
    'Ambos quieren hacerlo',
  );
});
