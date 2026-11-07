import { endpoint, json } from '../../lib/http.js';
import { requireAdmin, rateLimit } from '../../lib/security.js';
import { redis } from '../../lib/store.js';
import { csvCell } from '../../lib/validation.js';

export const handleExport = endpoint(async request => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET' });
  await requireAdmin(request);
  await rateLimit(request, 'export', 10, 600);
  const ids = await redis(['ZREVRANGE', 'arena:registration-order', 0, -1]);
  const columns = ['id', 'createdAt', 'fullName', 'email', 'phoneNumber', 'discordTag', 'university', 'yearOfStudy', 'studentId', 'hasTeam', 'teamName', 'teammates', 'needsTransportation', 'transportationAddress', 'expectations', 'checkedInAt'];
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode('\uFEFF' + columns.map(csvCell).join(',') + '\r\n'));
        for (let i = 0; i < ids.length; i += 100) {
          const values = await redis(['HMGET', 'arena:registrations', ...ids.slice(i, i + 100)]);
          for (const value of values.filter(Boolean)) {
            const row = JSON.parse(value);
            controller.enqueue(encoder.encode(columns.map(key => csvCell(row[key])).join(',') + '\r\n'));
          }
        }
        controller.close();
      } catch { controller.error(new Error('Export failed.')); }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="arena-registrations.csv"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
});

export default { fetch: handleExport };
