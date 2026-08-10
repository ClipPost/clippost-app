// Clear the session (disconnect). Does not revoke on TikTok's side — the user can
// also remove access from TikTok settings.
import { clearSession } from '../lib/session.js';

export default function handler(req, res) {
  clearSession(res);
  res.statusCode = 302;
  res.setHeader('Location', '/');
  res.end();
}
