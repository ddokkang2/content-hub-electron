// Content Hub — renderer
// 기록 입력 없음. 새 창 열기가 기본이 아님. 모두 앱 안 webview에 표시.
// 뷰: focus(기본) / grid / list / split / full
// v1.1: 사이트 N개 추가/제거/수정 + 포커스 구분선 드래그 + 그리드 열 선택 + 사이드바 접기
// v1.2: 레이아웃 프리셋 / 단축키 / 자동 새로고침 / 항상 위에 / 계정별 세션 분리 /
//       빠른 전환(Ctrl+K) / 북마크 스냅샷
// pane 식별자: paneKey = platformId + '::' + accountId (예: youtube::default, youtube::acc-work)
// 같은 플랫폼을 다른 계정으로 두 번 열 수 있다. pane 목록이 렌더링의 기준이다.

const DEFAULT_PLATFORMS = [
  { id: 'youtube', name: 'YouTube Studio', url: 'https://studio.youtube.com' },
  { id: 'x', name: 'X', url: 'https://x.com/home' },
  { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com/' },
  { id: 'threads', name: 'Threads', url: 'https://www.threads.net/' },
  { id: 'tiktok', name: 'TikTok Studio', url: 'https://www.tiktok.com/tiktokstudio/' },
];

const SITES_KEY = 'content-hub-custom-sites';
const LAYOUT_KEY = 'content-hub-layout';
const ACCOUNTS_KEY = 'content-hub-accounts';
const PANES_KEY = 'content-hub-panes';
const PRESETS_KEY = 'content-hub-presets';
const AUTO_REFRESH_KEY = 'content-hub-auto-refresh';
const ALWAYS_ON_TOP_KEY = 'content-hub-always-on-top';
const SNAPSHOTS_KEY = 'content-hub-snapshots';
const FOCUS_MINI_MIN = 300; // 미니 바 최소 너비(px)
const FOCUS_PANE_MIN = 300; // 포커스 패널 최소 너비(px)

const DEFAULT_ACCOUNT = { id: 'default', name: '기본', color: '#ffd84d' };
const ACCOUNT_COLORS = ['#ffd84d', '#4da3ff', '#7ee08a', '#ff8a8a', '#c9a6e4', '#ff9f43', '#5eead4', '#f472b6'];

// ---------------- 기본 유틸 ----------------

function cloneDefaults() {
  return DEFAULT_PLATFORMS.map((p) => ({ ...p }));
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function displayUrl(url) {
  return String(url).replace(/^https?:\/\//, '');
}

function paneKeyFor(platformId, accountId) {
  return `${platformId}::${accountId}`;
}

// 계정별 webview partition.
// 기본 계정은 v1.1과 같은 persist:content-hub을 유지해 기존 로그인 세션을 보존한다.
// 그 외 계정은 persist:content-hub-<accountId> 로 분리한다.
function partitionForAccount(accountId) {
  if (accountId === 'default') return 'persist:content-hub';
  return `persist:content-hub-${accountId}`;
}

function makeSiteId(name) {
  const slug = String(name).toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-+|-+$/g, '') || 'site';
  let id = slug;
  let n = 2;
  while (PLATFORMS.some((p) => p.id === id)) id = `${slug}-${n++}`;
  return id;
}

function makeAccountId(name) {
  const slug = String(name).toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-+|-+$/g, '') || 'account';
  let id = `acc-${slug}`;
  let n = 2;
  while (ACCOUNTS.some((a) => a.id === id)) id = `acc-${slug}-${n++}`;
  return id;
}

// URL 유효성 검사: http/https 없으면 https:// 붙이고, 파싱 실패하면 null
function normalizeUrl(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return { ok: false, message: 'URL을 입력하세요.' };
  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  try {
    const u = new URL(candidate);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { ok: false, message: 'http:// 또는 https:// 로 시작하는 URL을 입력하세요.' };
    }
    if (!u.hostname || !u.hostname.includes('.')) {
      return { ok: false, message: '올바른 도메인 형태의 URL을 입력하세요. (예: https://example.com)' };
    }
    return { ok: true, url: u.toString() };
  } catch (_e) {
    return { ok: false, message: '올바른 URL을 입력하세요. (예: https://example.com)' };
  }
}

// ---------------- 저장 / 불러오기 ----------------

function loadSites() {
  try {
    const raw = localStorage.getItem(SITES_KEY);
    if (!raw) return cloneDefaults();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return cloneDefaults();
    const cleaned = parsed
      .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.url === 'string')
      .map((p) => ({ id: String(p.id), name: String(p.name), url: String(p.url) }))
      .filter((p) => p.id && p.name && p.url);
    return cleaned.length > 0 ? cleaned : cloneDefaults();
  } catch (_e) {
    return cloneDefaults();
  }
}

function saveSites() {
  try {
    localStorage.setItem(SITES_KEY, JSON.stringify(PLATFORMS));
  } catch (_e) { /* 저장 실패해도 동작은 계속 */ }
}

function loadLayout() {
  const fallback = { gridCols: 3, focusMiniWidth: 300, sidebarCollapsed: false };
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      gridCols: [2, 3, 4].includes(parsed.gridCols) ? parsed.gridCols : 3,
      focusMiniWidth: typeof parsed.focusMiniWidth === 'number' && parsed.focusMiniWidth >= FOCUS_MINI_MIN
        ? Math.round(parsed.focusMiniWidth) : 300,
      sidebarCollapsed: Boolean(parsed.sidebarCollapsed),
    };
  } catch (_e) {
    return fallback;
  }
}

function saveLayout() {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch (_e) { /* 저장 실패해도 동작은 계속 */ }
}

function loadAccounts() {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [{ ...DEFAULT_ACCOUNT }];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [{ ...DEFAULT_ACCOUNT }];
    const cleaned = parsed
      .filter((a) => a && typeof a.id === 'string' && typeof a.name === 'string')
      .map((a) => ({ id: String(a.id), name: String(a.name), color: typeof a.color === 'string' && a.color ? String(a.color) : '#8b9bb4' }))
      .filter((a) => a.id && a.name);
    // 기본 계정이 없으면 맨 앞에 복원 (레거시 파티션의 앵커)
    if (!cleaned.some((a) => a.id === 'default')) cleaned.unshift({ ...DEFAULT_ACCOUNT });
    return cleaned;
  } catch (_e) {
    return [{ ...DEFAULT_ACCOUNT }];
  }
}

function saveAccounts() {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(ACCOUNTS));
  } catch (_e) { /* 저장 실패해도 동작은 계속 */ }
}

function accountById(accountId) {
  return ACCOUNTS.find((a) => a.id === accountId) || null;
}

function accountLabel(accountId) {
  const a = accountById(accountId);
  return a ? a.name : accountId;
}

function accountColor(accountId) {
  const a = accountById(accountId);
  return a ? a.color : '#8b9bb4';
}

// pane 목록: [{ platformId, accountId, key }] — key는 platformId::accountId
function defaultPaneList(platforms) {
  return platforms.map((p) => ({ platformId: p.id, accountId: 'default', key: paneKeyFor(p.id, 'default') }));
}

function loadPanes(platforms) {
  try {
    const raw = localStorage.getItem(PANES_KEY);
    if (!raw) return defaultPaneList(platforms);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultPaneList(platforms);
    const seen = new Set();
    const cleaned = [];
    parsed.forEach((entry) => {
      if (!entry || typeof entry.platformId !== 'string' || typeof entry.accountId !== 'string') return;
      if (!platforms.some((p) => p.id === entry.platformId)) return; // 삭제된 사이트의 pane은 제외
      const key = paneKeyFor(entry.platformId, entry.accountId);
      if (seen.has(key)) return;
      seen.add(key);
      cleaned.push({ platformId: entry.platformId, accountId: entry.accountId, key });
    });
    return cleaned.length > 0 ? cleaned : defaultPaneList(platforms);
  } catch (_e) {
    return defaultPaneList(platforms);
  }
}

