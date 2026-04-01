/* ─────────────────────────────────────────
   이유식 플래너 · app.js
   Firebase Firestore + Google Auth
───────────────────────────────────────── */

// ════════════════════════════════════════
// 🔥 FIREBASE CONFIG
// ════════════════════════════════════════
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyA0o8g4ICDDc5YTtzsDE5QMS0F8GI7qutQ",
  authDomain:        "baby-meal-planner-8e359.firebaseapp.com",
  projectId:         "baby-meal-planner-8e359",
  storageBucket:     "baby-meal-planner-8e359.firebasestorage.app",
  messagingSenderId: "555963840556",
  appId:             "1:555963840556:web:16dde28881938134143989"
};

firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db   = firebase.firestore();

let currentUser = null;
const TODAY = new Date();
TODAY.setHours(0,0,0,0);

function userCol(col) {
  return db.collection('users').doc(currentUser.uid).collection(col);
}

// ════════════════════════════════════════
// AUTH
// ════════════════════════════════════════
auth.onAuthStateChanged(user => {
  console.log('onAuthStateChanged:', user);
  if (user) { currentUser = user; showApp(user); }
  else {
    // 리다이렉트 결과 확인
    auth.getRedirectResult().then(result => {
      console.log('getRedirectResult:', result);
      if (result && result.user) {
        currentUser = result.user;
        showApp(result.user);
      } else {
        currentUser = null;
        showLogin();
      }
    }).catch(e => {
      console.error('getRedirectResult error:', e);
      showLogin();
    });
  }
});

document.getElementById('btn-google-login').addEventListener('click', () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  // 팝업 먼저 시도, 실패하면 리다이렉트로 fallback
  auth.signInWithPopup(provider).catch(err => {
    if (err.code === 'auth/popup-blocked' ||
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request') {
      auth.signInWithRedirect(provider);
    } else {
      toast('로그인 실패: ' + err.message);
    }
  });
});
document.getElementById('btn-logout').addEventListener('click', () => auth.signOut());

function showLogin() {
  const login = document.getElementById('login-screen');
  const app   = document.getElementById('app-screen');
  login.classList.add('active');
  app.classList.remove('active');
  window.scrollTo(0, 0);
}
function showApp(user) {
  const login = document.getElementById('login-screen');
  const app   = document.getElementById('app-screen');
  // 로그인 화면 완전히 숨기기
  login.classList.remove('active');
  login.style.display = 'none';
  // 앱 화면 표시
  app.classList.add('active');
  app.style.display = 'block';
  window.scrollTo(0, 0);
  const av = document.getElementById('user-avatar');
  if (av) { av.src = user.photoURL || ''; av.style.display = user.photoURL ? 'block' : 'none'; }
  try { initAllTabs(); } catch(e) { console.error('initAllTabs error:', e); }
}

// ════════════════════════════════════════
// TAB NAVIGATION
// ════════════════════════════════════════
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

function initAllTabs() {
  initPlannerTab();
  initMealTab();
  initCubeTab();
}

// ════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════
function toast(msg, duration = 2200) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), duration);
}

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function parseDate(s) {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d);
}
function korDate(s) {
  const d = parseDate(s);
  return `${d.getMonth()+1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})`;
}
function shortDate(s) {
  const d = parseDate(s);
  return `${d.getMonth()+1}월 ${d.getDate()}일`;
}
function addDays(s, n) {
  const d = parseDate(s); d.setDate(d.getDate()+n); return fmtDate(d);
}
function dday(exp) {
  const diff = Math.floor((parseDate(exp) - TODAY) / 86400000);
  if (diff < 0)  return { label: `D+${Math.abs(diff)}`, danger: true };
  if (diff === 0) return { label: 'D-DAY',               danger: true };
  if (diff <= 1)  return { label: `D-${diff}`,            danger: true };
  return           { label: `D-${diff}`,                  danger: false };
}
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.modal));
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); });
});

// ════════════════════════════════════════
// TAB 1: 재료 플래너
// - 달력 셀에 재료명 직접 표시
// ════════════════════════════════════════
let planYear, planMonth, planItems = [], editingPlanId = null;

function initPlannerTab() {
  const now = new Date();
  planYear = now.getFullYear(); planMonth = now.getMonth();
  loadPlans();
  document.getElementById('planner-prev').onclick = () => { planMonth--; if(planMonth<0){planMonth=11;planYear--;} renderPlanCalendar(); };
  document.getElementById('planner-next').onclick = () => { planMonth++; if(planMonth>11){planMonth=0;planYear++;} renderPlanCalendar(); };
  document.getElementById('btn-add-plan').onclick  = () => openPlanModal(null);
  document.getElementById('btn-plan-save').onclick   = savePlan;
  document.getElementById('btn-plan-delete').onclick = deletePlan;
}

function loadPlans() {
  userCol('plans').onSnapshot(snap => {
    planItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPlanCalendar();
  });
}

