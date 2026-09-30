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
  loadCreator();
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === name));
  $('tab-publish').hidden = name !== 'publish';
  $('tab-stats').hidden = name !== 'stats';
  if (name === 'stats') loadStats();
  if (name === 'publish') loadCreator();   // always show the latest account info
}

/* ---------- Publish ---------- */

let CREATOR = null;   // latest creator_info (re-read every time the publish page is shown)
let VIDEO_SEC = null;

const MUSIC = '<a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noopener">Music Usage Confirmation</a>';
const BC = '<a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noopener">Branded Content Policy</a>';

function wirePublish() {
  const caption = $('caption');
  caption.addEventListener('input', () => {
    $('ccount').textContent = caption.value.length + ' / 2200';
  });

  $('video').addEventListener('change', () => {
    const f = $('video').files[0];
    const pv = $('preview');
    VIDEO_SEC = null;
    if (!f) { $('vinfo').hidden = true; pv.hidden = true; updateState(); return; }
    const mb = (f.size / 1048576).toFixed(1);
    $('vinfo').hidden = false;
    $('vinfo').textContent = f.name + ' · ' + mb + ' MB';
    pv.src = URL.createObjectURL(f); pv.hidden = false;           // preview of what will be posted
    pv.onloadedmetadata = () => { VIDEO_SEC = pv.duration; updateState(); };
    updateState();
  });

  ['privacy', 'allowComment', 'allowDuet', 'allowStitch', 'cc', 'ccYours', 'ccBranded']
    .forEach((id) => $(id).addEventListener('change', updateState));
  $('publish').addEventListener('click', doPublish);
  updateState();
}

async function loadCreator() {
  const sel = $('privacy');
  sel.innerHTML = '<option value="" selected disabled>Loading…</option>';
  try {
    const r = await fetch('/api/creator-info');
    const j = await r.json();
    if (j.error) throw new Error(j.error.message || j.error.code || 'creator_info failed');
    CREATOR = j.info || {};
  } catch (e) {
    CREATOR = null;
    $('limitNote').hidden = false;
    $('limitNote').textContent = 'Could not read your TikTok account right now. Please try again later.';
    sel.innerHTML = '<option value="" selected disabled>Unavailable</option>';
    updateState();
    return;
  }
  $('pname').textContent = CREATOR.creator_nickname || USER.display_name || 'your TikTok account';
  $('puser').textContent = CREATOR.creator_username ? '@' + CREATOR.creator_username : '';

  // No default privacy: the creator must pick one of the options TikTok returns.
  sel.innerHTML = '<option value="" selected disabled>Select…</option>';
  (CREATOR.privacy_level_options || []).forEach((o) => {
    const el = document.createElement('option');
    el.value = o; el.textContent = PRIV_LABEL[o] || o;
    sel.appendChild(el);
  });

  // Interactions start unchecked; grey out the ones disabled in the creator's settings.
  const dis = { allowComment: CREATOR.comment_disabled, allowDuet: CREATOR.duet_disabled, allowStitch: CREATOR.stitch_disabled };
  let any = false;
  Object.entries(dis).forEach(([id, off]) => {
    const c = $(id); c.checked = false; c.disabled = !!off;
    c.parentElement.classList.toggle('dis', !!off); any = any || !!off;
  });
  $('interNote').hidden = !any;
  updateState();
}

/** Recomputes labels, consent text and whether Publish is allowed. */
function updateState() {
  const priv = $('privacy');
  const cc = $('cc').checked, yours = $('ccYours').checked, branded = $('ccBranded').checked;
  $('ccBox').hidden = !cc;

  // Branded content cannot be private.
  const selfOpt = [...priv.options].find((o) => o.value === 'SELF_ONLY');
  if (selfOpt) {
    selfOpt.disabled = cc && branded;
    selfOpt.textContent = cc && branded ? 'Only me (not available for branded content)' : PRIV_LABEL.SELF_ONLY;
    if (cc && branded && priv.value === 'SELF_ONLY') priv.value = '';
  }

  $('ccLabel').textContent = !cc ? '' :
    branded ? 'Your video will be labeled as "Paid partnership".' :
    yours ? 'Your video will be labeled as "Promotional content".' :
    'You need to indicate if your content promotes yourself, a third party, or both.';

  $('consent').innerHTML = cc && branded
    ? 'By posting, you agree to TikTok\'s ' + BC + ' and ' + MUSIC + '.'
    : 'By posting, you agree to TikTok\'s ' + MUSIC + '.';

  const max = CREATOR && CREATOR.max_video_post_duration_sec;
  const tooLong = max && VIDEO_SEC && VIDEO_SEC > max;
  const f = $('video').files[0];
  const tooBig = f && f.size > 64 * 1048576;
  const note = tooLong ? `This video is ${Math.round(VIDEO_SEC)} s — your account can post up to ${max} s.`
    : tooBig ? 'Video is too large (max 64 MB in this version).' : '';
  if (CREATOR) { $('limitNote').hidden = !note; $('limitNote').textContent = note; }

  $('publish').disabled = !CREATOR || !f || !priv.value || tooLong || tooBig || (cc && !yours && !branded);
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
        disable_comment: !$('allowComment').checked,
        disable_duet: !$('allowDuet').checked,
        disable_stitch: !$('allowStitch').checked,
        brand_organic_toggle: $('cc').checked && $('ccYours').checked,
        brand_content_toggle: $('cc').checked && $('ccBranded').checked,
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
        ? '✓ Published to your TikTok. It may take a few minutes to appear on your profile.'
        : '✓ Sent to your TikTok inbox — finish it in the TikTok app.';
      $('video').value = ''; $('vinfo').hidden = true; $('preview').hidden = true; updateState();
    } else {
      throw new Error('TikTok returned status: ' + status);
    }
  } catch (e) {
    out.className = 'result bad';
    out.textContent = '✕ ' + (e.message || 'Something went wrong.');
  } finally {
    updateState();
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
