// Thin wrapper over TikTok's official v2 APIs + token refresh.
import { readSession, saveSession, clearSession, json } from './session.js';

export const AUTHORIZE = 'https://www.tiktok.com/v2/auth/authorize/';
export const TOKEN = 'https://open.tiktokapis.com/v2/oauth/token/';
export const API = 'https://open.tiktokapis.com/v2';

// Only the scopes we actually use and demonstrate (TikTok rejects unused scopes).
export const SCOPES = [
  'user.info.basic',
  'user.info.profile',
  'user.info.stats',
  'video.upload',
  'video.publish',
  'video.list',
].join(',');

export function cfg() {
  return {
    key: process.env.TIKTOK_CLIENT_KEY,
    secret: process.env.TIKTOK_CLIENT_SECRET,
    redirect: process.env.TIKTOK_REDIRECT_URI,
  };
}

async function exchange(params) {
  const r = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  return r.json();
}

export async function codeToSession(code) {
  const c = cfg();
  const j = await exchange({
    client_key: c.key,
    client_secret: c.secret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: c.redirect,
  });
  if (!j.access_token) return { error: j.error_description || j.error || 'token_exchange_failed', raw: j };
  return { sess: sessionFromToken(j) };
}

function sessionFromToken(j) {
  return {
    at: j.access_token,
    rt: j.refresh_token,
    open_id: j.open_id,
    scope: j.scope,
    exp: Date.now() + (j.expires_in || 86400) * 1000,
    refresh_exp: Date.now() + (j.refresh_expires_in || 86400 * 365) * 1000,
  };
}

async function refresh(sess) {
  const c = cfg();
  const j = await exchange({
    client_key: c.key,
    client_secret: c.secret,
    grant_type: 'refresh_token',
    refresh_token: sess.rt,
  });
  if (!j.access_token) return null;
  return sessionFromToken(j);
}

// Returns a valid session (refreshing + re-sealing the cookie if needed), or null.
export async function requireSession(req, res) {
  let sess = readSession(req);
  if (!sess) { json(res, 401, { error: 'not_authenticated' }); return null; }
  if (Date.now() > sess.exp - 60_000) {
    const fresh = await refresh(sess);
    if (!fresh) { clearSession(res); json(res, 401, { error: 'session_expired' }); return null; }
    sess = fresh;
    saveSession(res, sess);
  }
  return sess;
}

// Authenticated GET against the TikTok API.
export async function apiGet(sess, path, fields) {
  const url = `${API}${path}` + (fields ? `?fields=${encodeURIComponent(fields)}` : '');
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + sess.at } });
  return r.json();
}

// Authenticated POST (JSON body) against the TikTok API.
export async function apiPost(sess, path, body, query) {
  const url = `${API}${path}` + (query ? `?${query}` : '');
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + sess.at, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(body || {}),
  });
  return r.json();
}
