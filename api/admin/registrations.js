import { randomUUID } from 'node:crypto';
import { checkOrigin, endpoint, HttpError, json, readJson } from '../../lib/http.js';
import { privateHash, requireAdmin } from '../../lib/security.js';
import { changeRegistration, redis, registrationPage, saveRegistration } from '../../lib/store.js';
import { validateMemberDetails } from '../../lib/validation.js';

export const handleAdminRegistrations = endpoint(async request => {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST, PATCH, DELETE' });
  await requireAdmin(request);
  const params = new URL(request.url).searchParams;
  if (request.method === 'GET') {
    const offset = Number(params.get('offset') || 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw new HttpError(400, 'Invalid page.');
    return json(await registrationPage(offset));
  }

  checkOrigin(request);
  if (request.method === 'POST') {
    const values = validateMemberDetails(await readJson(request));
    const record = { id: randomUUID(), createdAt: new Date().toISOString(), ...values };
    const [state] = await saveRegistration(record, privateHash(record.email), privateHash(record.id));
    if (!state) throw new HttpError(409, 'This email is already registered.');
    return json({ record }, 201);
  }
  const id = params.get('id');
  if (!/^[a-f0-9-]{36}$/i.test(id || '')) throw new HttpError(400, 'Invalid registration reference.');
  const current = await redis(['HGET', 'arena:registrations', id]);
  if (!current) throw new HttpError(404, 'This registration no longer exists.');
  const record = JSON.parse(current);
  let updated = null;
  if (request.method === 'PATCH') {
    const input = await readJson(request);
    if ('checkedIn' in input) {
      if (typeof input.checkedIn !== 'boolean') throw new HttpError(400, 'Invalid check-in status.');
      updated = { ...record, checkedInAt: input.checkedIn ? record.checkedInAt || new Date().toISOString() : null };
    } else {
      if (input.revision !== (record.revision ?? 0)) throw new HttpError(409, 'Registration details changed. Refresh and try again.');
      updated = { ...record, ...validateMemberDetails(input), revision: (record.revision ?? 0) + 1 };
    }
  }
  const result = await changeRegistration(id, current, updated, privateHash(record.email), privateHash(updated?.email ?? record.email));
  if (result === 0) throw new HttpError(404, 'This registration no longer exists.');
  if (result === 2) throw new HttpError(409, 'This registration changed. Refresh and try again.');
  if (result === 3) throw new HttpError(409, 'This email is already registered.');
  return json({ record: updated });
});

export default { fetch: handleAdminRegistrations };
