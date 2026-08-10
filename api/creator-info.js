// Ask TikTok which privacy options / limits are available for this creator
// (unaudited apps can only post SELF_ONLY until approved).
import { json } from '../lib/session.js';
import { requireSession, apiPost } from '../lib/tiktok.js';

export default async function handler(req, res) {
  const sess = await requireSession(req, res);
  if (!sess) return;
  const j = await apiPost(sess, '/post/publish/creator_info/query/', {});
  if (j.error && j.error.code && j.error.code !== 'ok') return json(res, 200, { error: j.error });
  return json(res, 200, { info: j.data || null });
}