function savePanes() {
  try {
    localStorage.setItem(PANES_KEY, JSON.stringify(PANE_LIST.map((p) => ({ platformId: p.platformId, accountId: p.accountId }))));
  } catch (_e) { /* 저장 실패해도 동작은 계속 */ }
}

function findPaneEntry(paneKey) {
  return PANE_LIST.find((p) => p.key === paneKey) || null;
}

function platformOfPane(paneKey) {
  const entry = findPaneEntry(paneKey);
  if (!entry) return null;
  return PLATFORMS.find((p) => p.id === entry.platformId) || null;
}

// ---------------- 상태 ----------------

let PLATFORMS = loadSites();
let ACCOUNTS = loadAccounts();
let PANE_LIST = loadPanes(PLATFORMS);
let layout = loadLayout();
let focusPaneKey = PANE_LIST[0].key;
let currentView = 'focus';
let editingId = null; // 사이트 관리 모달에서 편집 중인 사이트 id (null = 추가 모드)
let autoRefreshTimer = null;
let autoRefreshMinutes = 0;
let alwaysOnTop = false;
let quickSwitchOpen = false;
let quickSwitchIndex = 0;

const platformListEl = document.getElementById('platform-list');
const stageEl = document.getElementById('stage');
const dividerEl = document.getElementById('focus-divider');

// ---------------- pane DOM 조회 (paneKey 기준) ----------------

function paneOf(paneKey) {
  const panes = stageEl.querySelectorAll('.pane');
  for (const pane of panes) {
    if (pane.dataset.paneKey === paneKey) return pane;
  }
  return null;
}
function webviewOf(paneKey) {
  const pane = paneOf(paneKey);
  return pane ? pane.querySelector('webview') : null;
}
function statusOf(paneKey) {
  const pane = paneOf(paneKey);
  return pane ? pane.querySelector('[data-status]') : null;
}
function fallbackOf(paneKey) {
  const pane = paneOf(paneKey);
  return pane ? pane.querySelector('.pane-fallback') : null;
}

// ---------------- 포커스 / 뷰 / 레이아웃 (v1.1 유지, paneKey 기준) ----------------

function setFocus(paneKey) {
  if (!findPaneEntry(paneKey)) return;
  focusPaneKey = paneKey;
  document.querySelectorAll('.pane').forEach((pane) => {
    pane.classList.toggle('is-focus', pane.dataset.paneKey === paneKey);
  });
  document.querySelectorAll('.platform-btn').forEach((btn) => {
    btn.classList.toggle('is-focus', btn.dataset.paneKey === paneKey);
  });
  applySplitSecond();
  updateViewButtons();
}

function setView(view) {
  if (!['focus', 'grid', 'list', 'split', 'full'].includes(view)) return;
  currentView = view;
  document.body.classList.remove('view-focus', 'view-grid', 'view-list', 'view-split', 'view-full');
  document.body.classList.add(`view-${view}`);
  applyLayout();
  applySplitSecond();
  updateViewButtons();
}

function updateViewButtons() {
  document.querySelectorAll('.view-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.view === currentView);
  });
}

// 2분할: 포커스 + 바로 다음 pane
function applySplitSecond() {
  const idx = PANE_LIST.findIndex((p) => p.key === focusPaneKey);
  const secondKey = idx >= 0 ? PANE_LIST[(idx + 1) % PANE_LIST.length].key : null;
  document.querySelectorAll('.pane').forEach((pane) => {
    pane.classList.toggle('is-second', pane.dataset.paneKey === secondKey);
  });
}

function applyLayout() {
  // 포커스 행 수 = 미니 바 개수 (N-1), 최소 1
  const rows = Math.max(1, PANE_LIST.length - 1);
  stageEl.style.setProperty('--focus-rows', String(rows));
  // 미니 바 너비: 현재 stage 너비 기준으로 클램프 (최소 300, 최대 80%)
  const stageW = stageEl.clientWidth || 1200;
  const maxMini = Math.max(FOCUS_MINI_MIN, Math.floor(stageW * 0.8));
  const clamped = Math.min(Math.max(layout.focusMiniWidth, FOCUS_MINI_MIN), maxMini);
  // 포커스 패널 최소 너비도 보장
  const maxByFocus = Math.max(FOCUS_MINI_MIN, stageW - FOCUS_PANE_MIN - 30);
  layout.focusMiniWidth = Math.min(clamped, maxByFocus);
  stageEl.style.setProperty('--focus-mini-width', `${layout.focusMiniWidth}px`);
  // 그리드 열 수
  document.body.classList.remove('grid-cols-2', 'grid-cols-3', 'grid-cols-4');
  document.body.classList.add(`grid-cols-${layout.gridCols}`);
  document.querySelectorAll('.cols-btn').forEach((btn) => {
    btn.classList.toggle('is-active', Number(btn.dataset.cols) === layout.gridCols);
  });
  // 사이드바 접기
  document.body.classList.toggle('sidebar-collapsed', layout.sidebarCollapsed);
  const toggleBtn = document.getElementById('toggle-sidebar');
  if (toggleBtn) toggleBtn.title = layout.sidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기 (Ctrl/Cmd+B)';
}

function setGridCols(cols) {
  if (![2, 3, 4].includes(cols)) return;
  layout.gridCols = cols;
  saveLayout();
  applyLayout();
}

function setSidebarCollapsed(collapsed) {
  layout.sidebarCollapsed = Boolean(collapsed);
  saveLayout();
  applyLayout();
}

function refreshOne(paneKey) {
  const wv = webviewOf(paneKey);
  if (wv) {
    const fb = fallbackOf(paneKey);
    if (fb) fb.hidden = true;
    try { wv.reload(); } catch (_e) { /* webview가 아직 준비 전이면 무시 */ }
  }
}
function refreshAll() {
  PANE_LIST.forEach((p) => refreshOne(p.key));
}

