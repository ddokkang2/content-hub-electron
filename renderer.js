// Content Hub — renderer
// 기록 입력 없음. 새 창 열기가 기본이 아님. 모두 앱 안 webview에 표시.
// 뷰: focus(기본) / grid / list / split / full

const PLATFORMS = [
  { id: 'youtube', name: 'YouTube Studio', url: 'https://studio.youtube.com' },
  { id: 'x', name: 'X', url: 'https://x.com/home' },
  { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com/' },
  { id: 'threads', name: 'Threads', url: 'https://www.threads.net/' },
  { id: 'tiktok', name: 'TikTok Studio', url: 'https://www.tiktok.com/tiktokstudio/' },
];

let focusId = 'youtube';
let currentView = 'focus';

const platformListEl = document.getElementById('platform-list');
const stageEl = document.getElementById('stage');

function paneOf(id) {
  return stageEl.querySelector(`.pane[data-platform="${id}"]`);
}
function webviewOf(id) {
  const pane = paneOf(id);
  return pane ? pane.querySelector('webview') : null;
}
function statusOf(id) {
  const pane = paneOf(id);
  return pane ? pane.querySelector('[data-status]') : null;
}
function fallbackOf(id) {
  const pane = paneOf(id);
  return pane ? pane.querySelector('.pane-fallback') : null;
}

function setFocus(id) {
  if (!PLATFORMS.some((p) => p.id === id)) return;
  focusId = id;
  document.querySelectorAll('.pane').forEach((pane) => {
    pane.classList.toggle('is-focus', pane.dataset.platform === id);
  });
  document.querySelectorAll('.platform-btn').forEach((btn) => {
    btn.classList.toggle('is-focus', btn.dataset.platform === id);
  });
  applySplitSecond();
  updateViewButtons();
}

function setView(view) {
  if (!['focus', 'grid', 'list', 'split', 'full'].includes(view)) return;
  currentView = view;
  document.body.classList.remove('view-focus', 'view-grid', 'view-list', 'view-split', 'view-full');
  document.body.classList.add(`view-${view}`);
  applySplitSecond();
  updateViewButtons();
}

function updateViewButtons() {
  document.querySelectorAll('.view-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.view === currentView);
  });
}

// 2분할: 포커스 + 바로 다음 플랫폼
function applySplitSecond() {
  const idx = PLATFORMS.findIndex((p) => p.id === focusId);
  const secondId = PLATFORMS[(idx + 1) % PLATFORMS.length].id;
  document.querySelectorAll('.pane').forEach((pane) => {
    pane.classList.toggle('is-second', pane.dataset.platform === secondId);
  });
}

function refreshOne(id) {
  const wv = webviewOf(id);
  if (wv) {
    const fb = fallbackOf(id);
    if (fb) fb.hidden = true;
    try { wv.reload(); } catch (_e) { /* webview가 아직 준비 전이면 무시 */ }
  }
}
function refreshAll() {
  PLATFORMS.forEach((p) => refreshOne(p.id));
}

async function openExternal(id) {
  const target = PLATFORMS.find((p) => p.id === id);
  if (!target) return;
  if (window.hub && typeof window.hub.openExternal === 'function') {
    await window.hub.openExternal(target.url);
  } else {
    window.open(target.url, '_blank', 'noopener');
  }
}

function buildPlatformList() {
  PLATFORMS.forEach((p) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'platform-btn' + (p.id === focusId ? ' is-focus' : '');
    btn.dataset.platform = p.id;
    btn.innerHTML = `<span class="dot"></span><span><span class="p-name">${p.name}</span><span class="p-url">${p.url.replace('https://', '')}</span></span>`;
    btn.addEventListener('click', () => setFocus(p.id));
    platformListEl.appendChild(btn);
  });
}

function bindControls() {
  document.querySelectorAll('.view-btn').forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });
  document.getElementById('refresh-all').addEventListener('click', refreshAll);
  document.getElementById('open-focused-external').addEventListener('click', () => openExternal(focusId));

  // 각 pane의 새로고침 / 외부로 / 다시 시도 (이벤트 위임)
  stageEl.addEventListener('click', (e) => {
    const refreshBtn = e.target.closest('[data-refresh]');
    const externalBtn = e.target.closest('[data-external]');
    const retryBtn = e.target.closest('[data-retry]');
    if (refreshBtn) refreshOne(refreshBtn.dataset.refresh);
    if (retryBtn) refreshOne(retryBtn.dataset.retry);
    if (externalBtn) openExternal(externalBtn.dataset.external);
  });
}

function bindWebviews() {
  PLATFORMS.forEach((p) => {
    const wv = webviewOf(p.id);
    if (!wv) return;
    wv.addEventListener('did-start-loading', () => {
      const st = statusOf(p.id);
      if (st) st.textContent = '로딩 중…';
    });
    wv.addEventListener('did-stop-loading', () => {
      const st = statusOf(p.id);
      if (st) st.textContent = '열림';
    });
    wv.addEventListener('did-fail-load', (e) => {
      // -3 = ABORTED (정상적인 리다이렉트/중단)는 무시
      if (e.errorCode === -3) return;
      const st = statusOf(p.id);
      if (st) st.textContent = '로드 실패';
      const fb = fallbackOf(p.id);
      if (fb) fb.hidden = false;
    });
    // webview 안에서 새 창 요청이 오면 외부 브라우저로 (허브 창 유지)
    wv.addEventListener('new-window', (e) => {
      e.preventDefault();
      if (window.hub && typeof window.hub.openExternal === 'function') {
        window.hub.openExternal(e.url);
      } else {
        window.open(e.url, '_blank', 'noopener');
      }
    });
  });
}

buildPlatformList();
bindControls();
bindWebviews();
setFocus('youtube');
setView('focus');
