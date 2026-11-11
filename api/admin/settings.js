import { checkOrigin, endpoint, HttpError, json, readJson } from '../../lib/http.js';
import { requireAdmin } from '../../lib/security.js';
import { saveSubmissionSettings, submissionSettings } from '../../lib/store.js';
import { validateSubmissionSettings } from '../../lib/validation.js';

const CONFLICT = 'These settings were changed in another window. Select “Discard changes” to load the latest version.';

export const handleAdminSettings = endpoint(async request => {
  if (!['GET', 'PUT'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET, PUT' });
  await requireAdmin(request);
  if (request.method === 'GET') return json(await submissionSettings());
  checkOrigin(request);
  const input = await readJson(request);
  const current = await submissionSettings();
  if (input.revision !== current.revision) throw new HttpError(409, CONFLICT);
  const saved = await saveSubmissionSettings(validateSubmissionSettings(input), current.revision);
  if (!saved) throw new HttpError(409, CONFLICT);
  return json(saved);
});

export default { fetch: handleAdminSettings };