async function openExternalByPane(paneKey) {
  const platform = platformOfPane(paneKey);
  let url = platform ? platform.url : null;
  // 현재 webview URL이 있으면 그것을 우선 (스냅샷 복원 후 이동한 URL 포함)
  try {
    const wv = webviewOf(paneKey);
    const current = wv && typeof wv.getURL === 'function' ? wv.getURL() : '';
    if (current && current !== 'about:blank') url = current;
  } catch (_e) { /* 무시하고 플랫폼 URL 사용 */ }
  if (!url) return;
  if (window.hub && typeof window.hub.openExternal === 'function') {
    await window.hub.openExternal(url);
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

// 구버전 호환: platform id를 받으면 기본 계정 pane으로 매핑
async function openExternal(idOrPaneKey) {
  if (findPaneEntry(idOrPaneKey)) return openExternalByPane(idOrPaneKey);
  const mapped = paneKeyFor(idOrPaneKey, 'default');
  if (findPaneEntry(mapped)) return openExternalByPane(mapped);
  return openExternalByPane(focusPaneKey);
}

// ---------------- pane 목록 / 생성 ----------------

function buildPlatformList() {
  platformListEl.innerHTML = '';
  PANE_LIST.forEach((entry) => {
    const platform = PLATFORMS.find((p) => p.id === entry.platformId);
    if (!platform) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'platform-btn' + (entry.key === focusPaneKey ? ' is-focus' : '');
    btn.dataset.paneKey = entry.key;
    btn.title = `${platform.name} (${accountLabel(entry.accountId)})`;
    btn.innerHTML = `<span class="dot" style="background:${escapeHtml(accountColor(entry.accountId))}"></span><span><span class="p-name">${escapeHtml(platform.name)} <span class="p-account">${escapeHtml(accountLabel(entry.accountId))}</span></span><span class="p-url">${escapeHtml(displayUrl(platform.url))}</span></span>`;
    btn.addEventListener('click', () => setFocus(entry.key));
    platformListEl.appendChild(btn);
  });
}

function accountSelectHtml(paneKey, accountId) {
  const options = ACCOUNTS.map((a) =>
    `<option value="${escapeHtml(a.id)}"${a.id === accountId ? ' selected' : ''}>${escapeHtml(a.name)}</option>`).join('');
  return `<select class="pane-account-select" data-account-for="${escapeHtml(paneKey)}" title="이 pane의 계정">${options}</select>`;
}

function createPane(entry, index) {
  const platform = PLATFORMS.find((p) => p.id === entry.platformId);
  if (!platform) return null;
  const section = document.createElement('section');
  section.className = 'pane' + (entry.key === focusPaneKey ? ' is-focus' : '');
  section.dataset.paneKey = entry.key;
  section.dataset.platform = entry.platformId;
  section.dataset.account = entry.accountId;
  section.dataset.order = String(index);
  section.innerHTML = `
    <div class="pane-head">
      <span class="account-dot" style="background:${escapeHtml(accountColor(entry.accountId))}" title="계정: ${escapeHtml(accountLabel(entry.accountId))}"></span>
      <span class="pane-title">${escapeHtml(platform.name)}</span>
      <span class="pane-account-label">${escapeHtml(accountLabel(entry.accountId))}</span>
      <span class="pane-url">${escapeHtml(displayUrl(platform.url))}</span>
      <span class="pane-status" data-status>대기</span>
      <div class="pane-actions">
        ${accountSelectHtml(entry.key, entry.accountId)}
        <button type="button" data-refresh="${escapeHtml(entry.key)}">새로고침</button>
        <button type="button" data-external="${escapeHtml(entry.key)}" class="secondary">외부로</button>
      </div>
    </div>
    <webview class="wv" partition="${escapeHtml(partitionForAccount(entry.accountId))}" src="${escapeHtml(platform.url)}" allowpopups></webview>
    <div class="pane-fallback" hidden>
      <p>이 페이지가 안 뜨면 새로고침하거나 외부 브라우저로 열어보세요.</p>
      <button type="button" data-retry="${escapeHtml(entry.key)}">다시 시도</button>
      <button type="button" data-external="${escapeHtml(entry.key)}">외부 브라우저로 열기</button>
    </div>`;
  return section;
}

function buildPanes() {
  // 구분선 요소는 유지하고 pane만 교체
  stageEl.querySelectorAll('.pane').forEach((el) => el.remove());
  PANE_LIST.forEach((entry, i) => {
    const pane = createPane(entry, i);
    if (pane) stageEl.appendChild(pane);
  });
  // 구분선은 stage의 마지막 자식으로 두어 그리드 배치에 영향 없게 유지
  if (dividerEl) stageEl.appendChild(dividerEl);
}

function bindWebview(wv, paneKey) {
  wv.addEventListener('did-start-loading', () => {
    const st = statusOf(paneKey);
    if (st) st.textContent = '로딩 중…';
  });
  wv.addEventListener('did-stop-loading', () => {
    const st = statusOf(paneKey);
    if (st) st.textContent = '열림';
  });
  wv.addEventListener('did-fail-load', (e) => {
    // -3 = ABORTED (정상적인 리다이렉트/중단)는 무시
    if (e.errorCode === -3) return;
    const st = statusOf(paneKey);
    if (st) st.textContent = '로드 실패';
    const fb = fallbackOf(paneKey);
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
}

function bindWebviews() {
  PANE_LIST.forEach((entry) => {
    const wv = webviewOf(entry.key);
    if (wv) bindWebview(wv, entry.key);
  });
}

// pane 목록이 바뀐 뒤 전체 재구성 (포커스 유지, 없으면 첫 번째로)
function rebuildAll() {
  if (!findPaneEntry(focusPaneKey)) {
    focusPaneKey = PANE_LIST[0].key;
  }
  buildPlatformList();
  buildPanes();
  bindWebviews();
  applySplitSecond();
  applyLayout();
  setFocus(focusPaneKey);
  setView(currentView);
}

// --- 계정 변경: Electron webview는 로드 후 partition 변경이 안 되므로
// webview 엘리먼트를 교체(재생성)하는 방식으로 구현한다. 다른 pane은 건드리지 않는다.
function changePaneAccount(oldPaneKey, newAccountId) {
  const entry = findPaneEntry(oldPaneKey);
  if (!entry) return;
  if (entry.accountId === newAccountId) return;
  if (!accountById(newAccountId)) return;
  const newKey = paneKeyFor(entry.platformId, newAccountId);
  const duplicate = PANE_LIST.find((p) => p.key === newKey);
  if (duplicate) {
    window.alert(`'${platformOfPane(oldPaneKey)?.name || entry.platformId}'을(를) '${accountLabel(newAccountId)}' 계정으로 이미 열고 있습니다.`);
    // 셀렉트 값을 원래 계정으로 되돌린다
    const pane = paneOf(oldPaneKey);
    const sel = pane ? pane.querySelector('.pane-account-select') : null;
    if (sel) sel.value = entry.accountId;
    return;
  }
  const pane = paneOf(oldPaneKey);
  const platform = platformOfPane(oldPaneKey);
  // 현재 URL 유지 (이동한 페이지가 있으면 그대로 새 파티션에서 연다)
  let currentUrl = platform ? platform.url : '';
  try {
    const oldWv = webviewOf(oldPaneKey);
    const u = oldWv && typeof oldWv.getURL === 'function' ? oldWv.getURL() : '';
    if (u && u !== 'about:blank') currentUrl = u;
  } catch (_e) { /* 플랫폼 URL로 폴백 */ }

  // 상태 갱신
  const wasFocus = focusPaneKey === oldPaneKey;
  entry.accountId = newAccountId;
  entry.key = newKey;
  if (wasFocus) focusPaneKey = newKey;
  savePanes();

  if (!pane) { rebuildAll(); return; }

  // pane DOM 갱신
  pane.dataset.paneKey = newKey;
  pane.dataset.account = newAccountId;
  const dot = pane.querySelector('.account-dot');
  if (dot) {
    dot.style.background = accountColor(newAccountId);
    dot.title = `계정: ${accountLabel(newAccountId)}`;
  }
  const label = pane.querySelector('.pane-account-label');
  if (label) label.textContent = accountLabel(newAccountId);
  pane.querySelectorAll('[data-refresh]').forEach((b) => { b.dataset.refresh = newKey; });
  pane.querySelectorAll('[data-external]').forEach((b) => { b.dataset.external = newKey; });
  pane.querySelectorAll('[data-retry]').forEach((b) => { b.dataset.retry = newKey; });
  const sel = pane.querySelector('.pane-account-select');
  if (sel) sel.dataset.accountFor = newKey;

  // webview 재생성 (partition 변경의 유일한 방법)
  const oldWv = pane.querySelector('webview');
  const fallback = pane.querySelector('.pane-fallback');
  const newWv = document.createElement('webview');
  newWv.className = 'wv';
  newWv.setAttribute('partition', partitionForAccount(newAccountId));
  newWv.setAttribute('src', currentUrl);
  newWv.setAttribute('allowpopups', '');
  if (oldWv) oldWv.remove();
  if (fallback) pane.insertBefore(newWv, fallback);
  else pane.appendChild(newWv);
  bindWebview(newWv, newKey);

  buildPlatformList();
  applySplitSecond();
  setFocus(focusPaneKey);
}

// 같은 사이트를 다른 계정으로 별도 pane으로 추가 ("계정으로 열기")
function addPaneForPlatformAccount(platformId, accountId) {
  const platform = PLATFORMS.find((p) => p.id === platformId);
  if (!platform || !accountById(accountId)) return;
  const key = paneKeyFor(platformId, accountId);
  const existing = findPaneEntry(key);
  if (existing) {
    setFocus(key);
    return;
  }
  const entry = { platformId, accountId, key };
  PANE_LIST.push(entry);
  savePanes();
  const pane = createPane(entry, PANE_LIST.length - 1);
  if (pane) {
    // 구분선 앞에 삽입 (구분선은 stage 마지막)
    if (dividerEl) stageEl.insertBefore(pane, dividerEl);
    else stageEl.appendChild(pane);
    const wv = pane.querySelector('webview');
    if (wv) bindWebview(wv, key);
  }
  buildPlatformList();
  applySplitSecond();
  applyLayout();
  setFocus(key);
}

// pane의 계정 셀렉트 값들을 현재 계정 목록에 맞게 갱신
function refreshAccountSelects() {
  document.querySelectorAll('.pane').forEach((pane) => {
    const sel = pane.querySelector('.pane-account-select');
    if (!sel) return;
    const paneKey = pane.dataset.paneKey;
    const entry = findPaneEntry(paneKey);
    if (!entry) return;
    const current = entry.accountId;
    sel.innerHTML = ACCOUNTS.map((a) =>
      `<option value="${escapeHtml(a.id)}"${a.id === current ? ' selected' : ''}>${escapeHtml(a.name)}</option>`).join('');
    sel.value = current;
    const dot = pane.querySelector('.account-dot');
    if (dot) { dot.style.background = accountColor(current); dot.title = `계정: ${accountLabel(current)}`; }
    const label = pane.querySelector('.pane-account-label');
    if (label) label.textContent = accountLabel(current);
  });
}

// ---------------- 사이트 관리 모달 (v1.1 유지 + 계정으로 열기) ----------------

const siteModal = document.getElementById('site-modal');
const siteManageListEl = document.getElementById('site-manage-list');
const siteForm = document.getElementById('site-form');
const siteNameInput = document.getElementById('site-name');
const siteUrlInput = document.getElementById('site-url');
const siteFormError = document.getElementById('site-form-error');
const siteSaveBtn = document.getElementById('site-save-btn');
const siteCancelEditBtn = document.getElementById('site-cancel-edit');
const siteCountEl = document.getElementById('site-count');

function showFormError(msg) {
  siteFormError.textContent = msg;
  siteFormError.hidden = !msg;
}

function renderSiteManager() {
  siteManageListEl.innerHTML = '';
  PLATFORMS.forEach((p) => {
    const li = document.createElement('li');
    li.className = 'site-manage-item';
    const accountOptions = ACCOUNTS.map((a) =>
      `<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`).join('');
    li.innerHTML = `
      <div class="site-info">
        <span class="site-name">${escapeHtml(p.name)}</span>
        <span class="site-url">${escapeHtml(displayUrl(p.url))}</span>
      </div>
      <select class="site-open-account" data-open-account="${escapeHtml(p.id)}" title="열 계정 선택">${accountOptions}</select>
      <button type="button" data-open-pane="${escapeHtml(p.id)}" title="선택한 계정으로 별도 pane 열기">계정으로 열기</button>
      <button type="button" data-edit="${escapeHtml(p.id)}">수정</button>
      <button type="button" data-delete="${escapeHtml(p.id)}" class="secondary">제거</button>`;
    siteManageListEl.appendChild(li);
  });
  siteCountEl.textContent = `총 ${PLATFORMS.length}개 사이트 · ${PANE_LIST.length}개 pane`;
}

function setEditMode(id) {
  editingId = id;
  if (id) {
    const target = PLATFORMS.find((p) => p.id === id);
    if (!target) { setEditMode(null); return; }
    siteNameInput.value = target.name;
    siteUrlInput.value = target.url;
    siteSaveBtn.textContent = '수정 저장';
    siteCancelEditBtn.hidden = false;
  } else {
    siteNameInput.value = '';
    siteUrlInput.value = '';
    siteSaveBtn.textContent = '사이트 추가';
    siteCancelEditBtn.hidden = true;
  }
  showFormError('');
}

function openSiteManager() {
  renderSiteManager();
  setEditMode(null);
  siteModal.hidden = false;
  siteNameInput.focus();
}

function closeSiteManager() {
  siteModal.hidden = true;
  setEditMode(null);
}

function addOrUpdateSite() {
  const name = siteNameInput.value.trim();
  if (!name) {
    showFormError('이름을 입력하세요.');
    siteNameInput.focus();
    return;
  }
  const normalized = normalizeUrl(siteUrlInput.value);
  if (!normalized.ok) {
    showFormError(normalized.message);
    siteUrlInput.focus();
    return;
  }
  if (editingId) {
    const target = PLATFORMS.find((p) => p.id === editingId);
    if (!target) { setEditMode(null); return; }
    target.name = name;
    target.url = normalized.url;
  } else {
    const newSite = { id: makeSiteId(name), name, url: normalized.url };
    PLATFORMS.push(newSite);
    // 새 사이트는 기본 계정 pane으로 추가
    PANE_LIST.push({ platformId: newSite.id, accountId: 'default', key: paneKeyFor(newSite.id, 'default') });
    savePanes();
  }
  saveSites();
  rebuildAll();
  renderSiteManager();
  setEditMode(null);
}

function deleteSite(id) {
  if (PLATFORMS.length <= 1) {
    showFormError('사이트는 최소 1개가 남아야 합니다. 제거하려면 다른 사이트를 먼저 추가하세요.');
    return;
  }
  const target = PLATFORMS.find((p) => p.id === id);
  if (!target) return;
  if (!window.confirm(`'${target.name}'을(를) 제거할까요? 모든 계정의 해당 pane도 함께 닫힙니다.`)) return;
  PLATFORMS = PLATFORMS.filter((p) => p.id !== id);
  PANE_LIST = PANE_LIST.filter((p) => p.platformId !== id);
  if (PANE_LIST.length === 0) PANE_LIST = defaultPaneList(PLATFORMS);
  if (editingId === id) setEditMode(null);
  saveSites();
  savePanes();
  rebuildAll();
  renderSiteManager();
  showFormError('');
}

function resetDefaultSites() {
  if (!window.confirm('사이트 목록을 기본 5개로 되돌릴까요? 추가한 사이트는 사라지고 pane도 기본 계정 5개로 초기화됩니다.')) return;
  PLATFORMS = cloneDefaults();
  PANE_LIST = defaultPaneList(PLATFORMS);
  focusPaneKey = PANE_LIST[0].key;
  saveSites();
  savePanes();
  rebuildAll();
  renderSiteManager();
  setEditMode(null);
}

// ---------------- 구분선 드래그 (포커스 뷰, v1.1 유지) ----------------

function bindDivider() {
  if (!dividerEl) return;
  let dragging = false;
  let startX = 0;
  let startMini = 0;
  dividerEl.addEventListener('pointerdown', (e) => {
    if (currentView !== 'focus') return;
    dragging = true;
    startX = e.clientX;
    startMini = layout.focusMiniWidth;
    dividerEl.classList.add('is-dragging');
    try { dividerEl.setPointerCapture(e.pointerId); } catch (_e) { /* 무시 */ }
    e.preventDefault();
  });
  dividerEl.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    // 미니 바가 오른쪽에 있으므로 왼쪽으로 끌면(dx<0) 미니 바가 넓어진다.
    const stageW = stageEl.clientWidth || 1200;
    const maxMini = Math.min(Math.floor(stageW * 0.8), stageW - FOCUS_PANE_MIN - 30);
    const next = Math.min(Math.max(startMini - dx, FOCUS_MINI_MIN), Math.max(FOCUS_MINI_MIN, maxMini));
    layout.focusMiniWidth = Math.round(next);
    stageEl.style.setProperty('--focus-mini-width', `${layout.focusMiniWidth}px`);
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    dividerEl.classList.remove('is-dragging');
    saveLayout();
    applyLayout();
  };
  dividerEl.addEventListener('pointerup', endDrag);
  dividerEl.addEventListener('pointercancel', endDrag);
}

// ---------------- v1.2 (1) 레이아웃 프리셋 ----------------

const BUILTIN_PRESETS = [
  { id: 'builtin-work', name: '작업용 (포커스+YouTube 크게)', builtin: true, view: 'focus', focusPlatformId: 'youtube', gridCols: 3, focusMiniWidth: 300, sidebarCollapsed: false },
  { id: 'builtin-monitor', name: '모니터링용 (그리드 3열)', builtin: true, view: 'grid', focusPlatformId: null, gridCols: 3, focusMiniWidth: 300, sidebarCollapsed: false },
  { id: 'builtin-edit', name: '편집용 (2분할)', builtin: true, view: 'split', focusPlatformId: null, gridCols: 2, focusMiniWidth: 320, sidebarCollapsed: false },
];

function loadUserPresets() {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
      .map((p) => ({
        id: String(p.id),
        name: String(p.name),
        builtin: false,
        view: ['focus', 'grid', 'list', 'split', 'full'].includes(p.view) ? p.view : 'focus',
        focusPaneKey: typeof p.focusPaneKey === 'string' ? p.focusPaneKey : null,
        focusPlatformId: typeof p.focusPlatformId === 'string' ? p.focusPlatformId : null,
        gridCols: [2, 3, 4].includes(p.gridCols) ? p.gridCols : 3,
        focusMiniWidth: typeof p.focusMiniWidth === 'number' ? Math.round(p.focusMiniWidth) : 300,
        sidebarCollapsed: Boolean(p.sidebarCollapsed),
      }));
  } catch (_e) {
    return [];
  }
}

function saveUserPresets(presets) {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch (_e) { /* 저장 실패해도 동작은 계속 */ }
}

function allPresets() {
  return [...BUILTIN_PRESETS, ...loadUserPresets()];
}

function renderPresetSelect() {
  const sel = document.getElementById('preset-select');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">프리셋 선택</option>';
  allPresets().forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });
  // 이전 선택이 남아 있으면 유지
  if (current && [...sel.options].some((o) => o.value === current)) sel.value = current;
}

