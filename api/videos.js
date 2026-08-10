// List the user's recent videos with their view counts.
import { json } from '../lib/session.js';
import { requireSession, apiPost } from '../lib/tiktok.js';

export default async function handler(req, res) {
  const sess = await requireSession(req, res);
  if (!sess) return;
  const fields = 'id,title,cover_image_url,share_url,view_count,like_count,comment_count,share_count,create_time';
  const j = await apiPost(sess, '/video/list/', { max_count: 20 }, 'fields=' + encodeURIComponent(fields));
  if (j.error && j.error.code && j.error.code !== 'ok') return json(res, 200, { error: j.error });
  return json(res, 200, { videos: j.data ? j.data.videos || [] : [] });
}
