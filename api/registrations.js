import { randomUUID } from 'node:crypto';
import { checkOrigin, endpoint, HttpError, json, readJson } from '../lib/http.js';
import { privateHash, rateLimit } from '../lib/security.js';
import { saveRegistration } from '../lib/store.js';
import { validateRegistration } from '../lib/validation.js';

export const handleRegistration = endpoint(async request => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
  checkOrigin(request);
  await rateLimit(request, 'registration', 60, 600);
  const input = await readJson(request);
  const values = validateRegistration(input);
  const record = { id: randomUUID(), createdAt: new Date().toISOString(), ...values };
  const [state, id] = await saveRegistration(record, privateHash(values.email), privateHash(`${values.email}:${input.submissionId}`));
  if (!state) throw new HttpError(409, 'This email is already registered. Contact the NCS organizing team to update your details.');
  return json({ id, message: 'Registration received.' }, state === 1 ? 201 : 200);
});

export default { fetch: handleRegistration };