function applyPreset(preset) {
  if (!preset) return;
  layout.gridCols = preset.gridCols;
  layout.focusMiniWidth = preset.focusMiniWidth;
  layout.sidebarCollapsed = preset.sidebarCollapsed;
  saveLayout();
  // 포커스: 사용자 프리셋은 paneKey 우선, 내장은 플랫폼 우선
  let targetKey = null;
  if (preset.focusPaneKey && findPaneEntry(preset.focusPaneKey)) {
    targetKey = preset.focusPaneKey;
  } else if (preset.focusPlatformId) {
    const byDefault = PANE_LIST.find((p) => p.platformId === preset.focusPlatformId && p.accountId === 'default');
    const byAny = PANE_LIST.find((p) => p.platformId === preset.focusPlatformId);
    if (byDefault) targetKey = byDefault.key;
    else if (byAny) targetKey = byAny.key;
  }
  if (targetKey) setFocus(targetKey);
  setView(preset.view);
  applyLayout();
}

function saveCurrentPreset() {
  const name = window.prompt('프리셋 이름을 입력하세요.', `프리셋 ${new Date().toLocaleString('ko-KR')}`);
  if (name === null) return;
  const trimmed = name.trim();
  if (!trimmed) { window.alert('프리셋 이름을 입력하세요.'); return; }
  const presets = loadUserPresets();
  presets.push({
    id: `preset-${Date.now()}`,
    name: trimmed,
    view: currentView,
    focusPaneKey,
    focusPlatformId: null,
    gridCols: layout.gridCols,
    focusMiniWidth: layout.focusMiniWidth,
    sidebarCollapsed: layout.sidebarCollapsed,
  });
  saveUserPresets(presets);
  renderPresetSelect();
  const sel = document.getElementById('preset-select');
  if (sel) sel.value = presets[presets.length - 1].id;
}