function renderPlanCalendar() {
  document.getElementById('planner-month-title').textContent = `${planYear}년 ${planMonth+1}월`;
  const container = document.getElementById('planner-calendar');
  container.innerHTML = '';

  const monthPlans = planItems.filter(p => {
    const d = parseDate(p.date);
    return d.getFullYear() === planYear && d.getMonth() === planMonth;
  });
  const byDay = {};
  monthPlans.forEach(p => {
    const day = parseDate(p.date).getDate();
    (byDay[day] = byDay[day] || []).push(p);
  });

  // 요일 헤더
  const hdr = document.createElement('div');
  hdr.className = 'cal-weekdays-row';
  ['일','월','화','수','목','금','토'].forEach((d,i) => {
    const el = document.createElement('div');
    el.className = 'cal-weekday-cell';
    el.textContent = d;
    hdr.appendChild(el);
  });
  container.appendChild(hdr);

  // 날짜 그리드
  const grid = document.createElement('div');
  grid.className = 'plan-cal-days';

  const firstDay = new Date(planYear, planMonth, 1).getDay();
  const daysInMonth = new Date(planYear, planMonth+1, 0).getDate();
  const daysInPrev  = new Date(planYear, planMonth, 0).getDate();
  const todayStr = fmtDate(TODAY);

  // 이전달 패딩
  for (let i = firstDay-1; i >= 0; i--) {
    const cell = makePlanCell(daysInPrev-i, null, true, firstDay-1-i);
    grid.appendChild(cell);
  }
  // 현재달
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${planYear}-${String(planMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dow = new Date(planYear, planMonth, d).getDay();
    const cell = makePlanCell(d, ds, false, dow);
    if (ds === todayStr) cell.classList.add('today');
    const ps = byDay[d];
    if (ps && ps.length > 0) {
      cell.classList.add('has-plan');
      const nameEl = document.createElement('div');
      nameEl.className = 'plan-cal-ingredient';
      nameEl.textContent = ps[0].ingredient;
      cell.appendChild(nameEl);
      if (ps.length > 1) {
        const more = document.createElement('div');
        more.className = 'plan-cal-more';
        more.textContent = `+${ps.length-1}`;
        cell.appendChild(more);
      }
    }
    cell.addEventListener('click', () => {
      const plans = planItems.filter(p => p.date === ds);
      if (plans.length === 0) openPlanModal(null, ds);
      else if (plans.length === 1) openPlanModal(plans[0].id);
      else toast(`${korDate(ds)}: ${plans.length}개 계획`);
    });
    grid.appendChild(cell);
  }
  // 다음달 패딩
  const rem = (7 - ((firstDay + daysInMonth) % 7)) % 7;
  for (let d = 1; d <= rem; d++) {
    const cell = makePlanCell(d, null, true, 0);
    grid.appendChild(cell);
  }
  container.appendChild(grid);
}

function makePlanCell(day, ds, other, dow) {
  const cell = document.createElement('div');
  cell.className = 'plan-cal-day' + (other ? ' other-month' : '') +
    (dow === 0 ? ' sunday' : dow === 6 ? ' saturday' : '');
  const num = document.createElement('div');
  num.className = 'plan-cal-day-num';
  num.textContent = day;
  cell.appendChild(num);
  return cell;
}

function openPlanModal(id, prefillDate) {
  editingPlanId = id;
  const isEdit = !!id;
  document.getElementById('modal-plan-title').textContent = isEdit ? '계획 수정' : '새 재료 계획';
  document.getElementById('btn-plan-delete').classList.toggle('hidden', !isEdit);
  if (isEdit) {
    const p = planItems.find(x => x.id === id);
    document.getElementById('plan-ingredient').value = p.ingredient;
    document.getElementById('plan-date').value = p.date;
    document.getElementById('plan-memo').value = p.memo || '';
  } else {
    document.getElementById('plan-ingredient').value = '';
    document.getElementById('plan-date').value = prefillDate || fmtDate(new Date());
    document.getElementById('plan-memo').value = '';
  }
  openModal('modal-plan');
}

async function savePlan() {
  const ingredient = document.getElementById('plan-ingredient').value.trim();
  const date       = document.getElementById('plan-date').value;
  const memo       = document.getElementById('plan-memo').value.trim();
  if (!ingredient) return toast('재료 이름을 입력해주세요');
  if (!date)       return toast('날짜를 선택해주세요');
  try {
    if (editingPlanId) {
      await userCol('plans').doc(editingPlanId).update({ ingredient, date, memo });
      toast('계획이 수정되었어요 ✏️');
    } else {
      await userCol('plans').add({ ingredient, date, memo });
      toast('계획이 추가되었어요 📅');
    }
    closeModal('modal-plan');
  } catch(e) { toast('저장 실패: ' + e.message); }
}

async function deletePlan() {
  if (!editingPlanId) return;
  if (!confirm('이 계획을 삭제할까요?')) return;
  try {
    await userCol('plans').doc(editingPlanId).delete();
    toast('삭제되었어요 🗑️');
    closeModal('modal-plan');
  } catch(e) { toast('삭제 실패: ' + e.message); }
}

// ════════════════════════════════════════
// TAB 2: 식단표
// - 이유식=초록, 간식=핑크 점
// - 시간이름 자동완성 + 삭제
// - 큐브 다중 선택
// - 저장 시 cube usedCount 연동
// ════════════════════════════════════════
let mealYear, mealMonth, mealData = {}, selectedMealDate = null;
let editingSlotId = null, currentSlotType = 'meal';
let slotCubes = { base: [], protein: [], other: [] };
let pickerCat = null, pickerSelected = [];
let timeLabels = ['오전 이유식','오전 간식','점심 이유식','오후 간식','저녁 이유식'];
let timeLabelsLoaded = false;

function initMealTab() {
  const now = new Date();
  mealYear = now.getFullYear(); mealMonth = now.getMonth();
  loadMealData();

  document.getElementById('btn-export-excel').onclick = openExportModal;
  document.getElementById('meal-prev').onclick = () => { mealMonth--; if(mealMonth<0){mealMonth=11;mealYear--;} renderMealCalendar(); };
  document.getElementById('meal-next').onclick = () => { mealMonth++; if(mealMonth>11){mealMonth=0;mealYear++;} renderMealCalendar(); };
  document.getElementById('btn-close-meal-panel').onclick = () => {
    document.getElementById('meal-day-panel').classList.add('hidden');
    selectedMealDate = null;
    renderMealCalendar();
  };
  document.getElementById('btn-add-meal-slot').onclick = () => openSlotModal(null);
  document.getElementById('btn-slot-save').onclick   = saveSlot;
  document.getElementById('btn-slot-delete').onclick = deleteSlot;

  // 타입 토글
  document.querySelectorAll('#slot-type-toggle .toggle-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#slot-type-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSlotType = btn.dataset.type;
      document.getElementById('slot-meal-section').classList.toggle('hidden', currentSlotType !== 'meal');
      document.getElementById('slot-snack-section').classList.toggle('hidden', currentSlotType !== 'snack');
    };
  });

  // 큐브 추가 버튼
  document.querySelectorAll('.btn-add-cube-slot').forEach(btn => {
    btn.onclick = () => openCubePicker(btn.dataset.cat);
  });

  document.getElementById('btn-cube-picker-confirm').onclick = confirmCubePick;

  // 시간이름 드롭다운
  const inp = document.getElementById('slot-time-label');
  inp.addEventListener('input',  () => renderTimeLabelDropdown(inp.value));
  inp.addEventListener('focus',  () => renderTimeLabelDropdown(inp.value));
  inp.addEventListener('blur',   () => setTimeout(() => document.getElementById('time-label-dropdown').classList.add('hidden'), 180));
  document.getElementById('cube-picker-search').addEventListener('input', e => renderCubePickerList(e.target.value));
}

