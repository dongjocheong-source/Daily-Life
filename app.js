/* =========================================================
   싱크님의 일상 — app.js
   화면 전환, 글쓰기(작성/수정/삭제), 데일리 로그, 구글 드라이브 동기화
   ========================================================= */

const views = document.querySelectorAll('.view');
const leaves = document.querySelectorAll('.leaf');
const navGroups = document.querySelectorAll('.nav-group');
const navHeads = document.querySelectorAll('.nav-head');
const subButtons = document.querySelectorAll('.nav-sub button');

function clearActiveNav() {
  navHeads.forEach(h => h.classList.remove('current'));
  subButtons.forEach(b => b.classList.remove('active'));
}

function showView(id) {
  views.forEach(v => v.classList.remove('active'));
  leaves.forEach(l => l.classList.remove('active'));
  const target = document.getElementById('view-' + id);
  if (target) target.classList.add('active');
  clearActiveNav();
  const head = document.querySelector('.nav-head[data-view="' + id + '"]');
  if (head) head.classList.add('current');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showLeaf(id) {
  views.forEach(v => v.classList.remove('active'));
  leaves.forEach(l => l.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
  clearActiveNav();
  const btn = document.querySelector('.nav-sub button[data-target="' + id + '"]');
  if (btn) btn.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('brandHome').addEventListener('click', () => showView('home'));

navHeads.forEach(head => {
  head.addEventListener('click', () => {
    const group = head.closest('.nav-group');
    const hasSub = group.querySelector('.nav-sub');
    if (hasSub) {
      const isOpen = group.classList.contains('open');
      navGroups.forEach(g => g.classList.remove('open'));
      if (!isOpen) group.classList.add('open');
    }
    showView(head.dataset.view);
  });
});

document.querySelectorAll('.card[data-target], .tl-item[data-target]').forEach(el => {
  el.addEventListener('click', () => showLeaf(el.dataset.target));
});

document.querySelectorAll('.card[data-view]').forEach(el => {
  el.addEventListener('click', () => showView(el.dataset.view));
});

subButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    showLeaf(btn.dataset.target);
  });
});

document.querySelectorAll('[data-back]').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.back));
});

/* ---------- Toast ---------- */
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 1200);
}

/* ---------- Supabase 동기화 (이메일 매직링크 로그인) ---------- */
// SUPABASE_URL / SUPABASE_ANON_KEY 는 config.js 에서 정의합니다.
const sb = (window.supabase && typeof SUPABASE_URL !== 'undefined')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

let currentUser = null;
let syncing = false;

const authStatus = document.getElementById('authStatus');
const authForm = document.getElementById('authForm');
const authEmailInput = document.getElementById('authEmail');
const authSendLinkBtn = document.getElementById('authSendLink');
const authLogoutBtn = document.getElementById('authLogout');

function setAuthStatus(msg) { if (authStatus) authStatus.textContent = msg; }

function nowTimeLabel() {
  const now = new Date();
  return now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
}

function updateAuthUI() {
  if (!authForm || !authLogoutBtn) return;
  if (currentUser) {
    setAuthStatus('✓ ' + currentUser.email + ' 로그인됨');
    authForm.style.display = 'none';
    authLogoutBtn.style.display = 'block';
  } else {
    setAuthStatus('로그인하면 기기 간 동기화됩니다');
    authForm.style.display = 'flex';
    authLogoutBtn.style.display = 'none';
  }
}

function getSyncPayload() {
  return { posts: postsStore, dailyLog: entries, savedAt: new Date().toISOString() };
}

function applySyncPayload(payload) {
  if (payload && payload.posts) {
    postsStore = payload.posts;
    try { localStorage.setItem(POSTS_KEY, JSON.stringify(postsStore)); } catch (e) { /* quota */ }
  }
  if (payload && payload.dailyLog) {
    entries = payload.dailyLog;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch (e) { /* quota */ }
  }
  document.querySelectorAll('.posts-app').forEach(app => renderPostsApp(app));
  renderCalendar();
}

