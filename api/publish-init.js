// Start a Direct Post. Returns { publish_id, upload_url }.
// The browser then PUTs the video bytes straight to upload_url (TikTok), so
// large files never pass through our server.
import { json } from '../lib/session.js';
import { requireSession, apiPost } from '../lib/tiktok.js';

const MAX = 64 * 1024 * 1024; // single-chunk limit for v1

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
  const title = (body.title || '').toString().slice(0, 2200);
  // Audit rules, enforced server-side too: privacy has no default; commercial content needs a type;
  // branded content can't be private.
  const privacy = body.privacy_level;
  const organic = !!body.brand_organic_toggle, branded = !!body.brand_content_toggle;
  if (!['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'].includes(privacy))
    return json(res, 400, { error: 'privacy_required', message: 'Choose who can see this video.' });
  if (branded && privacy === 'SELF_ONLY')
    return json(res, 400, { error: 'branded_private', message: 'Branded content cannot be private.' });
  const size = Number(body.video_size || 0);

  if (!size || size < 1) return json(res, 400, { error: 'missing_video_size' });
  if (size > MAX) return json(res, 400, { error: 'too_large', message: 'Video must be 64 MB or smaller in this version.' });

  const payload = {
    post_info: {
      title,
      privacy_level: privacy,
      disable_comment: !!body.disable_comment,
      disable_duet: !!body.disable_duet,
      disable_stitch: !!body.disable_stitch,
      brand_organic_toggle: organic,
      brand_content_toggle: branded,
      video_cover_timestamp_ms: 1000,
    },
    source_info: {
      source: 'FILE_UPLOAD',
      video_size: size,
      chunk_size: size,
      total_chunk_count: 1,
    },
  };

  const j = await apiPost(sess, '/post/publish/video/init/', payload);
  if (!j.data || !j.data.upload_url) {
    return json(res, 200, { error: (j.error && j.error.message) || 'init_failed', raw: j.error || j });
  }
  return json(res, 200, { publish_id: j.data.publish_id, upload_url: j.data.upload_url });
}
