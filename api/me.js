// Return the signed-in user's profile + stats.
import { json } from '../lib/session.js';
import { requireSession, apiGet } from '../lib/tiktok.js';

export default async function handler(req, res) {
  const sess = await requireSession(req, res);
  if (!sess) return;
  const fields = 'open_id,avatar_url,display_name,bio_description,is_verified,follower_count,following_count,likes_count,video_count';
  const j = await apiGet(sess, '/user/info/', fields);
  if (j.error && j.error.code && j.error.code !== 'ok') return json(res, 200, { error: j.error });
  return json(res, 200, { user: j.data ? j.data.user : null });
}