function deleteSelectedPreset() {
  const sel = document.getElementById('preset-select');
  if (!sel || !sel.value) { window.alert('삭제할 프리셋을 먼저 선택하세요.'); return; }
  const preset = allPresets().find((p) => p.id === sel.value);
  if (!preset) return;
  if (preset.builtin) { window.alert('기본 프리셋은 삭제할 수 없습니다.'); return; }
  if (!window.confirm(`'${preset.name}' 프리셋을 삭제할까요?`)) return;
  saveUserPresets(loadUserPresets().filter((p) => p.id !== preset.id));
  renderPresetSelect();
}

// ---------------- v1.2 (2) 단축키 + 도움말 ----------------

function isTypingTarget(target) {
  if (!target) return false;
  const tag = (target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (target.isContentEditable) return true;
  return false;
}

function handleGlobalKeydown(e) {
  const mod = e.ctrlKey || e.metaKey;
  const typing = isTypingTarget(e.target);

  // Esc: 열린 모달/팝업 닫기 (입력 중에도 동작)
  if (e.key === 'Escape') {
    if (quickSwitchOpen) { closeQuickSwitch(); return; }
    if (!document.getElementById('account-modal').hidden) { closeAccountManager(); return; }
    if (!document.getElementById('snapshot-modal').hidden) { closeSnapshotModal(); return; }
    if (!document.getElementById('help-modal').hidden) { closeHelpModal(); return; }
    if (!siteModal.hidden) { closeSiteManager(); return; }
    return;
  }

  // 빠른 전환이 열려 있을 때 Ctrl+K는 중복 동작하지 않음
  if (quickSwitchOpen && mod && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    return;
  }

  // Ctrl/Cmd+R 또는 F5: 포커스만 새로고침 (입력 중에도 브라우저 기본 새로고침 대신)
  if ((mod && (e.key === 'r' || e.key === 'R')) || e.key === 'F5') {
    e.preventDefault();
    refreshOne(focusPaneKey);
    return;
  }

  // 입력 필드 포커스 중에는 나머지 단축키 미동작
  if (typing) return;

  // Ctrl/Cmd+K: 빠른 전환
  if (mod && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    openQuickSwitch();
    return;
  }
  // Ctrl/Cmd+1~9: pane 순서대로 포커스 전환
  if (mod && /^[1-9]$/.test(e.key)) {
    const idx = Number(e.key) - 1;
    if (PANE_LIST[idx]) {
      e.preventDefault();
      setFocus(PANE_LIST[idx].key);
    }
    return;
  }
  // Ctrl/Cmd+B: 사이드바 접기/펼치기
  if (mod && (e.key === 'b' || e.key === 'B')) {
    e.preventDefault();
    setSidebarCollapsed(!layout.sidebarCollapsed);
    return;
  }
}

// ---------------- v1.2 (3) 자동 새로고침 (포커스만) ----------------

function updateAutoRefreshStatus() {
  const statusEl = document.getElementById('auto-refresh-status');
  if (!statusEl) return;
  if (autoRefreshMinutes > 0) {
    statusEl.textContent = `자동 새로고침: ${autoRefreshMinutes}분마다 · 포커스만`;
    statusEl.classList.add('is-on');
  } else {
    statusEl.textContent = '자동 새로고침: 끄기';
    statusEl.classList.remove('is-on');
  }
}

function setAutoRefresh(minutes) {
  const m = [0, 5, 15, 30].includes(Number(minutes)) ? Number(minutes) : 0;
  autoRefreshMinutes = m;
  try {
    localStorage.setItem(AUTO_REFRESH_KEY, String(m));
  } catch (_e) { /* 무시 */ }
  if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null; }
  if (m > 0) {
    autoRefreshTimer = setInterval(() => {
      refreshOne(focusPaneKey);
    }, m * 60 * 1000);
  }
  const sel = document.getElementById('auto-refresh-select');
  if (sel) sel.value = String(m);
  updateAutoRefreshStatus();
}