function loadMealData() {
  // 시간이름 목록 Firestore에서 불러오기
  userCol('settings').doc('timeLabels').get().then(doc => {
    if (doc.exists && doc.data().labels) {
      timeLabels = doc.data().labels;
    }
    timeLabelsLoaded = true;
  }).catch(() => { timeLabelsLoaded = true; });

  userCol('meals').onSnapshot(snap => {
    mealData = {};
    snap.docs.forEach(d => {
      const slot = { id: d.id, ...d.data() };
      (mealData[slot.date] = mealData[slot.date] || []).push(slot);
    });
    renderMealCalendar();
    if (selectedMealDate) renderMealDayPanel(selectedMealDate);
  });
}

function renderMealCalendar() {
  document.getElementById('meal-month-title').textContent = `${mealYear}년 ${mealMonth+1}월`;
  const container = document.getElementById('meal-calendar');
  container.innerHTML = '';

  const byDay = {};
  Object.entries(mealData).forEach(([ds, slots]) => {
    const d = parseDate(ds);
    if (d.getFullYear() === mealYear && d.getMonth() === mealMonth)
      byDay[d.getDate()] = slots.slice().sort((a,b) => (a.order||0)-(b.order||0));
  });

  // 요일 헤더
  const hdr = document.createElement('div');
  hdr.className = 'cal-weekdays-row';
  ['일','월','화','수','목','금','토'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-weekday-cell';
    el.textContent = d;
    hdr.appendChild(el);
  });
  container.appendChild(hdr);

  const grid = document.createElement('div');
  grid.className = 'cal-days-grid';

  const firstDay   = new Date(mealYear, mealMonth, 1).getDay();
  const daysInMonth = new Date(mealYear, mealMonth+1, 0).getDate();
  const daysInPrev  = new Date(mealYear, mealMonth, 0).getDate();
  const todayStr    = fmtDate(TODAY);

  for (let i = firstDay-1; i >= 0; i--) grid.appendChild(makeMealCell(daysInPrev-i, null, true, firstDay-1-i));

  for (let d = 1; d <= daysInMonth; d++) {
    const ds  = `${mealYear}-${String(mealMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dow = new Date(mealYear, mealMonth, d).getDay();
    const cell = makeMealCell(d, ds, false, dow);
    if (ds === todayStr)       cell.classList.add('today');
    if (ds === selectedMealDate) cell.classList.add('selected');
    const slots = byDay[d];
    if (slots && slots.length > 0) {
      const dotWrap = document.createElement('div');
      dotWrap.className = 'cal-dots';
      slots.slice(0, 5).forEach(slot => {
        const dot = document.createElement('div');
        dot.className = 'cal-dot ' + (slot.type === 'meal' ? 'meal' : 'snack');
        dotWrap.appendChild(dot);
      });
      cell.appendChild(dotWrap);
    }
    cell.addEventListener('click', () => {
      selectedMealDate = ds;
      renderMealCalendar();
      renderMealDayPanel(ds);
    });
    grid.appendChild(cell);
  }

  const rem = (7 - ((firstDay + daysInMonth) % 7)) % 7;
  for (let d = 1; d <= rem; d++) grid.appendChild(makeMealCell(d, null, true, 0));

  container.appendChild(grid);
}

function makeMealCell(day, ds, other, dow) {
  const cell = document.createElement('div');
  cell.className = 'cal-day-cell' + (other ? ' other-month' : '') +
    (dow === 0 ? ' sunday' : dow === 6 ? ' saturday' : '');
  const num = document.createElement('div');
  num.className = 'cal-day-num';
  num.textContent = day;
  cell.appendChild(num);
  return cell;
}

function renderMealDayPanel(dateStr) {
  const panel = document.getElementById('meal-day-panel');
  panel.classList.remove('hidden');
  document.getElementById('meal-selected-date').textContent = korDate(dateStr);

  const slots = (mealData[dateStr] || []).slice().sort((a,b) => (a.order||0)-(b.order||0));
  const container = document.getElementById('meal-slots');

  if (slots.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="empty-icon">🍽️</span>아직 기록된 식단이 없어요.</div>`;
    return;
  }

  container.innerHTML = slots.map(slot => {
    if (slot.type === 'snack') {
      return `
        <div class="meal-slot-card">
          <div class="meal-slot-header snack-hdr">
            <span class="meal-slot-time-snack">${escHtml(slot.timeLabel)}</span>
            <span class="meal-slot-badge snack">간식</span>
            <button class="btn-icon" onclick="openSlotModal('${slot.id}')">✏️</button>
          </div>
          <div class="meal-slot-body"><div class="meal-snack-text">${escHtml(slot.snackMemo||'')}</div></div>
        </div>`;
    }
    const totalG = (slot.cubes||[]).reduce((s,c) => s+(c.g||0), 0);
    const cats = [
      { key:'base',    label:'🍚 베이스죽' },
      { key:'protein', label:'🥩 단백질'   },
      { key:'other',   label:'🥦 기타'     },
    ];
    const catHtml = cats.map(cat => {
      const cs = (slot.cubes||[]).filter(c => c.cat === cat.key);
      if (!cs.length) return '';
      return `<div class="meal-slot-cat">
        <div class="meal-slot-cat-label">${cat.label}</div>
        <div class="meal-slot-chips">${cs.map(c => `<span class="meal-chip ${cat.key}">${escHtml(c.cubeName)} ${c.g}g</span>`).join('')}</div>
      </div>`;
    }).join('');
    return `
      <div class="meal-slot-card">
        <div class="meal-slot-header meal-hdr">
          <span class="meal-slot-time-meal">${escHtml(slot.timeLabel)}</span>
          <span class="meal-slot-total">총 ${totalG}g</span>
          <span class="meal-slot-badge meal">이유식</span>
          <button class="btn-icon" onclick="openSlotModal('${slot.id}')">✏️</button>
        </div>
        <div class="meal-slot-body">${catHtml || '<div style="color:var(--text3);font-size:13px">등록된 큐브 없음</div>'}</div>
      </div>`;
  }).join('');
}

