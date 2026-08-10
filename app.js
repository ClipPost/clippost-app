const $ = (id) => document.getElementById(id);
const fmt = (n) => (n == null ? '–' : Number(n).toLocaleString('en-US'));

const PRIV_LABEL = {
  PUBLIC_TO_EVERYONE: 'Everyone',
  MUTUAL_FOLLOW_FRIENDS: 'Friends',
  FOLLOWER_OF_CREATOR: 'Followers',
  SELF_ONLY: 'Only me (private)',
};

let USER = null;

init();

async function init() {
  // surface any OAuth error passed back on the URL
  const params = new URLSearchParams(location.search);
  const err = params.get('error');
  if (location.search) history.replaceState({}, '', '/');

  let me = null;
  try {
    const r = await fetch('/api/me');
    if (r.ok) me = await r.json();
  } catch {}

  if (!me || !me.user) return showConnect(err);
  USER = me.user;
  showApp();
}

function showConnect(err) {
  $('connect').hidden = false;
  if (err) {
    $('connErr').hidden = false;
    $('connErr').textContent = 'Could not connect (' + err + '). Please try again.';
  }
}

function showApp() {
  $('app').hidden = false;
  $('who').hidden = false;
  $('dname').textContent = USER.display_name || 'TikTok user';
  if (USER.avatar_url) $('avatar').src = USER.avatar_url;

  // tabs
  document.querySelectorAll('.tab').forEach((t) =>
    t.addEventListener('click', () => switchTab(t.dataset.tab))
  );

  wirePublish();
  loadPrivacy();
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === name));
  $('tab-publish').hidden = name !== 'publish';
  $('tab-stats').hidden = name !== 'stats';
  if (name === 'stats') loadStats();
}

/* ---------- Publish ---------- */

function wirePublish() {
  const caption = $('caption');
  caption.addEventListener('input', () => {
    $('ccount').textContent = caption.value.length + ' / 2200';
  });

  $('video').addEventListener('change', () => {
    const f = $('video').files[0];
    if (!f) { $('vinfo').hidden = true; $('publish').disabled = true; return; }
    const mb = (f.size / 1048576).toFixed(1);
    $('vinfo').hidden = false;
    $('vinfo').textContent = f.name + ' · ' + mb + ' MB';
    if (f.size > 64 * 1048576) {
      $('vinfo').textContent += ' — too large (max 64 MB in this version)';
      $('publish').disabled = true;
    } else {
      $('publish').disabled = false;
    }
  });

  $('publish').addEventListener('click', doPublish);
}

async function loadPrivacy() {
  const sel = $('privacy');
  sel.innerHTML = '<option>Loading…</option>';
  try {
    const r = await fetch('/api/creator-info');
    const j = await r.json();
    const opts = (j.info && j.info.privacy_level_options) || ['SELF_ONLY'];
    sel.innerHTML = '';
    opts.forEach((o) => {
      const el = document.createElement('option');
      el.value = o; el.textContent = PRIV_LABEL[o] || o;
      sel.appendChild(el);
    });
    if (opts.length === 1 && opts[0] === 'SELF_ONLY') {
      $('privNote').hidden = false;
      $('privNote').textContent = 'Only private posting is available until the app is approved by TikTok.';
    }
  } catch {
    sel.innerHTML = '<option value="SELF_ONLY">Only me (private)</option>';
  }
}

async function doPublish() {
  const f = $('video').files[0];
  if (!f) return;
  const btn = $('publish');
  const out = $('pubResult');
  btn.disabled = true;
  out.hidden = false; out.className = 'result';
  out.textContent = 'Preparing…';

  try {
    // 1) init
    const initR = await fetch('/api/publish-init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: $('caption').value,
        privacy_level: $('privacy').value,
        video_size: f.size,
      }),
    });
    const init = await initR.json();
    if (!init.upload_url) throw new Error(init.message || init.error || 'Could not start upload');

    // 2) upload the bytes straight to TikTok
    out.textContent = 'Uploading to TikTok…';
    const put = await fetch(init.upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': f.type || 'video/mp4',
        'Content-Range': `bytes 0-${f.size - 1}/${f.size}`,
      },
      body: f,
    });
    if (!put.ok) throw new Error('Upload failed (' + put.status + ')');

    // 3) poll status
    out.textContent = 'Publishing…';
    const status = await pollStatus(init.publish_id);
    if (status === 'PUBLISH_COMPLETE' || status === 'SEND_TO_USER_INBOX') {
      out.className = 'result ok';
      out.textContent = status === 'PUBLISH_COMPLETE'
        ? '✓ Published to your TikTok.'
        : '✓ Sent to your TikTok inbox — finish it in the TikTok app.';
      $('video').value = ''; $('vinfo').hidden = true;
    } else {
      throw new Error('TikTok returned status: ' + status);
    }
  } catch (e) {
    out.className = 'result bad';
    out.textContent = '✕ ' + (e.message || 'Something went wrong.');
  } finally {
    btn.disabled = false;
  }
}

async function pollStatus(publishId) {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const r = await fetch('/api/publish-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const j = await r.json();
    const st = j.data && j.data.status;
    if (st === 'PUBLISH_COMPLETE' || st === 'FAILED' || st === 'SEND_TO_USER_INBOX') return st;
  }
  return 'TIMEOUT';
}

/* ---------- Stats ---------- */

function loadStats() {
  const cards = [
    ['follower_count', 'Followers'],
    ['likes_count', 'Likes'],
    ['video_count', 'Videos'],
    ['following_count', 'Following'],
  ];
  $('statCards').innerHTML = cards
    .map(([k, label]) => `<div class="stat"><b>${fmt(USER[k])}</b><span>${label}</span></div>`)
    .join('');
  loadVideos();
}

async function loadVideos() {
  const box = $('vids');
  try {
    const r = await fetch('/api/videos');
    const j = await r.json();
    const vids = j.videos || [];
    if (!vids.length) { box.innerHTML = '<p class="muted">No videos yet.</p>'; return; }
    box.innerHTML = vids.map((v) => {
      const cover = v.cover_image_url ? `<img src="${v.cover_image_url}" alt="">` : '<img alt="">';
      const title = (v.title || '').slice(0, 40) || 'Untitled';
      return `<a class="vid" href="${v.share_url || '#'}" target="_blank" rel="noopener">
        ${cover}<div class="m"><b>${fmt(v.view_count)}</b> views<br>${escapeHtml(title)}</div></a>`;
    }).join('');
  } catch {
    box.innerHTML = '<p class="muted">Could not load videos.</p>';
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
