// Start TikTok OAuth: redirect the user to TikTok's own approval screen.
import crypto from 'crypto';
import { setCookie } from '../lib/session.js';
import { AUTHORIZE, SCOPES, cfg } from '../lib/tiktok.js';

export default function handler(req, res) {
  const c = cfg();
  if (!c.key || !c.redirect) { res.statusCode = 500; res.end('Server not configured'); return; }

  const state = crypto.randomBytes(16).toString('hex');
  setCookie(res, 'cp_state', state, { maxAge: 600 });

  const p = new URLSearchParams({
    client_key: c.key,
    scope: SCOPES,
    response_type: 'code',
    redirect_uri: c.redirect,
    state,
  });
  res.statusCode = 302;
  res.setHeader('Location', `${AUTHORIZE}?${p.toString()}`);
  res.end();
}
