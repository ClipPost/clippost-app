// Encrypted, stateless session stored in an httpOnly cookie.
// No database: the TikTok token lives only inside this sealed cookie.
import crypto from 'crypto';

const ALG = 'aes-256-gcm';
const COOKIE = 'cp_sess';

function key() {
  const s = process.env.SESSION_SECRET || '';
  if (!s) throw new Error('SESSION_SECRET missing');
  return crypto.createHash('sha256').update(s).digest(); // 32 bytes
}

export function seal(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv(ALG, key(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return Buffer.concat([iv, tag, data]).toString('base64url');
}

export function unseal(str) {
  if (!str) return null;
  try {
    const b = Buffer.from(str, 'base64url');
    const iv = b.subarray(0, 12), tag = b.subarray(12, 28), data = b.subarray(28);
    const d = crypto.createDecipheriv(ALG, key(), iv);
    d.setAuthTag(tag);
    const out = Buffer.concat([d.update(data), d.final()]).toString('utf8');
    return JSON.parse(out);
  } catch { return null; }
}

// --- cookie helpers (support multiple Set-Cookie on one response) ---
function appendSetCookie(res, value) {
  const prev = res.getHeader('Set-Cookie');
  const arr = prev ? (Array.isArray(prev) ? prev : [prev]) : [];
  arr.push(value);
  res.setHeader('Set-Cookie', arr);
}

export function setCookie(res, name, value, { maxAge = 3600 } = {}) {
  appendSetCookie(res, `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);
}

export function clearCookie(res, name) {
  appendSetCookie(res, `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export function getCookie(req, name) {
  const h = req.headers.cookie || '';
  const item = h.split(/; */).find(c => c.startsWith(name + '='));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : null;
}

export function saveSession(res, sess) {
  // keep cookie alive as long as the refresh token is valid
  const maxAge = Math.max(3600, Math.floor((sess.refresh_exp - Date.now()) / 1000) || 86400);
  setCookie(res, COOKIE, seal(sess), { maxAge });
}

export function readSession(req) {
  return unseal(getCookie(req, COOKIE));
}

export function clearSession(res) {
  clearCookie(res, COOKIE);
}

export function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
}
