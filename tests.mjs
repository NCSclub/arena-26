import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationPayload } from './dist/registration-data.js';

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
