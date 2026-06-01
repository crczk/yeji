const STORAGE_KEY = 'bank-performance-gitee-webapp-state-v2';
const OLD_STORAGE_KEY = 'bank-performance-gitee-webapp-state-v1';
const CONFIG_KEY = 'bank-performance-gitee-config-v1';
const API_ROOT = 'https://gitee.com/api/v5';

const COLORS = ['#155EEF', '#079455', '#DC6803', '#7A5AF8', '#0E9384', '#D92D20', '#475467', '#2563eb', '#9333ea', '#0891b2'];

const defaultData = () => {
  const now = new Date().toISOString();
  return {
    version: 2,
    members: [
      { id: 'member_cuizikun', name: '崔子坤', role: '', active: true, createdAt: now }
    ],
    types: [
      { id: 'type_credit_card', name: '信用卡', unit: '张', color: '#7A5AF8', active: true, sortOrder: 1 }
    ],
    records: [],
    updatedAt: now
  };
};

let state = loadLocal();
let config = loadConfig();
let page = 'home';
let remoteSha = '';

function uid() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function monthStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
function num(n) { return Number(n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 }); }
function typeById(id) { return state.types.find(t => t.id === id); }
function memberById(id) { return state.members.find(m => m.id === id); }
function firstMemberId() { return state.members[0]?.id || ensureDefaultMember(); }
function safeHtml(s) { return String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove('show'), 2300);
}
function saveLocal() {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function loadLocal() {
  try {
    const v2 = localStorage.getItem(STORAGE_KEY);
    if (v2) return normalizeData(JSON.parse(v2));
    const old = localStorage.getItem(OLD_STORAGE_KEY);
    if (old) return normalizeData(JSON.parse(old));
    return defaultData();
  } catch {
    return defaultData();
  }
}
function saveConfig() { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); }
function loadConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) || { owner:'', repo:'', branch:'master', path:'data/performance.json', token:'' }; }
  catch { return { owner:'', repo:'', branch:'master', path:'data/performance.json', token:'' }; }
}
function ensureDefaultMember() {
  const id = uid();
  state.members = [{ id, name: '崔子坤', role: '', active: true, createdAt: new Date().toISOString() }, ...(state.members || [])];
  saveLocal();
  return id;
}
function currentMemberFilter() {
  return window.__memberFilter || 'all';
}
function filterByMember(records, memberId = currentMemberFilter()) {
  if (!memberId || memberId === 'all') return records;
  return records.filter(r => r.memberId === memberId);
}
function dateRecords(date, memberId = currentMemberFilter()) {
  return filterByMember(state.records.filter(r => r.date === date), memberId);
}
function monthRecords(month, memberId = currentMemberFilter()) {
  return filterByMember(state.records.filter(r => r.date && r.date.startsWith(month)), memberId);
}
function typeSummary(records) {
  const map = new Map();
  records.forEach(r => {
    const t = typeById(r.typeId) || { id: r.typeId, name: '已删除类型', unit: '', color: '#98A2B3' };
    if (!map.has(t.id)) map.set(t.id, { type: t, value: 0, count: 0 });
    const item = map.get(t.id);
    item.value += Number(r.value || 0);
    item.count += 1;
  });
  return Array.from(map.values()).sort((a, b) => b.value - a.value || b.count - a.count);
}
function memberSummary(records) {
  const map = new Map();
  records.forEach(r => {
    const m = memberById(r.memberId) || { id: r.memberId, name: '未分配成员', role: '' };
    if (!map.has(m.id)) map.set(m.id, { member: m, count: 0, typeCount: new Set() });
    const item = map.get(m.id);
    item.count += 1;
    item.typeCount.add(r.typeId);
  });
  return Array.from(map.values()).map(x => ({ ...x, typeCount: x.typeCount.size })).sort((a, b) => b.count - a.count);
}
function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
function formatValue(value, unit) {
  return `${num(value)}${unit ? ' ' + safeHtml(unit) : ''}`;
}
function render() {
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  const view = document.getElementById('view');
  if (page === 'home') view.innerHTML = homeTpl();
  if (page === 'add') view.innerHTML = addTpl();
  if (page === 'day') view.innerHTML = dayTpl();
  if (page === 'month') view.innerHTML = monthTpl();
  if (page === 'settings') view.innerHTML = settingsTpl();
  bindPage();
}
function memberFilterTpl(id = 'memberFilter', includeAll = true, value = currentMemberFilter()) {
  return `<select id="${id}" class="compact-select">
    ${includeAll ? `<option value="all" ${value === 'all' ? 'selected' : ''}>全部成员</option>` : ''}
    ${state.members.map(m => `<option value="${m.id}" ${value === m.id ? 'selected' : ''}>${safeHtml(m.name)}</option>`).join('')}
  </select>`;
}
function typeSelectOptions(selected = '') {
  return state.types.map(t => `<option value="${t.id}" ${selected === t.id ? 'selected' : ''}>${safeHtml(t.name)}（${safeHtml(t.unit)}）</option>`).join('');
}
function homeTpl() {
  const today = todayStr();
  const month = monthStr();
  const memberId = currentMemberFilter();
  const dRecs = dateRecords(today, memberId);
  const mRecs = monthRecords(month, memberId);
  const todayTypes = typeSummary(dRecs);
  const monthTypes = typeSummary(mRecs);
  const best = monthTypes[0];
  return `
    <section class="card hero">
      <div class="row"><div class="muted" style="color:rgba(255,255,255,.78)">${today}</div>${memberFilterTpl('homeMemberFilter')}</div>
      <div class="big">今日上报 ${dRecs.length} 笔</div>
      <div class="grid" style="margin-top:14px">
        <div class="metric"><div class="label">今日涉及项目</div><div class="value">${todayTypes.length} 项</div></div>
        <div class="metric"><div class="label">本月上报记录</div><div class="value">${mRecs.length} 笔</div></div>
      </div>
    </section>
    <section class="grid">
      <button class="primary" data-page-jump="add">+ 记录业绩</button>
      <button class="ghost" data-page-jump="month">查看月统计</button>
    </section>
    <section class="card">
      <div class="section-title"><h2>今日各项上报汇总</h2><span class="muted">${dRecs.length} 笔</span></div>
      ${summaryList(todayTypes)}
    </section>
    <section class="card">
      <div class="section-title"><h2>本月各项上报汇总</h2><span class="pill">${month}</span></div>
      ${summaryList(monthTypes, true)}
    </section>
    <section class="card">
      <div class="section-title"><h2>本月概况</h2><span class="muted">按记录统计</span></div>
      <div class="grid">
        <div class="metric light"><div class="label">上报最多项目</div><div class="value" style="font-size:18px">${best ? safeHtml(best.type.name) : '暂无'}</div></div>
        <div class="metric light"><div class="label">参与成员</div><div class="value">${memberSummary(mRecs).length} 人</div></div>
      </div>
    </section>`;
}
function addTpl() {
  return `<section class="card">
    <div class="section-title"><h2>新增业绩记录</h2><span class="muted">选择成员后记录个人业绩</span></div>
    <form id="recordForm">
      <div class="field"><label>成员</label><select name="memberId" required>${state.members.map(m => `<option value="${m.id}">${safeHtml(m.name)}${m.role ? ' · ' + safeHtml(m.role) : ''}</option>`).join('')}</select></div>
      <div class="field"><label>业绩类型</label><select name="typeId" required>${typeSelectOptions()}</select></div>
      <div class="field"><label>上报数量 / 数值</label><input name="value" type="number" inputmode="decimal" step="0.01" min="0" placeholder="例如 50、3、1" required /></div>
      <div class="field"><label>日期</label><input name="date" type="date" value="${todayStr()}" required /></div>
      <div class="field"><label>备注</label><textarea name="remark" placeholder="例如：信用卡上报情况。不要填写身份证、银行卡号等敏感信息。"></textarea></div>
      <button class="primary full" type="submit">保存记录</button>
    </form>
  </section>`;
}
function dayTpl() {
  const date = window.__selectedDate || todayStr();
  const memberId = currentMemberFilter();
  const recs = dateRecords(date, memberId).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return `<section class="card">
    <div class="section-title"><h2>日报</h2><div class="row narrow"><input id="dayPicker" type="date" value="${date}" style="max-width:150px">${memberFilterTpl('dayMemberFilter')}</div></div>
    <div class="grid">
      <div class="metric light"><div class="label">上报记录</div><div class="value">${recs.length} 笔</div></div>
      <div class="metric light"><div class="label">涉及项目</div><div class="value">${typeSummary(recs).length} 项</div></div>
    </div>
  </section>
  <section class="card">
    <div class="section-title"><h2>各项上报汇总</h2></div>${summaryList(typeSummary(recs))}
  </section>
  <section class="card">
    <div class="section-title"><h2>成员上报概况</h2></div>${memberSummaryList(memberSummary(recs))}
  </section>
  <section class="card">
    <div class="section-title"><h2>明细记录</h2></div>
    ${recs.length ? `<div class="list">${recs.map(recordItem).join('')}</div>` : `<div class="empty">当天还没有记录</div>`}
  </section>`;
}
function monthTpl() {
  const month = window.__selectedMonth || monthStr();
  const memberId = currentMemberFilter();
  const selectedType = window.__selectedTypeId || state.types[0]?.id || '';
  const recs = monthRecords(month, memberId);
  const typeItems = typeSummary(recs);
  return `<section class="card">
    <div class="section-title"><h2>月统计</h2><div class="row narrow"><input id="monthPicker" type="month" value="${month}" style="max-width:135px">${memberFilterTpl('monthMemberFilter')}</div></div>
    <div class="big">本月上报 ${recs.length} 笔</div>
    <div class="muted" style="margin-top:6px">按业绩类型分别统计，不再混合金额类与数量类。</div>
  </section>
  <section class="card">
    <div class="section-title"><h2>不同业绩月统计图</h2><span class="muted">按各类型上报总数</span></div>
    ${typeBarChart(typeItems)}
  </section>
  <section class="card">
    <div class="section-title"><h2>单项业绩每日趋势</h2><select id="trendTypePicker" class="compact-select">${typeSelectOptions(selectedType)}</select></div>
    ${singleTypeDailyTrend(month, selectedType, memberId)}
  </section>
  <section class="card">
    <div class="section-title"><h2>本月各项上报汇总</h2></div>${summaryList(typeItems, true)}
  </section>
  <section class="card">
    <div class="section-title"><h2>成员月度上报概况</h2></div>${memberSummaryList(memberSummary(recs))}
  </section>`;
}
function settingsTpl() {
  return `<section class="card">
    <div class="section-title"><h2>云端 数据同步设置</h2><span class="pill">数据文件 JSON</span></div>
    <p class="muted">先在 云端 建一个私有仓库，再填下面信息。Token 会保存在当前浏览器，请勿把此页面和 Token 发给别人。</p>
    <form id="configForm">
      <div class="grid">
        <div class="field"><label>用户名/组织</label><input name="owner" value="${safeHtml(config.owner)}" placeholder="例如 zhangsan" required></div>
        <div class="field"><label>仓库名</label><input name="repo" value="${safeHtml(config.repo)}" placeholder="例如 private" required></div>
      </div>
      <div class="grid">
        <div class="field"><label>分支</label><input name="branch" value="${safeHtml(config.branch || 'master')}" required></div>
        <div class="field"><label>数据路径</label><input name="path" value="${safeHtml(config.path || 'data/private.json')}" required></div>
      </div>
      <div class="field"><label>私人令牌 Access Token</label><input name="token" type="password" value="${safeHtml(config.token)}" placeholder="建议只给仓库内容读写权限" required></div>
      <button class="primary full" type="submit">保存同步设置</button>
    </form>
    <div class="row wrap" style="margin-top:10px">
      <button id="pullBtn" class="ghost">拉取</button>
      <button id="pushBtn" class="soft">上传/覆盖</button>
    </div>
  </section>
  <section class="card">
    <div class="section-title"><h2>成员管理</h2><button id="addMemberBtn" class="ghost small">新增成员</button></div>
    <div class="list">${state.members.map(memberItem).join('')}</div>
  </section>
  <section class="card">
    <div class="section-title"><h2>业绩类型</h2><button id="addTypeBtn" class="ghost small">新增类型</button></div>
    <div class="list">${state.types.map(typeItem).join('')}</div>
  </section>
  <section class="card">
    <div class="section-title"><h2>数据工具</h2></div>
    <div class="row wrap">
      <button id="exportBtn" class="ghost">导出 JSON</button>
      <button id="exportCsvBtn" class="ghost">导出 CSV</button>
      <button id="clearBtn" class="danger">清空记录</button>
    </div>
  </section>`;
}
function summaryList(items, withProgress = false) {
  if (!items.length) return `<div class="empty">暂无数据</div>`;
  const max = Math.max(...items.map(x => x.value), 1);
  return `<div class="list">${items.map(x => `
    <div class="item">
      <div style="flex:1">
        <div class="item-title"><span class="dot" style="background:${x.type.color}"></span>${safeHtml(x.type.name)}</div>
        <div class="item-sub">${x.count} 笔上报 · 单位：${safeHtml(x.type.unit)}</div>
        ${withProgress ? `<div class="progress dark" style="margin-top:8px"><span style="width:${Math.max(4, x.value / max * 100)}%"></span></div>` : ''}
      </div>
      <div class="amount">${formatValue(x.value, x.type.unit)}</div>
    </div>`).join('')}</div>`;
}
function memberSummaryList(items) {
  if (!items.length) return `<div class="empty">暂无成员上报数据</div>`;
  return `<div class="list">${items.map(x => `
    <div class="item">
      <div>
        <div class="item-title">${safeHtml(x.member.name)}</div>
        <div class="item-sub">${safeHtml(x.member.role || '未设置岗位')} · 涉及 ${x.typeCount} 项业绩</div>
      </div>
      <div class="amount">${x.count} 笔</div>
    </div>`).join('')}</div>`;
}
function recordItem(r) {
  const t = typeById(r.typeId) || { name:'已删除类型', unit:'', color:'#98A2B3' };
  const m = memberById(r.memberId) || { name:'未分配成员' };
  return `<div class="item">
    <div style="flex:1">
      <div class="item-title"><span class="dot" style="background:${t.color}"></span>${safeHtml(t.name)} <span class="pill mini">${safeHtml(m.name)}</span></div>
      <div class="item-sub">${safeHtml(r.remark || '无备注')}</div>
    </div>
    <div class="row"><div class="amount">${formatValue(r.value, t.unit)}</div><button class="danger small" data-delete-record="${r.id}">删除</button></div>
  </div>`;
}
function typeItem(t) {
  return `<div class="item">
    <div><div class="item-title"><span class="dot" style="background:${t.color}"></span>${safeHtml(t.name)}</div><div class="item-sub">单位：${safeHtml(t.unit)}</div></div>
    <button class="danger small" data-delete-type="${t.id}">删除</button>
  </div>`;
}
function memberItem(m) {
  return `<div class="item">
    <div><div class="item-title">${safeHtml(m.name)}</div><div class="item-sub">${safeHtml(m.role || '未设置岗位')}</div></div>
    <button class="danger small" data-delete-member="${m.id}">删除</button>
  </div>`;
}
function typeBarChart(items) {
  if (!items.length) return `<div class="empty">本月暂无业绩数据</div>`;
  const max = Math.max(...items.map(x => x.value), 1);
  return `<div class="type-chart">${items.map(x => `
    <div class="type-bar-row">
      <div class="type-bar-label"><span class="dot" style="background:${x.type.color}"></span>${safeHtml(x.type.name)}</div>
      <div class="type-bar-track"><span style="width:${Math.max(3, x.value / max * 100)}%; background:${x.type.color}"></span></div>
      <div class="type-bar-value">${formatValue(x.value, x.type.unit)}</div>
    </div>`).join('')}</div>`;
}
function singleTypeDailyTrend(month, typeId, memberId = currentMemberFilter()) {
  const t = typeById(typeId);
  if (!t) return `<div class="empty">请先新增业绩类型</div>`;
  const days = daysInMonth(month);
  const values = Array.from({ length: days }, (_, i) => {
    const day = `${month}-${String(i + 1).padStart(2, '0')}`;
    return monthRecords(month, memberId).filter(r => r.date === day && r.typeId === typeId).reduce((sum, r) => sum + Number(r.value || 0), 0);
  });
  const total = values.reduce((a, b) => a + b, 0);
  const max = Math.max(...values, 1);
  return `<div class="trend-head"><div><strong>${safeHtml(t.name)}</strong><div class="muted">本月合计：${formatValue(total, t.unit)}</div></div></div>
    <div class="chart scroll-chart">${values.map((v, i) => `<div class="bar" title="${i + 1}日 ${num(v)} ${safeHtml(t.unit)}" style="height:${v ? Math.max(5, v / max * 130) : 3}px; background:${t.color}"><span>${i + 1}</span></div>`).join('')}</div>`;
}
function bindPage() {
  document.querySelectorAll('[data-page-jump]').forEach(b => b.onclick = () => { page = b.dataset.pageJump; render(); });
  ['homeMemberFilter', 'dayMemberFilter', 'monthMemberFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.onchange = e => { window.__memberFilter = e.target.value; render(); };
  });
  const recordForm = document.getElementById('recordForm');
  if (recordForm) recordForm.onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(recordForm);
    state.records.push({
      id: uid(),
      memberId: fd.get('memberId'),
      typeId: fd.get('typeId'),
      value: Number(fd.get('value')),
      date: fd.get('date'),
      remark: fd.get('remark'),
      createdAt: new Date().toISOString()
    });
    saveLocal();
    showToast('已保存到本地');
    recordForm.reset();
    recordForm.memberId.value = state.members[0]?.id || '';
    recordForm.date.value = todayStr();
  };
  const dayPicker = document.getElementById('dayPicker');
  if (dayPicker) dayPicker.onchange = e => { window.__selectedDate = e.target.value; render(); };
  const monthPicker = document.getElementById('monthPicker');
  if (monthPicker) monthPicker.onchange = e => { window.__selectedMonth = e.target.value; render(); };
  const trendTypePicker = document.getElementById('trendTypePicker');
  if (trendTypePicker) trendTypePicker.onchange = e => { window.__selectedTypeId = e.target.value; render(); };
  document.querySelectorAll('[data-delete-record]').forEach(b => b.onclick = () => {
    if (!confirm('确定删除这条记录？')) return;
    state.records = state.records.filter(r => r.id !== b.dataset.deleteRecord);
    saveLocal(); render();
  });
  document.querySelectorAll('[data-delete-type]').forEach(b => b.onclick = () => {
    if (state.records.some(r => r.typeId === b.dataset.deleteType)) { showToast('该类型已有记录，不能直接删除'); return; }
    if (!confirm('确定删除该业绩类型？')) return;
    state.types = state.types.filter(t => t.id !== b.dataset.deleteType);
    saveLocal(); render();
  });
  document.querySelectorAll('[data-delete-member]').forEach(b => b.onclick = () => {
    if (state.records.some(r => r.memberId === b.dataset.deleteMember)) { showToast('该成员已有记录，不能直接删除'); return; }
    if (state.members.length <= 1) { showToast('至少保留一名成员'); return; }
    if (!confirm('确定删除该成员？')) return;
    state.members = state.members.filter(m => m.id !== b.dataset.deleteMember);
    if (window.__memberFilter === b.dataset.deleteMember) window.__memberFilter = 'all';
    saveLocal(); render();
  });
  const addTypeBtn = document.getElementById('addTypeBtn');
  if (addTypeBtn) addTypeBtn.onclick = () => {
    const name = prompt('请输入业绩类型名称，例如：养老金账户'); if (!name) return;
    const unit = prompt('请输入单位：万元 / 元 / 笔 / 户 / 张 / 次 / 件 / 份', '笔') || '笔';
    state.types.push({ id: uid(), name, unit, color: COLORS[state.types.length % COLORS.length], active: true, sortOrder: state.types.length + 1 });
    saveLocal(); render();
  };
  const addMemberBtn = document.getElementById('addMemberBtn');
  if (addMemberBtn) addMemberBtn.onclick = () => {
    const name = prompt('请输入成员姓名，例如：崔子坤'); if (!name) return;
    const role = prompt('请输入岗位/备注，例如：客户经理', '客户经理') || '';
    state.members.push({ id: uid(), name, role, active: true, createdAt: new Date().toISOString() });
    saveLocal(); render();
  };
  const configForm = document.getElementById('configForm');
  if (configForm) configForm.onsubmit = e => { e.preventDefault(); const fd = new FormData(configForm); config = Object.fromEntries(fd.entries()); saveConfig(); showToast('同步设置已保存'); };
  const pullBtn = document.getElementById('pullBtn');
  if (pullBtn) pullBtn.onclick = pullFromGitee;
  const pushBtn = document.getElementById('pushBtn');
  if (pushBtn) pushBtn.onclick = pushToGitee;
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) exportBtn.onclick = () => downloadFile('performance-data.json', JSON.stringify(state, null, 2), 'application/json');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  if (exportCsvBtn) exportCsvBtn.onclick = exportCsv;
  const clearBtn = document.getElementById('clearBtn');
  if (clearBtn) clearBtn.onclick = () => { if(confirm('确定清空所有业绩记录？成员和业绩类型会保留。')) { state.records = []; saveLocal(); render(); } };
}
function checkConfig() {
  if (!config.owner || !config.repo || !config.branch || !config.path || !config.token) {
    page = 'settings'; render(); showToast('请先填写 云端 同步设置'); return false;
  }
  return true;
}
function encodeBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}
function decodeBase64(b64) {
  const binary = atob((b64 || '').replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function fileUrl() {
  return `${API_ROOT}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${config.path.split('/').map(encodeURIComponent).join('/')}?access_token=${encodeURIComponent(config.token)}&ref=${encodeURIComponent(config.branch)}`;
}
async function getRemoteFile() {
  const res = await fetch(fileUrl(), { method: 'GET' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  remoteSha = json.sha || '';
  const data = JSON.parse(decodeBase64(json.content || 'e30='));
  return { data, sha: json.sha };
}
async function pullFromGitee() {
  if (!checkConfig()) return;
  try {
    showToast('正在从 云端 拉取...');
    const remote = await getRemoteFile();
    if (!remote) { showToast('Gitee 上还没有数据文件，可先上传'); return; }
    state = normalizeData(remote.data);
    saveLocal(); render(); showToast('已从 云端 同步到本机');
  } catch (err) { console.error(err); showToast('拉取失败：请检查 Token、仓库、分支或跨域限制'); }
}
async function pushToGitee() {
  if (!checkConfig()) return;
  try {
    showToast('正在上传到 云端...');
    let sha = '';
    try { const remote = await getRemoteFile(); sha = remote?.sha || ''; } catch (e) { if (!String(e).includes('404')) throw e; }
    const body = {
      access_token: config.token,
      content: encodeBase64(JSON.stringify(state, null, 2)),
      message: `update performance data ${new Date().toLocaleString('zh-CN')}`,
      branch: config.branch
    };
    if (sha) body.sha = sha;
    const url = `${API_ROOT}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${config.path.split('/').map(encodeURIComponent).join('/')}`;
    const res = await fetch(url, { method: sha ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json(); remoteSha = json.content?.sha || json.sha || '';
    showToast('已上传到 云端');
  } catch (err) { console.error(err); showToast('上传失败：请检查仓库权限、路径或 Token'); }
}
function normalizeData(d) {
  const base = defaultData();
  let members = Array.isArray(d.members) && d.members.length ? d.members.map((m, idx) => ({
    id: m.id || uid(),
    name: m.name || `成员${idx + 1}`,
    role: m.role || '',
    active: m.active !== false,
    createdAt: m.createdAt || new Date().toISOString()
  })) : base.members;
  const defaultMemberId = members[0].id;
  const types = Array.isArray(d.types) && d.types.length ? d.types.map((t, idx) => ({
    id: t.id || uid(),
    name: t.name || `业绩类型${idx + 1}`,
    unit: t.unit || '笔',
    color: t.color || COLORS[idx % COLORS.length],
    active: t.active !== false,
    sortOrder: Number(t.sortOrder || idx + 1)
  })) : base.types;
  const typeIds = new Set(types.map(t => t.id));
  const records = Array.isArray(d.records) ? d.records.map(r => ({
    id: r.id || uid(),
    memberId: r.memberId || defaultMemberId,
    typeId: r.typeId || types[0]?.id || '',
    value: Number(r.value || 0),
    date: r.date || todayStr(),
    remark: r.remark || '',
    createdAt: r.createdAt || new Date().toISOString()
  })).filter(r => r.typeId && typeIds.has(r.typeId)) : [];
  return { version: 2, members, types, records, updatedAt: d.updatedAt || new Date().toISOString() };
}
function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportCsv() {
  const header = ['日期', '成员', '岗位', '类型', '数值', '单位', '备注'];
  const rows = state.records.map(r => {
    const t = typeById(r.typeId) || { name:'已删除类型', unit:'' };
    const m = memberById(r.memberId) || { name:'未分配成员', role:'' };
    return [r.date, m.name, m.role || '', t.name, r.value, t.unit, r.remark || ''];
  });
  const csv = [header, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadFile('performance-records.csv', '\ufeff' + csv, 'text/csv;charset=utf-8');
}

document.querySelectorAll('.tabbar button').forEach(b => b.onclick = () => { page = b.dataset.page; render(); });
document.getElementById('syncBtn').onclick = pushToGitee;
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
render();