function initAutoRefresh() {
  let saved = 0;
  try {
    const raw = localStorage.getItem(AUTO_REFRESH_KEY);
    if (raw !== null) saved = Number(raw);
  } catch (_e) { /* 기본값 유지 */ }
  setAutoRefresh(saved);
}

// ---------------- v1.2 (4) 항상 위에 ----------------

function updateAlwaysOnTopButton() {
  const btn = document.getElementById('toggle-always-on-top');
  if (!btn) return;
  btn.classList.toggle('is-active', alwaysOnTop);
  btn.textContent = alwaysOnTop ? '📌 항상 위에 ON' : '📌 항상 위에';
  btn.title = alwaysOnTop ? '항상 위에 해제' : '창을 항상 위에 고정';
}

async function setAlwaysOnTop(enabled) {
  alwaysOnTop = Boolean(enabled);
  try {
    localStorage.setItem(ALWAYS_ON_TOP_KEY, alwaysOnTop ? '1' : '0');
  } catch (_e) { /* 무시 */ }
  updateAlwaysOnTopButton();
  try {
    if (window.hub && typeof window.hub.setAlwaysOnTop === 'function') {
      await window.hub.setAlwaysOnTop(alwaysOnTop);
    }
  } catch (_e) { /* Electron이 아닌 미리보기에서는 무시 */ }
}

function initAlwaysOnTop() {
  try {
    alwaysOnTop = localStorage.getItem(ALWAYS_ON_TOP_KEY) === '1';
  } catch (_e) {
    alwaysOnTop = false;
  }
  updateAlwaysOnTopButton();
  // main.js의 setAlwaysOnTop은 창이 없어도 desired 값으로 저장되므로, 재시작 후 복원도 안전
  if (alwaysOnTop && window.hub && typeof window.hub.setAlwaysOnTop === 'function') {
    window.hub.setAlwaysOnTop(true).catch(() => {});
  }
}

// ---------------- v1.2 (5) 계정 관리 ----------------

const accountModal = document.getElementById('account-modal');
const accountManageListEl = document.getElementById('account-manage-list');
const accountForm = document.getElementById('account-form');
const accountNameInput = document.getElementById('account-name');
const accountColorInput = document.getElementById('account-color');
const accountFormError = document.getElementById('account-form-error');

function showAccountFormError(msg) {
  accountFormError.textContent = msg;
  accountFormError.hidden = !msg;
}

function renderAccountManager() {
  accountManageListEl.innerHTML = '';
  ACCOUNTS.forEach((a) => {
    const paneCount = PANE_LIST.filter((p) => p.accountId === a.id).length;
    const li = document.createElement('li');
    li.className = 'account-manage-item';
    li.innerHTML = `
      <span class="account-dot" style="background:${escapeHtml(a.color)}"></span>
      <input type="text" class="account-name-input" data-rename="${escapeHtml(a.id)}" value="${escapeHtml(a.name)}" maxlength="30" />
      <input type="color" class="account-color-input" data-recolor="${escapeHtml(a.id)}" value="${escapeHtml(a.color)}" title="색상 라벨" />
      <span class="account-meta">${paneCount}개 pane · ${escapeHtml(a.id)}${a.id === 'default' ? ' · 기본(삭제 불가)' : ''}</span>
      <button type="button" data-account-save="${escapeHtml(a.id)}">저장</button>
      <button type="button" data-account-delete="${escapeHtml(a.id)}" class="secondary"${a.id === 'default' ? ' disabled title="기본 계정은 삭제할 수 없습니다"' : ''}>제거</button>`;
    accountManageListEl.appendChild(li);
  });
}

function openAccountManager() {
  renderAccountManager();
  showAccountFormError('');
  accountModal.hidden = false;
  accountNameInput.focus();
}

function closeAccountManager() {
  accountModal.hidden = true;
  showAccountFormError('');
}

function addAccount() {
  const name = accountNameInput.value.trim();
  if (!name) {
    showAccountFormError('계정 이름을 입력하세요.');
    accountNameInput.focus();
    return;
  }
  const color = accountColorInput.value || '#4da3ff';
  const id = makeAccountId(name);
  ACCOUNTS.push({ id, name, color });
  saveAccounts();
  renderAccountManager();
  buildPlatformList();
  refreshAccountSelects();
  accountNameInput.value = '';
  // 다음 추가 시 색상이 겹치지 않게 팔레트 순환
  const used = ACCOUNTS.map((a) => a.color);
  accountColorInput.value = ACCOUNT_COLORS.find((c) => !used.includes(c)) || '#4da3ff';
  showAccountFormError('');
}

function saveAccountEdit(id) {
  const account = accountById(id);
  if (!account) return;
  const nameInput = accountManageListEl.querySelector(`[data-rename="${CSS.escape(id)}"]`);
  const colorInput = accountManageListEl.querySelector(`[data-recolor="${CSS.escape(id)}"]`);
  const newName = nameInput ? nameInput.value.trim() : '';
  if (!newName) {
    showAccountFormError('계정 이름을 입력하세요.');
    return;
  }
  account.name = newName;
  if (colorInput && colorInput.value) account.color = colorInput.value;
  saveAccounts();
  renderAccountManager();
  buildPlatformList();
  refreshAccountSelects();
  showAccountFormError('');
}

function deleteAccount(id) {
  if (id === 'default') {
    showAccountFormError('기본 계정은 삭제할 수 없습니다.');
    return;
  }
  if (ACCOUNTS.length <= 1) {
    showAccountFormError('계정은 최소 1개가 남아야 합니다.');
    return;
  }
  const account = accountById(id);
  if (!account) return;
  if (!window.confirm(`'${account.name}' 계정을 제거할까요? 이 계정의 pane은 기본 계정으로 옮겨지거나(같은 사이트의 기본 pane이 이미 있으면 닫힙니다), 세션은 파티션에 남아 있습니다.`)) return;
  // 이 계정의 pane 처리: 같은 플랫폼의 기본 pane이 있으면 중복이므로 제거, 없으면 기본 계정으로 이동
  const nextPanes = [];
  PANE_LIST.forEach((entry) => {
    if (entry.accountId !== id) { nextPanes.push(entry); return; }
    const defaultKey = paneKeyFor(entry.platformId, 'default');
    if (nextPanes.some((p) => p.key === defaultKey) || PANE_LIST.some((p) => p.key === defaultKey && p.accountId === 'default')) {
      return; // 중복 pane은 제거
    }
    nextPanes.push({ platformId: entry.platformId, accountId: 'default', key: defaultKey });
  });
  PANE_LIST = nextPanes;
  ACCOUNTS = ACCOUNTS.filter((a) => a.id !== id);
  saveAccounts();
  savePanes();
  renderAccountManager();
  rebuildAll();
  showAccountFormError('');
}

// ---------------- 도움말 모달 ----------------

function openHelpModal() {
  document.getElementById('help-modal').hidden = false;
}
function closeHelpModal() {
  document.getElementById('help-modal').hidden = true;
}

