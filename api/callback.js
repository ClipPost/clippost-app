// TikTok redirects here with ?code&state. Verify, exchange for a token, seal into cookie.
import { getCookie, clearCookie, saveSession } from '../lib/session.js';
import { codeToSession } from '../lib/tiktok.js';

function back(res, q) {
  res.statusCode = 302;
  res.setHeader('Location', '/' + (q ? '?' + q : ''));
  res.end();
}

export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const savedState = getCookie(req, 'cp_state');
  clearCookie(res, 'cp_state');

  if (error) return back(res, 'error=' + encodeURIComponent(error));
  if (!code || !state || state !== savedState) return back(res, 'error=state');

  const { sess, error: exErr } = await codeToSession(code);
  if (!sess) return back(res, 'error=' + encodeURIComponent(exErr || 'token'));

  saveSession(res, sess);
  back(res, 'connected=1');
}
