import { checkOrigin, endpoint, HttpError, json, readJson } from '../../lib/http.js';
import { createSession, destroySession, rateLimit, requireAdmin, sessionCookie, verifyPassword } from '../../lib/security.js';

export const handleSession = endpoint(async request => {
  if (request.method === 'GET') { await requireAdmin(request); return json({ authenticated: true }); }
  if (request.method === 'POST') {
    checkOrigin(request);
    await rateLimit(request, 'login', 8, 900);
    const { password } = await readJson(request);
    if (typeof password !== 'string' || password.length > 200 || !await verifyPassword(password)) throw new HttpError(401, 'Incorrect password.');
    const token = await createSession();
    return json({ authenticated: true }, 200, { 'Set-Cookie': sessionCookie(token) });
  }
  if (request.method === 'DELETE') {
    checkOrigin(request);
    await destroySession(request);
    return json({ authenticated: false }, 200, { 'Set-Cookie': sessionCookie('', 0) });
  }
  return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST, DELETE' });
});

export default { fetch: handleSession };