// 시간이름 드롭다운
function renderTimeLabelDropdown(val) {
  const dd = document.getElementById('time-label-dropdown');
  const filtered = timeLabels.filter(l => !val || l.includes(val));
  if (!filtered.length) { dd.classList.add('hidden'); return; }
  dd.innerHTML = filtered.map(lbl => `
    <div class="time-dropdown-item">
      <span class="time-dropdown-label" onmousedown="selectTimeLabel('${escHtml(lbl)}')">${escHtml(lbl)}</span>
      <span class="time-dropdown-del" onmousedown="removeTimeLabel('${escHtml(lbl)}')">✕</span>
    </div>`).join('');
  dd.classList.remove('hidden');
}
function selectTimeLabel(lbl) {
  document.getElementById('slot-time-label').value = lbl;
  document.getElementById('time-label-dropdown').classList.add('hidden');
}
function removeTimeLabel(lbl) {
  timeLabels = timeLabels.filter(l => l !== lbl);
  userCol('settings').doc('timeLabels').set({ labels: timeLabels }).catch(() => {});
  renderTimeLabelDropdown(document.getElementById('slot-time-label').value);
}

function openSlotModal(id) {
  editingSlotId = id;
  slotCubes = { base: [], protein: [], other: [] };
  const isEdit = !!id;
  document.getElementById('modal-slot-title').textContent = isEdit ? '끼니 수정' : '끼니 작성';
  document.getElementById('btn-slot-delete').classList.toggle('hidden', !isEdit);

  if (isEdit) {
    const slots = Object.values(mealData).flat();
    const slot = slots.find(s => s.id === id);
    document.getElementById('slot-time-label').value = slot.timeLabel || '';
    currentSlotType = slot.type || 'meal';
    if (slot.cubes) slot.cubes.forEach(c => { slotCubes[c.cat] = slotCubes[c.cat] || []; slotCubes[c.cat].push({...c}); });
    document.getElementById('slot-snack-memo').value = slot.snackMemo || '';
  } else {
    document.getElementById('slot-time-label').value = '';
    currentSlotType = 'meal';
    document.getElementById('slot-snack-memo').value = '';
  }

  document.querySelectorAll('#slot-type-toggle .toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.type === currentSlotType));
  document.getElementById('slot-meal-section').classList.toggle('hidden', currentSlotType !== 'meal');
  document.getElementById('slot-snack-section').classList.toggle('hidden', currentSlotType !== 'snack');
  renderSlotCubes();
  updateTotalG();
  openModal('modal-meal-slot');
}

function renderSlotCubes() {
  ['base','protein','other'].forEach(cat => {
    const row = document.getElementById(`slot-${cat}-cubes`);
    if (!row) return;
    row.innerHTML = slotCubes[cat].map((c, idx) => `
      <div class="slot-cube-chip">
        ${escHtml(c.cubeName)} <span style="opacity:.7;font-size:11px">${c.g}g</span>
        <span class="rm-chip" onclick="removeSlotCube('${cat}',${idx})">✕</span>
      </div>`).join('');
  });
}
function removeSlotCube(cat, idx) {
  slotCubes[cat].splice(idx, 1);
  renderSlotCubes(); updateTotalG();
}
function updateTotalG() {
  const total = Object.values(slotCubes).flat().reduce((s,c) => s+(c.g||0), 0);
  document.getElementById('slot-total-g').textContent = total + 'g';
}

async function saveSlot() {
  const timeLabel = document.getElementById('slot-time-label').value.trim();
  if (!timeLabel)         return toast('시간 이름을 입력해주세요');
  if (!selectedMealDate)  return toast('날짜를 먼저 선택해주세요');

  // 새 시간이름 저장
  if (!timeLabels.includes(timeLabel)) {
    timeLabels.push(timeLabel);
    userCol('settings').doc('timeLabels').set({ labels: timeLabels }).catch(() => {});
  }

  const existing = mealData[selectedMealDate] || [];
  const maxOrder = Math.max(0, ...existing.map(s => s.order||0));
  const newSlot = {
    date: selectedMealDate, timeLabel, type: currentSlotType,
    order: editingSlotId ? (existing.find(s=>s.id===editingSlotId)?.order || maxOrder+1) : maxOrder+1,
    cubes: currentSlotType === 'meal' ? Object.values(slotCubes).flat() : [],
    snackMemo: currentSlotType === 'snack' ? document.getElementById('slot-snack-memo').value.trim() : ''
  };

  // 큐브 usedCount 반영
  const oldSlot = editingSlotId ? existing.find(s => s.id === editingSlotId) : null;
  await applyMealCubeDiff(oldSlot, newSlot);

  try {
    if (editingSlotId) {
      await userCol('meals').doc(editingSlotId).update(newSlot);
      toast('식단이 수정되었어요 ✏️');
    } else {
      await userCol('meals').add(newSlot);
      toast('식단이 저장되었어요 🍽️');
    }
    closeModal('modal-meal-slot');
  } catch(e) { toast('저장 실패: ' + e.message); }
}

// ════════════════════════════════════════
// 엑셀 내보내기
// ════════════════════════════════════════
function openExportModal() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay  = new Date(now.getFullYear(), now.getMonth()+1, 0);
  document.getElementById('export-start').value = fmtDate(firstDay);
  document.getElementById('export-end').value   = fmtDate(lastDay);

  document.querySelectorAll('.export-quick-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.onclick = () => {
      document.querySelectorAll('.export-quick-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const today = new Date(); today.setHours(0,0,0,0);
      const range = btn.dataset.range;
      if (range === 'this-month') {
        document.getElementById('export-start').value = fmtDate(new Date(today.getFullYear(), today.getMonth(), 1));
        document.getElementById('export-end').value   = fmtDate(new Date(today.getFullYear(), today.getMonth()+1, 0));
      } else if (range === 'last-month') {
        document.getElementById('export-start').value = fmtDate(new Date(today.getFullYear(), today.getMonth()-1, 1));
        document.getElementById('export-end').value   = fmtDate(new Date(today.getFullYear(), today.getMonth(), 0));
      } else if (range === 'last-7') {
        const s = new Date(today); s.setDate(s.getDate()-6);
        document.getElementById('export-start').value = fmtDate(s);
        document.getElementById('export-end').value   = fmtDate(today);
      } else if (range === 'last-30') {
        const s = new Date(today); s.setDate(s.getDate()-29);
        document.getElementById('export-start').value = fmtDate(s);
        document.getElementById('export-end').value   = fmtDate(today);
      }
    };
  });

  document.getElementById('btn-export-confirm').onclick = exportMealExcel;
  openModal('modal-export');
}

