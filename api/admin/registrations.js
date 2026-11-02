import { endpoint, HttpError, json } from '../../lib/http.js';
import { requireAdmin } from '../../lib/security.js';
import { registrationPage } from '../../lib/store.js';

export const handleAdminRegistrations = endpoint(async request => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET' });
  await requireAdmin(request);
  const offset = Number(new URL(request.url).searchParams.get('offset') || 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw new HttpError(400, 'Invalid page.');
  return json(await registrationPage(offset));
});

export default { fetch: handleAdminRegistrations };