// ---------------- v1.2 (6) 빠른 전환 (Ctrl/Cmd+K) ----------------

const quickSwitchEl = document.getElementById('quick-switch');
const quickSwitchInput = document.getElementById('quick-switch-input');
const quickSwitchListEl = document.getElementById('quick-switch-list');

function quickSwitchCandidates(query) {
  const q = String(query || '').trim().toLowerCase();
  const all = PANE_LIST.map((entry) => {
    const platform = PLATFORMS.find((p) => p.id === entry.platformId);
    return { entry, platform, account: accountById(entry.accountId) };
  }).filter((c) => c.platform);
  if (!q) return all;
  return all.filter((c) => {
    const hay = `${c.platform.name} ${c.platform.url} ${c.account ? c.account.name : ''} ${c.entry.key}`.toLowerCase();
    return hay.includes(q);
  });
}

function renderQuickSwitchList() {
  const candidates = quickSwitchCandidates(quickSwitchInput.value);
  quickSwitchIndex = Math.min(Math.max(0, quickSwitchIndex), Math.max(0, candidates.length - 1));
  quickSwitchListEl.innerHTML = '';
  if (candidates.length === 0) {
    const li = document.createElement('li');
    li.className = 'quick-switch-empty';
    li.textContent = '검색 결과가 없습니다.';
    quickSwitchListEl.appendChild(li);
    return;
  }
  candidates.forEach((c, i) => {
    const li = document.createElement('li');
    li.className = 'quick-switch-item' + (i === quickSwitchIndex ? ' is-selected' : '');
    li.dataset.index = String(i);
    li.innerHTML = `<span class="account-dot" style="background:${escapeHtml(c.account ? c.account.color : '#8b9bb4')}"></span><span class="qs-name">${escapeHtml(c.platform.name)} <span class="p-account">${escapeHtml(c.account ? c.account.name : c.entry.accountId)}</span></span><span class="qs-url">${escapeHtml(displayUrl(c.platform.url))}</span>`;
    li.addEventListener('click', () => {
      setFocus(c.entry.key);
      closeQuickSwitch();
    });
    quickSwitchListEl.appendChild(li);
  });
}

function openQuickSwitch() {
  quickSwitchOpen = true;
  quickSwitchIndex = 0;
  quickSwitchEl.hidden = false;
  quickSwitchInput.value = '';
  renderQuickSwitchList();
  // 입력 필드에 포커스 (이후 Ctrl+K는 중복 동작 방지 로직이 막는다)
  setTimeout(() => quickSwitchInput.focus(), 0);
}

function closeQuickSwitch() {
  quickSwitchOpen = false;
  quickSwitchEl.hidden = true;
  quickSwitchInput.blur();
}

function quickSwitchConfirm() {
  const candidates = quickSwitchCandidates(quickSwitchInput.value);
  const target = candidates[quickSwitchIndex];
  if (target) setFocus(target.entry.key);
  closeQuickSwitch();
}

// ---------------- v1.2 (7) 북마크 스냅샷 ----------------

const snapshotModal = document.getElementById('snapshot-modal');
const snapshotListEl = document.getElementById('snapshot-list');

function loadSnapshots() {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s) => s && typeof s.id === 'string' && Array.isArray(s.panes));
  } catch (_e) {
    return [];
  }
}

function saveSnapshots(list) {
  try {
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(list));
  } catch (_e) { /* 무시 */ }
}

function currentPaneUrl(entry) {
  try {
    const wv = webviewOf(entry.key);
    const u = wv && typeof wv.getURL === 'function' ? wv.getURL() : '';
    if (u && u !== 'about:blank') return u;
  } catch (_e) { /* 플랫폼 URL로 폴백 */ }
  const platform = PLATFORMS.find((p) => p.id === entry.platformId);
  return platform ? platform.url : '';
}

function saveCurrentSnapshot() {
  const defaultName = `스냅샷 ${new Date().toLocaleString('ko-KR')}`;
  const name = window.prompt('스냅샷 이름을 입력하세요.', defaultName);
  if (name === null) return;
  const trimmed = name.trim() || defaultName;
  const snapshot = {
    id: `snap-${Date.now()}`,
    name: trimmed,
    createdAt: Date.now(),
    panes: PANE_LIST.map((entry) => ({ platformId: entry.platformId, accountId: entry.accountId, url: currentPaneUrl(entry) })),
    focusPaneKey,
    view: currentView,
    gridCols: layout.gridCols,
    focusMiniWidth: layout.focusMiniWidth,
    sidebarCollapsed: layout.sidebarCollapsed,
  };
  const list = loadSnapshots();
  list.unshift(snapshot);
  saveSnapshots(list);
  renderSnapshotList();
}

function renderSnapshotList() {
  const list = loadSnapshots();
  snapshotListEl.innerHTML = '';
  if (list.length === 0) {
    const li = document.createElement('li');
    li.className = 'snapshot-empty';
    li.textContent = '저장된 스냅샷이 없습니다. "현재 상태 스냅샷 저장"을 눌러 저장하세요.';
    snapshotListEl.appendChild(li);
    return;
  }
  list.forEach((s) => {
    const li = document.createElement('li');
    li.className = 'snapshot-item';
    const when = new Date(s.createdAt).toLocaleString('ko-KR');
    li.innerHTML = `
      <div class="snapshot-info">
        <span class="snapshot-name">${escapeHtml(s.name)}</span>
        <span class="snapshot-meta">${escapeHtml(when)} · ${s.panes.length}개 pane · ${escapeHtml(s.view)}</span>
      </div>
      <button type="button" data-snapshot-restore="${escapeHtml(s.id)}">복원</button>
      <button type="button" data-snapshot-delete="${escapeHtml(s.id)}" class="secondary">삭제</button>`;
    snapshotListEl.appendChild(li);
  });
}

function restoreSnapshot(id) {
  const snapshot = loadSnapshots().find((s) => s.id === id);
  if (!snapshot) return;
  if (!window.confirm(`'${snapshot.name}' 스냅샷을 복원할까요? 현재 pane 구성과 URL이 스냅샷 상태로 바뀝니다.`)) return;
  // 스냅샷에 있는 계정이 현재 계정 목록에 없으면 같은 id로 복원 (파티션 유지)
  snapshot.panes.forEach((p) => {
    if (p.accountId !== 'default' && !accountById(p.accountId)) {
      ACCOUNTS.push({ id: p.accountId, name: `복원 ${p.accountId}`, color: '#8b9bb4' });
    }
  });
  saveAccounts();
  // 삭제된 사이트의 pane은 제외, paneKey 중복 제거
  const seen = new Set();
  const nextPanes = [];
  snapshot.panes.forEach((p) => {
    if (!PLATFORMS.some((pl) => pl.id === p.platformId)) return;
    const key = paneKeyFor(p.platformId, p.accountId);
    if (seen.has(key)) return;
    seen.add(key);
    nextPanes.push({ platformId: p.platformId, accountId: p.accountId, key, savedUrl: p.url });
  });
  if (nextPanes.length === 0) {
    window.alert('복원할 수 있는 pane이 없습니다. (사이트가 모두 삭제됨)');
    return;
  }
  PANE_LIST = nextPanes.map(({ platformId, accountId, key }) => ({ platformId, accountId, key }));
  savePanes();
  layout.gridCols = [2, 3, 4].includes(snapshot.gridCols) ? snapshot.gridCols : 3;
  layout.focusMiniWidth = typeof snapshot.focusMiniWidth === 'number' ? Math.round(snapshot.focusMiniWidth) : 300;
  layout.sidebarCollapsed = Boolean(snapshot.sidebarCollapsed);
  saveLayout();
  focusPaneKey = nextPanes.some((p) => p.key === snapshot.focusPaneKey) ? snapshot.focusPaneKey : nextPanes[0].key;
  rebuildAll();
  // 각 pane URL을 저장된 URL로 로드 (플랫폼 기본 URL이 아닌 스냅샷 URL)
  nextPanes.forEach((p) => {
    const wv = webviewOf(p.key);
    if (wv && p.savedUrl && typeof p.savedUrl === 'string') {
      try { wv.src = p.savedUrl; } catch (_e) { /* 무시 */ }
    }
  });
  if (['focus', 'grid', 'list', 'split', 'full'].includes(snapshot.view)) setView(snapshot.view);
  setFocus(focusPaneKey);
  renderAccountManager();
  closeSnapshotModal();
}

