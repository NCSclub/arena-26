import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationPayload } from './dist/registration-data.js';
import { addRipple } from './dist/ripples.js';
import { isWhitePixel } from './dist/pixel-transition.js';
import { resolveLanguage } from './dist/i18n.js';
import { translations } from './dist/translations.js';
import { readFile } from 'node:fs/promises';
import { arenaDensity, foregroundFade } from './dist/background-patterns.js';
import { addSignalPoint, signalField } from './dist/signal-field.js';

test('Digital pulses stay tight while overlapping clicks and drag traces decay', () => {
  const waves = [{x: 0, y: 0, time: 10}, {x: 100, y: 100, time: 10.2}];
  const click = signalField(132, 0, 10.4, waves, []);
  assert.ok(Math.abs(click.x) > 1 && click.energy > 0);
  assert.ok(Math.abs(click.x) <= 3 && Math.abs(click.y) <= 3);
  let trail = addSignalPoint([], 110, 0, 10);
  trail = addSignalPoint(trail, 120, 0, 10.05);
  assert.equal(trail.length, 2);
  assert.ok(signalField(125, 8, 10.1, [], trail).energy > 0);
  assert.deepEqual(signalField(125, 8, 13, waves, trail), {x: 0, y: 0, energy: 0});
  for (let i = 0; i < 100; i++) trail = addSignalPoint(trail, i, 0, 10 + i * .01);
  assert.equal(trail.length, 32);
  const crowded = signalField(110, 8, 11, waves, trail);
  assert.ok(Math.abs(crowded.x) <= 3 && Math.abs(crowded.y) <= 3 && crowded.energy <= 1);
});

test('ASCII formations move throughout the centre while foreground content stays readable', () => {
  let changes = 0;
  for (let y = 0; y <= 1; y += .02) for (let x = 0; x <= 1; x += .02) {
    const a = arenaDensity(x, y, 0), b = arenaDensity(x, y, 8);
    assert.ok(a >= 0 && a <= 1 && b >= 0 && b <= 1);
    if (Math.abs(a - b) > .025) changes++;
  }
  assert.ok(changes > 100);
  const centre = Array.from({length: 80}, (_, time) => arenaDensity(.5, .45, time * .25));
  assert.ok(Math.max(...centre) > .6);
  assert.ok(Math.max(...centre) - Math.min(...centre) > .4);
  const masks = [{left: 100, top: 100, right: 200, bottom: 200}];
  assert.equal(foregroundFade(150, 150, masks), .12);
  assert.equal(foregroundFade(150, 40, masks), 1);
});

test('New visitors use English; only an explicit French preference selects French', () => {
  for (const saved of [null, undefined, '', 'en', 'de', 'fr-FR']) assert.equal(resolveLanguage(saved), 'en');
  assert.equal(resolveLanguage('fr'), 'fr');
});

test('Both languages cover every static and dynamic translation used by the site', async () => {
  assert.deepEqual(Object.keys(translations.en).sort(), Object.keys(translations.fr).sort());
  const html = await readFile(new URL('./dist/index.html', import.meta.url), 'utf8');
  const keys = [...html.matchAll(/data-i18n(?:-(?:aria-label|placeholder|content))?="([^"]*)"/g)]
    .flatMap(match => match[1].split(',')).filter(Boolean);
  for (const file of ['app.js', 'visuals.js']) {
    const source = await readFile(new URL(`./dist/${file}`, import.meta.url), 'utf8');
    keys.push(...[...source.matchAll(/\bt\('([^']+)'\)/g)].map(match => match[1]));
  }
  for (const key of keys) {
    assert.equal(typeof translations.en[key], 'string', `Missing English: ${key}`);
    assert.equal(typeof translations.fr[key], 'string', `Missing French: ${key}`);
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

test('Solo export omits stale team and transport answers after changing choices', () => {
  const data = registrationPayload({ fullName: '  Test Participant  ', hasTeam: 'no', teamName: 'Previous team', teammate1: 'Previous teammate', needsTransportation: 'no', transportationAddress: 'Previous address' });
  assert.equal(data.fullName, 'Test Participant');
  assert.equal(data.hasTeam, false);
  assert.equal(data.teamName, '');
  assert.deepEqual(data.teammates, []);
  assert.equal(data.transportationAddress, '');
});
test('Team export preserves populated teammates and requested transport', () => {
  const data = registrationPayload({ hasTeam: 'yes', teamName: '  Team 26 ', teammate1: ' Alice ', teammate2: ' ', teammate3: 'Bob', needsTransportation: 'yes', transportationAddress: ' Algiers ' });
  assert.equal(data.teamName, 'Team 26');
  assert.deepEqual(data.teammates, ['Alice', 'Bob']);
  assert.equal(data.needsTransportation, true);
  assert.equal(data.transportationAddress, 'Algiers');
});