function exportMealExcel() {
  const year  = mealYear;
  const month = mealMonth;
  const title = `${year}년 ${month+1}월 이유식 식단표`;

  // 해당 월의 날짜별 슬롯 모으기
  const rows = [];

  // 헤더
  rows.push(['날짜', '요일', '끼니/간식', '종류', '베이스죽', '단백질', '기타', '총g', '간식내용']);

  const daysInMonth = new Date(year, month+1, 0).getDate();
  const dayNames = ['일','월','화','수','목','금','토'];

  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dow = new Date(year, month, d).getDay();
    const slots = (mealData[ds] || []).slice().sort((a,b) => (a.order||0)-(b.order||0));

    if (slots.length === 0) {
      rows.push([korDate(ds).split(' (')[0], dayNames[dow], '', '', '', '', '', '', '']);
    } else {
      slots.forEach((slot, i) => {
        const dateCell  = i === 0 ? korDate(ds).split(' (')[0] : '';
        const dowCell   = i === 0 ? dayNames[dow] : '';

        if (slot.type === 'snack') {
          rows.push([dateCell, dowCell, slot.timeLabel, '간식', '', '', '', '', slot.snackMemo||'']);
        } else {
          const cubes   = slot.cubes || [];
          const base    = cubes.filter(c=>c.cat==='base').map(c=>`${c.cubeName}(${c.g}g)`).join(', ');
          const protein = cubes.filter(c=>c.cat==='protein').map(c=>`${c.cubeName}(${c.g}g)`).join(', ');
          const other   = cubes.filter(c=>c.cat==='other').map(c=>`${c.cubeName}(${c.g}g)`).join(', ');
          const totalG  = cubes.reduce((s,c)=>s+(c.g||0),0);
          rows.push([dateCell, dowCell, slot.timeLabel, '이유식', base, protein, other, totalG+'g', '']);
        }
      });
    }
  }

  // CSV 생성 (엑셀에서 열 수 있는 UTF-8 BOM)
  const BOM = '\uFEFF';
  const csv = BOM + rows.map(row =>
    row.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',')
  ).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${title}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`📥 ${title} 다운로드 완료!`);
}

