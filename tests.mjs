import { remainingTime } from "./dist/countdown.js";
import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationPayload } from './dist/registration-data.js';
import { addRipple } from './dist/ripples.js';
import { isWhitePixel } from './dist/pixel-transition.js';
import { resolveLanguage } from './dist/i18n.js';
import { translations } from './dist/translations.js';
import { readFile } from 'node:fs/promises';
import { advanceOrbit, beginOrbitReturn, morphFrame } from './dist/sculpture-motion.js';

test('Sculpture returns gradually to the nearest resting orientation at any frame rate', () => {
  const original = { yaw: Math.PI * 2 + 1, pitch: .5, vx: 0, vy: 0 };
  const slow = { ...original }, fast = { ...original };
  beginOrbitReturn(slow);
  beginOrbitReturn(fast);
  assert.ok(Math.abs(Math.cos(slow.yaw) - Math.cos(original.yaw)) < 1e-10);
  advanceOrbit(slow, 1 / 30);
  assert.ok(slow.yaw > .9 && slow.yaw < 1);
  for (let i = 1; i < 60; i++) advanceOrbit(slow, 1 / 30);
  for (let i = 0; i < 120; i++) advanceOrbit(fast, 1 / 60);
  assert.ok(Math.abs(slow.yaw) < .002);
  assert.ok(Math.abs(slow.yaw - fast.yaw) < 1e-10);
  assert.ok(Math.abs(slow.pitch - fast.pitch) < 1e-10);
});

test('Sculpture holds each symbol and morphs continuously in both directions', () => {
  const weight = time => {
    const frame = morphFrame(time);
    return frame.from === 0 ? frame.blend : 1 - frame.blend;
  };
  assert.equal(weight(0), 0);
  assert.equal(weight(3), 0);
  assert.equal(weight(5), .5);
  assert.equal(weight(7), 1);
  assert.equal(weight(9), 1);
  assert.equal(weight(11), .5);
  assert.equal(weight(12), 0);
  for (const boundary of [4, 6, 10, 12, 18, 24]) {
    assert.ok(Math.abs(weight(boundary - .001) - weight(boundary + .001)) < .00001);
  }
});

test('English is used even when a visitor previously selected French', () => {
  for (const saved of [null, undefined, '', 'en', 'de', 'fr-FR']) assert.equal(resolveLanguage(saved), 'en');
  assert.equal(resolveLanguage('fr'), 'en');
});

test('English covers every static and dynamic label used by the site', async () => {
  assert.deepEqual(Object.keys(translations), ['en']);
  const html = await readFile(new URL('./dist/index.html', import.meta.url), 'utf8');
  const keys = [...html.matchAll(/data-i18n(?:-(?:aria-label|placeholder|content))?="([^"]*)"/g)]
    .flatMap(match => match[1].split(',')).filter(Boolean);
  for (const file of ['app.js', 'visuals.js']) {
    const source = await readFile(new URL(`./dist/${file}`, import.meta.url), 'utf8');
    keys.push(...[...source.matchAll(/\bt\('([^']+)'\)/g)].map(match => match[1]));
  }
  for (const key of keys) {
    assert.equal(typeof translations.en[key], 'string', `Missing English: ${key}`);
  }
  assert.match(html, /<html lang="en">/);
});

test('Pixel transitions evolve without input while keeping a solid white content edge', () => {
  let changes = 0;
  for (let row = 0; row < 40; row++) {
    assert.equal(isWhitePixel(0, row, 20, 0), true);
    assert.equal(isWhitePixel(19, row, 20, 2), false);
    for (let column = 0; column < 20; column++) {
      if (isWhitePixel(column, row, 20, 0) !== isWhitePixel(column, row, 20, 2)) changes++;
    }
  }
  assert.ok(changes > 40);
});

test('Repeated background clicks preserve earlier ripple origins and start times', () => {
  let ripples = addRipple([], 40, 70, 10);
  ripples = addRipple(ripples, 300, 140, 10.4);
  assert.deepEqual(ripples, [{ x: 40, y: 70, time: 10 }, { x: 300, y: 140, time: 10.4 }]);
  assert.deepEqual(addRipple(ripples, 600, 200, 12.2), [{ x: 300, y: 140, time: 10.4 }, { x: 600, y: 200, time: 12.2 }]);
  for (let i = 0; i < 20; i++) ripples = addRipple(ripples, i, i, 11 + i * .01);
  assert.equal(ripples.length, 8);
});

test('Solo payload omits stale team and transport answers after changing choices', () => {
  const data = registrationPayload({ fullName: '  Test Participant  ', hasTeam: 'no', teamName: 'Previous team', teammate1: 'Previous teammate', needsTransportation: 'no', transportationAddress: 'Previous address' });
  assert.equal(data.fullName, 'Test Participant');
  assert.equal(data.hasTeam, false);
  assert.equal(data.teamName, '');
  assert.deepEqual(data.teammates, []);
  assert.equal(data.transportationAddress, '');
});
test('Team payload preserves populated teammates and requested transport', () => {
  const data = registrationPayload({ hasTeam: 'yes', teamName: '  Team 26 ', teammate1: ' Alice ', teammate2: ' ', teammate3: 'Bob', needsTransportation: 'yes', transportationAddress: ' Algiers ' });
  assert.equal(data.teamName, 'Team 26');
  assert.deepEqual(data.teammates, ['Alice', 'Bob']);
  assert.equal(data.needsTransportation, true);
  assert.equal(data.transportationAddress, 'Algiers');
});


test('Countdown uses an absolute start time and rolls over days and seconds correctly', () => {
  const start = '2026-12-01T09:00:00+01:00';
  assert.deepEqual(remainingTime(start, Date.parse('2026-11-30T06:58:59Z')), {total: 90061, days: 1, hours: 1, minutes: 1, seconds: 1});
  assert.deepEqual(remainingTime(start, Date.parse('2026-12-01T08:00:01Z')), {total: 0, days: 0, hours: 0, minutes: 0, seconds: 0});
  assert.equal(remainingTime(''), null);
  assert.equal(remainingTime('not a date'), null);
});