function deleteSnapshot(id) {
  const snapshot = loadSnapshots().find((s) => s.id === id);
  if (!snapshot) return;
  if (!window.confirm(`'${snapshot.name}' 스냅샷을 삭제할까요?`)) return;
  saveSnapshots(loadSnapshots().filter((s) => s.id !== id));
  renderSnapshotList();
}

function openSnapshotModal() {
  renderSnapshotList();
  snapshotModal.hidden = false;
}
function closeSnapshotModal() {
  snapshotModal.hidden = true;
}

// ---------------- 컨트롤 바인딩 ----------------

function bindControls() {
  document.querySelectorAll('.view-btn').forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });
  document.querySelectorAll('.cols-btn').forEach((btn) => {
    btn.addEventListener('click', () => setGridCols(Number(btn.dataset.cols)));
  });
  document.getElementById('toggle-sidebar').addEventListener('click', () => {
    setSidebarCollapsed(!layout.sidebarCollapsed);
  });
  document.getElementById('refresh-all').addEventListener('click', refreshAll);
  document.getElementById('open-focused-external').addEventListener('click', () => openExternalByPane(focusPaneKey));

  // v1.2: 프리셋
  document.getElementById('preset-select').addEventListener('change', (e) => {
    const preset = allPresets().find((p) => p.id === e.target.value);
    if (preset) applyPreset(preset);
  });
  document.getElementById('save-preset').addEventListener('click', saveCurrentPreset);
  document.getElementById('delete-preset').addEventListener('click', deleteSelectedPreset);

  // v1.2: 자동 새로고침
  document.getElementById('auto-refresh-select').addEventListener('change', (e) => {
    setAutoRefresh(e.target.value);
  });

  // v1.2: 항상 위에
  document.getElementById('toggle-always-on-top').addEventListener('click', () => {
    setAlwaysOnTop(!alwaysOnTop);
  });

  // v1.2: 계정 관리 모달
  document.getElementById('open-account-manager').addEventListener('click', openAccountManager);
  document.getElementById('close-account-modal').addEventListener('click', closeAccountManager);
  accountModal.addEventListener('click', (e) => {
    if (e.target === accountModal) closeAccountManager();
  });
  accountForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addAccount();
  });
  accountManageListEl.addEventListener('click', (e) => {
    const saveBtn = e.target.closest('[data-account-save]');
    const delBtn = e.target.closest('[data-account-delete]');
    if (saveBtn) saveAccountEdit(saveBtn.dataset.accountSave);
    if (delBtn) deleteAccount(delBtn.dataset.accountDelete);
  });

  // v1.2: 도움말 모달
  document.getElementById('open-help-modal').addEventListener('click', openHelpModal);
  document.getElementById('close-help-modal').addEventListener('click', closeHelpModal);
  document.getElementById('help-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('help-modal')) closeHelpModal();
  });

  // v1.2: 스냅샷 모달
  document.getElementById('open-snapshot-modal').addEventListener('click', openSnapshotModal);
  document.getElementById('close-snapshot-modal').addEventListener('click', closeSnapshotModal);
  snapshotModal.addEventListener('click', (e) => {
    if (e.target === snapshotModal) closeSnapshotModal();
  });
  document.getElementById('save-snapshot-btn').addEventListener('click', saveCurrentSnapshot);
  snapshotListEl.addEventListener('click', (e) => {
    const restoreBtn = e.target.closest('[data-snapshot-restore]');
    const deleteBtn = e.target.closest('[data-snapshot-delete]');
    if (restoreBtn) restoreSnapshot(restoreBtn.dataset.snapshotRestore);
    if (deleteBtn) deleteSnapshot(deleteBtn.dataset.snapshotDelete);
  });

  // v1.2: 빠른 전환
  document.getElementById('open-quick-switch').addEventListener('click', openQuickSwitch);
  quickSwitchEl.addEventListener('click', (e) => {
    if (e.target === quickSwitchEl) closeQuickSwitch();
  });
  quickSwitchInput.addEventListener('input', () => {
    quickSwitchIndex = 0;
    renderQuickSwitchList();
  });
  quickSwitchInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const count = quickSwitchCandidates(quickSwitchInput.value).length;
      if (count > 0) quickSwitchIndex = (quickSwitchIndex + 1) % count;
      renderQuickSwitchList();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const count = quickSwitchCandidates(quickSwitchInput.value).length;
      if (count > 0) quickSwitchIndex = (quickSwitchIndex - 1 + count) % count;
      renderQuickSwitchList();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      quickSwitchConfirm();
    }
    // Esc은 전역 handleGlobalKeydown이 처리 (중복 방지)
  });

  // 사이트 관리 모달
  document.getElementById('open-site-manager').addEventListener('click', openSiteManager);
  document.getElementById('close-site-modal').addEventListener('click', closeSiteManager);
  siteModal.addEventListener('click', (e) => {
    if (e.target === siteModal) closeSiteManager();
  });
  // Esc은 전역 handleGlobalKeydown이 모든 모달을 처리
  document.addEventListener('keydown', handleGlobalKeydown);
  siteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addOrUpdateSite();
  });
  siteCancelEditBtn.addEventListener('click', () => setEditMode(null));
  document.getElementById('reset-default-sites').addEventListener('click', resetDefaultSites);
  siteManageListEl.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-edit]');
    const delBtn = e.target.closest('[data-delete]');
    const openBtn = e.target.closest('[data-open-pane]');
    if (editBtn) setEditMode(editBtn.dataset.edit);
    if (delBtn) deleteSite(delBtn.dataset.delete);
    if (openBtn) {
      const platformId = openBtn.dataset.openPane;
      const sel = siteManageListEl.querySelector(`[data-open-account="${CSS.escape(platformId)}"]`);
      const accountId = sel ? sel.value : 'default';
      addPaneForPlatformAccount(platformId, accountId);
      renderSiteManager();
    }
  });

  // 각 pane의 새로고침 / 외부로 / 다시 시도 / 계정 변경 (이벤트 위임)
  stageEl.addEventListener('click', (e) => {
    const refreshBtn = e.target.closest('[data-refresh]');
    const externalBtn = e.target.closest('[data-external]');
    const retryBtn = e.target.closest('[data-retry]');
    if (refreshBtn) refreshOne(refreshBtn.dataset.refresh);
    if (retryBtn) refreshOne(retryBtn.dataset.retry);
    if (externalBtn) openExternalByPane(externalBtn.dataset.external);
  });
  stageEl.addEventListener('change', (e) => {
    const sel = e.target.closest('.pane-account-select');
    if (sel && sel.dataset.accountFor) {
      changePaneAccount(sel.dataset.accountFor, sel.value);
    }
  });

  // 창 크기 변경 시 미니 바 너비 재클램프
  window.addEventListener('resize', () => applyLayout());
  bindDivider();
}

buildPlatformList();
buildPanes();
bindControls();
bindWebviews();
renderPresetSelect();
initAutoRefresh();
initAlwaysOnTop();
applyLayout();
setFocus(focusPaneKey);
setView('focus');