async function deleteSlot() {
  if (!editingSlotId) return;
  if (!confirm('이 끼니를 삭제할까요?')) return;
  const existing = mealData[selectedMealDate] || [];
  const oldSlot  = existing.find(s => s.id === editingSlotId);
  await applyMealCubeDiff(oldSlot, null);
  try {
    await userCol('meals').doc(editingSlotId).delete();
    toast('삭제되었어요 🗑️');
    closeModal('modal-meal-slot');
  } catch(e) { toast('삭제 실패: ' + e.message); }
}

// 식단 변경 시 큐브 usedCount 반영
async function applyMealCubeDiff(oldSlot, newSlot) {
  const delta = {};
  const tally = (cubeList, sign) => (cubeList||[]).forEach(c => { delta[c.cubeId] = (delta[c.cubeId]||0) + sign; });
  if (oldSlot?.type === 'meal') tally(oldSlot.cubes, -1);
  if (newSlot?.type === 'meal') tally(newSlot.cubes,  1);
  const batch = db.batch();
  for (const [cubeId, diff] of Object.entries(delta)) {
    if (!diff) continue;
    const cube = cubeItems.find(c => c.id === cubeId);
    if (!cube) continue;
    const newUsed = Math.max(0, Math.min(cube.count, (cube.usedCount||0) + diff));
    batch.update(userCol('cubes').doc(cubeId), {
      usedCount: newUsed,
      status: newUsed >= cube.count ? 'done' : 'active'
    });
  }
  await batch.commit().catch(() => {});
}