async function pullFromSupabase() {
  if (!sb || !currentUser || syncing) return;
  syncing = true;
  setAuthStatus('동기화 중...');
  try {
    const { data, error } = await sb
      .from('app_data')
      .select('data')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (error) throw error;
    if (data && data.data) {
      applySyncPayload(data.data);
      toast('Supabase와 동기화됨 ✓');
    } else {
      await pushToSupabase();
      toast('Supabase에 저장 시작됨 ✓');
    }
    setAuthStatus('✓ 연결됨 · 마지막 동기화 ' + nowTimeLabel());
  } catch (e) {
    console.error(e);
    setAuthStatus('동기화 중 오류가 발생했습니다.');
  } finally {
    syncing = false;
  }
}

async function pushToSupabase() {
  if (!sb || !currentUser) return;
  try {
    const { error } = await sb
      .from('app_data')
      .upsert({ user_id: currentUser.id, data: getSyncPayload(), updated_at: new Date().toISOString() });
    if (error) throw error;
    setAuthStatus('✓ 연결됨 · 마지막 동기화 ' + nowTimeLabel());
  } catch (e) {
    console.error(e);
    setAuthStatus('동기화 실패 (다음 저장 시 재시도)');
  }
}

function handleSession(session) {
  currentUser = session ? session.user : null;
  updateAuthUI();
  if (currentUser) pullFromSupabase();
}

async function initAuth() {
  if (!sb) {
    setAuthStatus('Supabase 설정이 필요합니다 (config.js 확인)');
    return;
  }
  const { data } = await sb.auth.getSession();
  handleSession(data.session);
  sb.auth.onAuthStateChange((_event, session) => handleSession(session));
}

if (authSendLinkBtn) {
  authSendLinkBtn.addEventListener('click', async () => {
    if (!sb) { alert('Supabase 설정이 필요합니다. config.js를 확인해주세요.'); return; }
    const email = authEmailInput.value.trim();
    if (!email) { alert('이메일을 입력해주세요.'); return; }
    authSendLinkBtn.disabled = true;
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname }
    });
    authSendLinkBtn.disabled = false;
    if (error) { alert('로그인 링크 전송 실패: ' + error.message); return; }
    toast('로그인 링크를 이메일로 보냈어요 ✉️');
  });
}

if (authLogoutBtn) {
  authLogoutBtn.addEventListener('click', async () => {
    if (!sb) return;
    await sb.auth.signOut();
    toast('로그아웃 되었습니다');
  });
}

initAuth();

/* ---------- Posts (글쓰기: 주제/제목/내용, 추가·수정) ---------- */
const POSTS_KEY = 'sync-posts-v1';
let postsStore = {};
try { postsStore = JSON.parse(localStorage.getItem(POSTS_KEY) || '{}'); } catch (e) { postsStore = {}; }

