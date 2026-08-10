# ClipPost

A small, self-contained web app that lets anyone connect **their own** TikTok account,
upload a video with a caption, and track their TikTok stats.

It is intentionally isolated: it shares no code, no secrets, and no data with any other
project. It stores nothing server-side — the TikTok token lives only inside an encrypted,
httpOnly session cookie and expires on its own.

## How it works

- `GET /api/login` → redirects to TikTok's OAuth screen (with a CSRF `state`).
- `GET /api/callback` → verifies `state`, exchanges the code for a token, seals it into a cookie.
- `GET /api/me` → the signed-in user's profile + stats (`user.info.*`).
- `GET /api/videos` → the user's recent videos + views (`video.list`).
- `GET /api/creator-info` → available privacy options / limits.
- `POST /api/publish-init` → starts a Direct Post, returns `{ publish_id, upload_url }`.
  The browser then `PUT`s the video bytes straight to TikTok (large files never touch our server).
- `POST /api/publish-status` → polls the publish status.
- `GET /api/logout` → clears the session cookie.

Scopes used (each one is demonstrated in the app):
`user.info.basic`, `user.info.profile`, `user.info.stats`, `video.upload`, `video.publish`, `video.list`.

## Deploy (Vercel, free)

1. Import this repo into Vercel (zero config — static files at root, functions in `/api`).
2. Add the environment variables from `.env.example` under Settings → Environment Variables.
3. Set the TikTok app's **Redirect URI** to `https://<your-vercel-domain>/api/callback`.
4. Deploy.

No build step, no dependencies — Node 18+ built-ins only.