// 큐브 피커 (다중 선택)
function openCubePicker(cat) {
  pickerCat = cat;
  pickerSelected = [];
  document.getElementById('cube-picker-search').value = '';
  document.getElementById('modal-picker-title').textContent = `큐브 선택 — ${{base:'🍚 베이스죽',protein:'🥩 단백질',other:'🥦 기타'}[cat]}`;
  renderCubePickerList('');
  updatePickerBtn();
  openModal('modal-cube-picker');
}
function renderCubePickerList(search) {
  const list = document.getElementById('cube-picker-list');
  const catOrder = { base:0, protein:1, other:2 };
  const active = cubeItems
    .filter(c => c.status === 'active')
    .slice().sort((a,b) => {
      const catDiff = (catOrder[a.category]||0) - (catOrder[b.category]||0);
      if (catDiff !== 0) return catDiff;
      // 같은 카테고리 안에서는 유통기한 임박순
      const expA = addDays(a.madeDate, a.expireDays||14);
      const expB = addDays(b.madeDate, b.expireDays||14);
      return expA.localeCompare(expB);
    });
  const filtered = search ? active.filter(c => c.name.includes(search)) : active;
  if (!filtered.length) { list.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:10px">큐브가 없어요.</div>'; return; }
  list.innerHTML = filtered.map(c => {
    const sel = pickerSelected.find(x => x.cubeId === c.id);
    const rem = (c.count||0) - (c.usedCount||0);
    return `
      <div class="cube-picker-item ${sel ? 'selected' : ''}" onclick="togglePickerCube('${c.id}')">
        <div>
          <div class="cube-picker-item-name">${escHtml(c.name)}</div>
          <div class="cube-picker-item-sub">${{base:'🍚 베이스죽',protein:'🥩 단백질',other:'🥦 기타'}[c.category]||''} · ${c.g}g/큐브</div>
        </div>
        <div>
          <div class="cube-picker-item-rem">잔여 ${rem}개</div>
          ${sel ? '<div style="font-size:10px;color:rgba(255,255,255,.8);text-align:right">✓ 선택됨</div>' : ''}
        </div>
      </div>`;
  }).join('');
}
function togglePickerCube(cubeId) {
  const cube = cubeItems.find(c => c.id === cubeId);
  if (!cube) return;
  const idx = pickerSelected.findIndex(x => x.cubeId === cubeId);
  if (idx >= 0) pickerSelected.splice(idx, 1);
  else pickerSelected.push({ cubeId: cube.id, cubeName: cube.name, g: cube.g, cat: pickerCat });
  renderCubePickerList(document.getElementById('cube-picker-search').value);
  updatePickerBtn();
  const info = document.getElementById('cube-picker-selected-info');
  if (pickerSelected.length > 0) {
    info.textContent = '선택: ' + pickerSelected.map(x => x.cubeName).join(', ');
    info.classList.remove('hidden');
  } else { info.classList.add('hidden'); }
}
function updatePickerBtn() {
  document.getElementById('btn-cube-picker-confirm').textContent = `추가 (${pickerSelected.length}개)`;
}
function confirmCubePick() {
  if (!pickerSelected.length) return toast('큐브를 선택해주세요');
  pickerSelected.forEach(c => {
    slotCubes[pickerCat] = slotCubes[pickerCat] || [];
    slotCubes[pickerCat].push({...c});
  });
  renderSlotCubes(); updateTotalG();
  closeModal('modal-cube-picker');
  toast(`${pickerSelected.length}개 큐브 추가 완료 🧊`);
}

// ════════════════════════════════════════
// TAB 3: 큐브 관리
// - 재료 자동으로 큐브명 완성
// - D-1 이하 빨간색
// - 소진 뱃지 이름 옆에
// ════════════════════════════════════════
let cubeItems = [], activeCubeTab = 'active', editingCubeId = null;
let editIngredients = [], cubeNameManual = false;
let cubeSortBy = 'expire';   // 'expire' | 'category'
let cubeCatFilter = 'all';  // 'all' | 'base' | 'protein' | 'other'

function initCubeTab() {
  loadCubes();
  document.querySelectorAll('.cube-tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.cube-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCubeTab = btn.dataset.ctab;
      document.getElementById('cube-list-active').classList.toggle('hidden', activeCubeTab !== 'active');
      document.getElementById('cube-list-done').classList.toggle('hidden',   activeCubeTab !== 'done');
    };
  });
  document.getElementById('btn-add-cube').onclick = () => openCubeModal(null);
  document.getElementById('btn-cube-save').onclick   = saveCube;
  document.getElementById('btn-cube-delete').onclick = deleteCube;
  document.getElementById('btn-add-ingredient').onclick = addIngredient;
  document.getElementById('cube-ingredient-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addIngredient(); }
  });
  // 큐브 이름 수동 입력 시 자동완성 해제
  document.getElementById('cube-name').addEventListener('input', () => { cubeNameManual = true; });

  // 정렬 버튼
  document.querySelectorAll('.cube-sort-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.cube-sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      cubeSortBy = btn.dataset.sort;
      renderCubeList();
    };
  });

  // 카테고리 필터
  document.querySelectorAll('.cube-cat-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.cube-cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      cubeCatFilter = btn.dataset.cat;
      renderCubeList();
    };
  });
}

function loadCubes() {
  userCol('cubes').onSnapshot(snap => {
    cubeItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCubeList();
  });
}

function renderCubeList() {
  const catOrder = { base:0, protein:1, other:2 };

  function sortCubes(list) {
    if (cubeSortBy === 'expire') {
      // 유통기한 임박순, 같은 제조일은 저장순(id 순)
      return list.slice().sort((a, b) => {
        const expA = addDays(a.madeDate, a.expireDays||14);
        const expB = addDays(b.madeDate, b.expireDays||14);
        if (expA !== expB) return expA.localeCompare(expB);
        return (a.id||'').localeCompare(b.id||'');
      });
    } else {
      // 카테고리순, 같은 카테고리 안에서는 제조일 → 저장순
      return list.slice().sort((a, b) => {
        const catDiff = (catOrder[a.category]||0) - (catOrder[b.category]||0);
        if (catDiff !== 0) return catDiff;
        if (a.madeDate !== b.madeDate) return a.madeDate.localeCompare(b.madeDate);
        return (a.id||'').localeCompare(b.id||'');
      });
    }
  }

  let active = cubeItems.filter(c => c.status !== 'done');
  let done   = cubeItems.filter(c => c.status === 'done');

  // 카테고리 필터
  if (cubeCatFilter !== 'all') {
    active = active.filter(c => c.category === cubeCatFilter);
    done   = done.filter(c => c.category === cubeCatFilter);
  }

  active = sortCubes(active);
  done   = done.slice().sort((a,b) => b.madeDate.localeCompare(a.madeDate));

  const activeList = document.getElementById('cube-list-active');
  const doneList   = document.getElementById('cube-list-done');

  activeList.innerHTML = active.length === 0
    ? `<div class="empty-state"><span class="empty-icon">🧊</span>등록된 큐브가 없어요.<br>+ 큐브 등록으로 추가해주세요!</div>`
    : active.map(cubeCardHtml).join('');

  doneList.innerHTML = done.length === 0
    ? `<div class="empty-state"><span class="empty-icon">✅</span>소진된 큐브가 없어요.</div>`
    : done.map(cubeCardHtml).join('');
}