function savePosts() {
  try {
    localStorage.setItem(POSTS_KEY, JSON.stringify(postsStore));
    pushToSupabase();
  } catch (e) {
    alert('저장 공간이 부족합니다. 첨부 파일 용량/개수를 줄여주세요.');
  }
}
function uid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function linkify(text) {
  const escaped = escapeHtml(text || '');
  const urlRegex = /((https?:\/\/|www\.)[^\s<]+)/gi;
  return escaped.replace(urlRegex, (match) => {
    let href = match;
    if (!/^https?:\/\//i.test(href)) href = 'https://' + href;
    return '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + match + '</a>';
  });
}

function isImageType(type) { return !!type && type.indexOf('image/') === 0; }

function buildAttachmentChip(att, onDelete) {
  const isImg = isImageType(att.type);
  const chip = document.createElement(onDelete ? 'div' : 'a');
  chip.className = 'att-chip';
  if (!onDelete) {
    chip.href = att.dataUrl;
    chip.target = '_blank';
    chip.rel = 'noopener noreferrer';
    chip.download = att.name || 'file';
  }
  if (isImg) {
    const img = document.createElement('img');
    img.className = 'att-thumb';
    img.src = att.dataUrl;
    chip.appendChild(img);
  } else {
    const icon = document.createElement('span');
    icon.textContent = '📄';
    chip.appendChild(icon);
  }
  const nameEl = document.createElement('span');
  nameEl.className = 'att-name';
  nameEl.textContent = att.name || '파일';
  chip.appendChild(nameEl);
  if (onDelete) {
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'att-del';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', onDelete);
    chip.appendChild(delBtn);
  }
  return chip;
}

function getCategory(app) {
  const leaf = app.closest('.leaf');
  const h2 = leaf ? leaf.querySelector('.page-header h2') : null;
  return h2 ? h2.textContent.trim() : '';
}

function buildPostForm(initial, category) {
  const form = document.createElement('div');
  form.className = 'post-form';

  if (category) {
    const catEl = document.createElement('div');
    catEl.className = 'post-category';
    catEl.textContent = category;
    form.appendChild(catEl);
  }

  const row1 = document.createElement('div');
  row1.className = 'post-row1';
  const topicInput = document.createElement('input');
  topicInput.className = 'post-topic-input';
  topicInput.placeholder = '주제';
  topicInput.value = initial ? (initial.topic || '') : '';
  const titleInput = document.createElement('input');
  titleInput.className = 'post-title-input';
  titleInput.placeholder = '제목';
  titleInput.value = initial ? (initial.title || '') : '';
  row1.appendChild(topicInput);
  row1.appendChild(titleInput);

  const contentInput = document.createElement('textarea');
  contentInput.className = 'post-content-input';
  contentInput.placeholder = '내용을 입력하세요 (URL을 포함하면 자동으로 링크가 됩니다)';
  contentInput.value = initial ? (initial.content || '') : '';

  /* ---- attachments (사진/파일 첨부 + 삭제) ---- */
  const attachments = initial && Array.isArray(initial.attachments)
    ? initial.attachments.map(a => Object.assign({}, a))
    : [];

  const attachRow = document.createElement('div');
  attachRow.className = 'attach-btn-row';
  const attachBtn = document.createElement('button');
  attachBtn.type = 'button';
  attachBtn.className = 'btn-ghost';
  attachBtn.textContent = '📎 사진/파일 첨부';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.hwp,.txt,.zip';
  fileInput.style.display = 'none';
  attachBtn.addEventListener('click', () => fileInput.click());
  attachRow.appendChild(attachBtn);
  attachRow.appendChild(fileInput);

  const attachPreview = document.createElement('div');
  attachPreview.className = 'post-attachments';

  function renderAttachPreview() {
    attachPreview.innerHTML = '';
    attachments.forEach((att, idx) => {
      const chip = buildAttachmentChip(att, () => {
        attachments.splice(idx, 1);
        renderAttachPreview();
      });
      attachPreview.appendChild(chip);
    });
  }
  renderAttachPreview();

  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        attachments.push({ name: file.name, type: file.type, dataUrl: reader.result });
        renderAttachPreview();
      };
      reader.readAsDataURL(file);
    });
    fileInput.value = '';
  });

  const actions = document.createElement('div');
  actions.className = 'post-form-actions';
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = '저장';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn-ghost';
  cancelBtn.textContent = '취소';
  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);

  form.appendChild(row1);
  form.appendChild(contentInput);
  form.appendChild(attachRow);
  form.appendChild(attachPreview);
  form.appendChild(actions);

  return { form, topicInput, titleInput, contentInput, saveBtn, cancelBtn, attachments };
}

