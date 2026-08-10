// Poll the status of a publish.
import { json } from '../lib/session.js';
import { requireSession, apiPost } from '../lib/tiktok.js';

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  const sess = await requireSession(req, res);
  if (!sess) return;
  const body = await readJson(req);
  if (!body.publish_id) return json(res, 400, { error: 'missing_publish_id' });
  const j = await apiPost(sess, '/post/publish/status/fetch/', { publish_id: body.publish_id });
  return json(res, 200, { data: j.data || null, error: j.error && j.error.code !== 'ok' ? j.error : null });
}
