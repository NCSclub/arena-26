import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationPayload } from './dist/registration-data.js';
import { addRipple } from './dist/ripples.js';
import { isWhitePixel } from './dist/pixel-transition.js';

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