function renderPostCard(app, post) {
  const card = document.createElement('div');
  card.className = 'post-card';

  const category = getCategory(app);
  if (category) {
    const catEl = document.createElement('div');
    catEl.className = 'post-category';
    catEl.textContent = category;
    card.appendChild(catEl);
  }

  const row1 = document.createElement('div');
  row1.className = 'post-row1';
  const topicEl = document.createElement('div');
  topicEl.className = 'post-topic';
  topicEl.textContent = '주제: ' + (post.topic || '(없음)');
  const titleEl = document.createElement('div');
  titleEl.className = 'post-title';
  titleEl.textContent = '제목: ' + (post.title || '(없음)');
  row1.appendChild(topicEl);
  row1.appendChild(titleEl);

  const contentEl = document.createElement('div');
  contentEl.className = 'post-content';
  contentEl.innerHTML = linkify(post.content || '');

  const actions = document.createElement('div');
  actions.className = 'post-actions';
  const editBtn = document.createElement('button');
  editBtn.className = 'btn-ghost';
  editBtn.textContent = '✏️ 수정';
  editBtn.addEventListener('click', () => showEditForm(app, card, post));
  const delBtn = document.createElement('button');
  delBtn.className = 'btn-ghost danger';
  delBtn.textContent = '🗑 삭제';
  delBtn.addEventListener('click', () => {
    if (confirm('정말 삭제하시겠습니까?')) {
      const leafId = app.dataset.leaf;
      postsStore[leafId] = (postsStore[leafId] || []).filter(p => p.id !== post.id);
      savePosts();
      toast('삭제됨');
      renderPostsApp(app);
    }
  });
  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  card.appendChild(row1);
  card.appendChild(contentEl);

  if (Array.isArray(post.attachments) && post.attachments.length) {
    const attWrap = document.createElement('div');
    attWrap.className = 'post-attachments';
    post.attachments.forEach(att => attWrap.appendChild(buildAttachmentChip(att, null)));
    card.appendChild(attWrap);
  }

  card.appendChild(actions);
  return card;
}

function renderPostsApp(app) {
  const leafId = app.dataset.leaf;
  const posts = postsStore[leafId] || [];
  app.innerHTML = '';

  const toolbar = document.createElement('div');
  toolbar.className = 'posts-toolbar';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.textContent = '+ 새 글쓰기';
  addBtn.addEventListener('click', () => showAddForm(app));
  toolbar.appendChild(addBtn);
  app.appendChild(toolbar);

  const formSlot = document.createElement('div');
  formSlot.className = 'post-form-slot';
  app.appendChild(formSlot);

  const list = document.createElement('div');
  list.className = 'posts-list';
  app.appendChild(list);

  if (posts.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'posts-empty';
    empty.textContent = '아직 작성된 글이 없습니다. "+ 새 글쓰기"로 시작해보세요.';
    list.appendChild(empty);
  } else {
    posts.forEach(post => list.appendChild(renderPostCard(app, post)));
  }
}

function showAddForm(app) {
  const leafId = app.dataset.leaf;
  const slot = app.querySelector('.post-form-slot');
  slot.innerHTML = '';
  const { form, topicInput, titleInput, contentInput, saveBtn, cancelBtn, attachments } = buildPostForm(null, getCategory(app));
  slot.appendChild(form);
  topicInput.focus();

  saveBtn.addEventListener('click', () => {
    const topic = topicInput.value.trim();
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    if (!title && !content && attachments.length === 0) { alert('제목, 내용 또는 첨부파일을 추가해주세요.'); return; }
    postsStore[leafId] = postsStore[leafId] || [];
    postsStore[leafId].unshift({ id: uid(), topic, title, content, attachments });
    savePosts();
    toast('저장됨 ✓');
    renderPostsApp(app);
  });
  cancelBtn.addEventListener('click', () => { slot.innerHTML = ''; });
}

function showEditForm(app, card, post) {
  const { form, topicInput, titleInput, contentInput, saveBtn, cancelBtn, attachments } = buildPostForm(post, getCategory(app));
  card.replaceWith(form);

  saveBtn.addEventListener('click', () => {
    post.topic = topicInput.value.trim();
    post.title = titleInput.value.trim();
    post.content = contentInput.value.trim();
    post.attachments = attachments;
    savePosts();
    toast('저장됨 ✓');
    renderPostsApp(app);
  });
  cancelBtn.addEventListener('click', () => { renderPostsApp(app); });
}