function cubeCardHtml(c) {
  const expStr = addDays(c.madeDate, c.expireDays||7);
  const dd     = dday(expStr);
  const rem    = (c.count||0) - (c.usedCount||0);
  return `
    <div class="cube-card ${c.category||''}">
      <div class="cube-card-name">
        ${escHtml(c.name)}
        ${c.status==='done' ? '<span class="cube-done-badge">소진</span>' : ''}
      </div>
      <div class="cube-card-right">
        <button class="cube-edit-btn" onclick="openCubeModal('${c.id}')">수정</button>
        <div class="cube-card-rem">${rem}<span>/${c.count}개</span></div>
      </div>
      <div class="cube-card-meta">
        <span class="cube-badge">${shortDate(c.madeDate)}</span>
        <span class="cube-badge">${c.g}g/큐브</span>
        <span class="cube-badge ${dd.danger ? 'danger' : 'ok'}">${expStr} (${dd.label})</span>
      </div>
    </div>`;
}

function openCubeModal(id) {
  editingCubeId = id;
  editIngredients = [];
  cubeNameManual = !!id;
  const isEdit = !!id;
  document.getElementById('modal-cube-title').textContent = isEdit ? '큐브 수정' : '큐브 등록';
  document.getElementById('btn-cube-delete').classList.toggle('hidden', !isEdit);

  if (isEdit) {
    const c = cubeItems.find(x => x.id === id);
    document.getElementById('cube-name').value = c.name;
    document.getElementById('cube-category').value = c.category || 'base';
    document.getElementById('cube-g').value = c.g || '';
    document.getElementById('cube-count').value = c.count || '';
    document.getElementById('cube-made-date').value = c.madeDate;
    document.getElementById('cube-expire-days').value = c.expireDays || '';
    editIngredients = [...(c.ingredients||[])];
  } else {
    document.getElementById('cube-name').value = '';
    document.getElementById('cube-category').value = 'base';
    document.getElementById('cube-g').value = '';
    document.getElementById('cube-count').value = '';
    document.getElementById('cube-made-date').value = fmtDate(new Date());
    document.getElementById('cube-expire-days').value = 14;
    editIngredients = [];
  }
  document.getElementById('cube-ingredient-input').value = '';
  renderIngredientTags();
  openModal('modal-cube');
}

function addIngredient() {
  const val = document.getElementById('cube-ingredient-input').value.trim();
  if (!val) return;
  if (!editIngredients.includes(val)) editIngredients.push(val);
  if (!cubeNameManual) {
    document.getElementById('cube-name').value = editIngredients.join(' ');
  }
  renderIngredientTags();
  document.getElementById('cube-ingredient-input').value = '';
}
function removeIngredient(ing) {
  editIngredients = editIngredients.filter(i => i !== ing);
  if (!cubeNameManual) {
    document.getElementById('cube-name').value = editIngredients.join(' ');
  }
  renderIngredientTags();
}
function renderIngredientTags() {
  document.getElementById('cube-ingredients-list').innerHTML = editIngredients.map(ing => `
    <span class="ingredient-tag">
      ${escHtml(ing)}
      <span class="rm-ing" onclick="removeIngredient('${escHtml(ing)}')">✕</span>
    </span>`).join('');
}

async function saveCube() {
  const name       = document.getElementById('cube-name').value.trim();
  const category   = document.getElementById('cube-category').value;
  const g          = parseInt(document.getElementById('cube-g').value) || 0;
  const count      = parseInt(document.getElementById('cube-count').value) || 0;
  const madeDate   = document.getElementById('cube-made-date').value;
  const expireDays = parseInt(document.getElementById('cube-expire-days').value) || 7;
  if (!name)     return toast('큐브 이름을 입력해주세요');
  if (!madeDate) return toast('제조일을 선택해주세요');
  const data = { name, category, g, count, madeDate, expireDays, ingredients: editIngredients, status: 'active' };
  try {
    if (editingCubeId) {
      const existing = cubeItems.find(c => c.id === editingCubeId);
      data.usedCount = existing?.usedCount || 0;
      await userCol('cubes').doc(editingCubeId).update(data);
      toast('큐브가 수정되었어요 ✏️');
    } else {
      data.usedCount = 0;
      await userCol('cubes').add(data);
      toast('큐브가 등록되었어요 🧊');
    }
    closeModal('modal-cube');
  } catch(e) { toast('저장 실패: ' + e.message); }
}

async function deleteCube() {
  if (!editingCubeId) return;
  if (!confirm('이 큐브를 삭제할까요?')) return;
  try {
    await userCol('cubes').doc(editingCubeId).delete();
    toast('삭제되었어요 🗑️');
    closeModal('modal-cube');
  } catch(e) { toast('삭제 실패: ' + e.message); }
}

// ════════════════════════════════════════
// PWA
// ════════════════════════════════════════
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      // 새 버전 있으면 즉시 적용
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    }).catch(() => {});
  });
  // 새 서비스 워커 활성화되면 자동 새로고침
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}