function initPostsApps() {
  document.querySelectorAll('.posts-app').forEach(app => {
    const leafId = app.dataset.leaf;
    if (!postsStore[leafId]) {
      let seed = [];
      try { seed = JSON.parse(app.dataset.seed || '[]'); } catch (e) { seed = []; }
      postsStore[leafId] = seed.map(s => ({ id: uid(), topic: s.topic, title: s.title, content: s.content }));
      savePosts();
    }
    renderPostsApp(app);
  });
}

initPostsApps();

/* ---------- Daily Log calendar logic ---------- */
const STORAGE_KEY = 'sync-daily-log-entries';
let entries = {};
try { entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { entries = {}; }

function saveEntries() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    alert('저장 공간이 부족합니다.');
  }
  pushToSupabase();
}

let calDate = new Date();
let selectedDate = null;
let selectedMood = null;

const pad = n => String(n).padStart(2, '0');
const dateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const calGrid = document.getElementById('calGrid');
const calMonthLabel = document.getElementById('calMonthLabel');
const selDateLabel = document.getElementById('selDateLabel');
const memoInput = document.getElementById('memoInput');
const moodRow = document.getElementById('moodRow');

function renderCalendar() {
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  calMonthLabel.textContent = `${year}년 ${month + 1}월`;

  calGrid.innerHTML = '';
  ['일','월','화','수','목','금','토'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-dow';
    el.textContent = d;
    calGrid.appendChild(el);
  });

  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = dateStr(new Date());

  for (let i = 0; i < startOffset; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-day blank';
    calGrid.appendChild(blank);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(year, month, d);
    const cellStr = dateStr(cellDate);
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    if (cellStr === todayStr) cell.classList.add('today');
    if (cellStr === selectedDate) cell.classList.add('selected');

    const num = document.createElement('div');
    num.textContent = d;
    cell.appendChild(num);

    if (entries[cellStr]) {
      const mood = document.createElement('div');
      mood.className = 'mood';
      mood.textContent = entries[cellStr].mood || '•';
      cell.appendChild(mood);
    }

    cell.addEventListener('click', () => selectDate(cellStr));
    calGrid.appendChild(cell);
  }
}

function selectDate(str) {
  selectedDate = str;
  const entry = entries[str];
  selectedMood = entry ? entry.mood : null;
  selDateLabel.textContent = str + ' 기록';
  memoInput.value = entry ? entry.memo : '';
  document.querySelectorAll('#moodRow button').forEach(b => {
    b.classList.toggle('sel', b.dataset.mood === selectedMood);
  });
  renderCalendar();
}

moodRow.querySelectorAll('button').forEach(b => {
  b.addEventListener('click', () => {
    selectedMood = b.dataset.mood;
    moodRow.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b));
  });
});

document.getElementById('saveEntry').addEventListener('click', () => {
  if (!selectedDate) { alert('먼저 날짜를 선택해주세요.'); return; }
  entries[selectedDate] = { mood: selectedMood || '📝', memo: memoInput.value.trim() };
  saveEntries();
  renderCalendar();
  toast('저장됨 ✓');
});

document.getElementById('deleteEntry').addEventListener('click', () => {
  if (!selectedDate) return;
  delete entries[selectedDate];
  saveEntries();
  memoInput.value = '';
  selectedMood = null;
  moodRow.querySelectorAll('button').forEach(b => b.classList.remove('sel'));
  renderCalendar();
});

document.getElementById('calPrev').addEventListener('click', () => {
  calDate.setMonth(calDate.getMonth() - 1);
  renderCalendar();
});
document.getElementById('calNext').addEventListener('click', () => {
  calDate.setMonth(calDate.getMonth() + 1);
  renderCalendar();
});
document.getElementById('calToday').addEventListener('click', () => {
  calDate = new Date();
  selectDate(dateStr(new Date()));
});

renderCalendar();

/* ---------- 시작 화면: 메인(소개) 페이지 ---------- */
showView('home');
