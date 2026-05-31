const STORAGE_KEY = 'bank-performance-gitee-webapp-state-v1';
const CONFIG_KEY = 'bank-performance-gitee-config-v1';
const API_ROOT = 'https://gitee.com/api/v5';

const defaultData = () => ({
  types: [
    { id: uid(), name: '存款', unit: '元', color: '#155EEF', includeInTotal: true },
    { id: uid(), name: '理财', unit: '元', color: '#079455', includeInTotal: true },
    { id: uid(), name: '保险', unit: '元', color: '#DC6803', includeInTotal: true },
    { id: uid(), name: '信用卡', unit: '张', color: '#7A5AF8', includeInTotal: false },
    { id: uid(), name: '手机银行', unit: '户', color: '#0E9384', includeInTotal: false },
  ],
  records: [],
  targets: { monthlyAmount: 1000000 },
  updatedAt: new Date().toISOString()
});

let state = loadLocal();
let config = loadConfig();
let page = 'home';
let remoteSha = '';

function uid() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
function monthStr(d = new Date()) { return d.toISOString().slice(0, 7); }
function yuan(n) { return '¥' + Number(n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 }); }
function num(n) { return Number(n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 }); }
function byId(id) { return state.types.find(t => t.id === id); }
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove('show'), 2300);
}
function saveLocal() {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function loadLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultData(); }
  catch { return defaultData(); }
}
function saveConfig() { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); }
function loadConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) || { owner:'', repo:'', branch:'master', path:'data/performance.json', token:'' }; }
  catch { return { owner:'', repo:'', branch:'master', path:'data/performance.json', token:'' }; }
}
function safeHtml(s) { return String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

function encodeBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
function decodeBase64(b64) {
  const binary = atob((b64 || '').replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function dateRecords(date) { return state.records.filter(r => r.date === date); }
function monthRecords(month) { return state.records.filter(r => r.date && r.date.startsWith(month)); }
function amountTotal(records) {
  return records.reduce((sum, r) => {
    const t = byId(r.typeId);
    return sum + (t && t.includeInTotal ? Number(r.value || 0) : 0);
  }, 0);
}
function typeSummary(records) {
  const map = new Map();
  records.forEach(r => {
    const t = byId(r.typeId) || { id: r.typeId, name: '已删除类型', unit: '', color: '#98A2B3', includeInTotal: false };
    if (!map.has(t.id)) map.set(t.id, { type: t, value: 0, count: 0 });
    const item = map.get(t.id);
    item.value += Number(r.value || 0); item.count += 1;
  });
  return Array.from(map.values()).sort((a,b) => b.value - a.value);
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

function homeTpl() {
  const today = todayStr();
  const month = monthStr();
  const dRecs = dateRecords(today);
  const mRecs = monthRecords(month);
  const todayAmount = amountTotal(dRecs);
  const monthAmount = amountTotal(mRecs);
  const target = Number(state.targets.monthlyAmount || 0);
  const rate = target ? Math.min(999, monthAmount / target * 100) : 0;
  const best = typeSummary(mRecs).filter(x => x.type.includeInTotal)[0];
  return `
    <section class="card hero">
      <div class="muted" style="color:rgba(255,255,255,.78)">${today}</div>
      <div class="big">${yuan(todayAmount)}</div>
      <div class="grid" style="margin-top:14px">
        <div class="metric"><div class="label">今日记录</div><div class="value">${dRecs.length} 笔</div></div>
        <div class="metric"><div class="label">本月累计</div><div class="value">${yuan(monthAmount)}</div></div>
      </div>
      <div class="row" style="margin-top:12px"><span>月目标完成率</span><strong>${rate.toFixed(1)}%</strong></div>
      <div class="progress"><span style="width:${Math.min(rate,100)}%"></span></div>
    </section>
    <section class="grid">
      <button class="primary" data-page-jump="add">+ 记录业绩</button>
      <button class="ghost" data-page-jump="month">查看月报</button>
    </section>
    <section class="card">
      <div class="section-title"><h2>今日分类</h2><span class="muted">${dRecs.length} 笔</span></div>
      ${summaryList(typeSummary(dRecs))}
    </section>
    <section class="card">
      <div class="section-title"><h2>本月表现</h2><span class="pill">${month}</span></div>
      <div class="grid">
        <div class="metric light"><div class="label">距离目标</div><div class="value">${yuan(Math.max(target - monthAmount, 0))}</div></div>
        <div class="metric light"><div class="label">最强项目</div><div class="value" style="font-size:18px">${best ? safeHtml(best.type.name) : '暂无'}</div></div>
      </div>
    </section>`;
}

function addTpl() {
  return `<section class="card">
    <div class="section-title"><h2>新增业绩记录</h2><span class="muted">自动保存到本地，可同步到 Gitee</span></div>
    <form id="recordForm">
      <div class="field"><label>业绩类型</label><select name="typeId" required>${state.types.map(t => `<option value="${t.id}">${safeHtml(t.name)}（${safeHtml(t.unit)}）</option>`).join('')}</select></div>
      <div class="field"><label>金额 / 数量</label><input name="value" type="number" inputmode="decimal" step="0.01" min="0" placeholder="例如 50000" required /></div>
      <div class="field"><label>日期</label><input name="date" type="date" value="${todayStr()}" required /></div>
      <div class="field"><label>备注</label><textarea name="remark" placeholder="例如：客户购买理财。不要填写身份证、银行卡号等敏感信息。"></textarea></div>
      <button class="primary full" type="submit">保存记录</button>
    </form>
  </section>`;
}

function dayTpl() {
  const date = window.__selectedDate || todayStr();
  const recs = dateRecords(date).sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return `<section class="card">
    <div class="section-title"><h2>日报</h2><input id="dayPicker" type="date" value="${date}" style="max-width:160px"></div>
    <div class="grid">
      <div class="metric light"><div class="label">金额类合计</div><div class="value">${yuan(amountTotal(recs))}</div></div>
      <div class="metric light"><div class="label">记录笔数</div><div class="value">${recs.length}</div></div>
    </div>
  </section>
  <section class="card">
    <div class="section-title"><h2>分类汇总</h2></div>${summaryList(typeSummary(recs))}
  </section>
  <section class="card">
    <div class="section-title"><h2>明细记录</h2></div>
    ${recs.length ? `<div class="list">${recs.map(recordItem).join('')}</div>` : `<div class="empty">当天还没有记录</div>`}
  </section>`;
}

function monthTpl() {
  const month = window.__selectedMonth || monthStr();
  const recs = monthRecords(month);
  const target = Number(state.targets.monthlyAmount || 0);
  const amount = amountTotal(recs);
  const rate = target ? amount / target * 100 : 0;
  return `<section class="card">
    <div class="section-title"><h2>月报</h2><input id="monthPicker" type="month" value="${month}" style="max-width:150px"></div>
    <div class="big">${yuan(amount)}</div>
    <div class="row"><span class="muted">月度目标 ${yuan(target)}</span><strong>${rate.toFixed(1)}%</strong></div>
    <div class="progress dark"><span style="width:${Math.min(rate,100)}%"></span></div>
  </section>
  <section class="card">
    <div class="section-title"><h2>每日趋势</h2><span class="muted">仅统计金额类</span></div>
    ${barChart(month)}
  </section>
  <section class="card">
    <div class="section-title"><h2>类型占比</h2></div>${summaryList(typeSummary(recs), true)}
  </section>`;
}

function settingsTpl() {
  return `<section class="card">
    <div class="section-title"><h2>Gitee 数据同步设置</h2><span class="pill">数据文件 JSON</span></div>
    <p class="muted">先在 Gitee 建一个私有仓库，再填下面信息。Token 会保存在当前浏览器，请勿把此页面和 Token 发给别人。</p>
    <form id="configForm">
      <div class="grid">
        <div class="field"><label>Gitee 用户名/组织</label><input name="owner" value="${safeHtml(config.owner)}" placeholder="例如 zhangsan" required></div>
        <div class="field"><label>仓库名</label><input name="repo" value="${safeHtml(config.repo)}" placeholder="例如 performance-data" required></div>
      </div>
      <div class="grid">
        <div class="field"><label>分支</label><input name="branch" value="${safeHtml(config.branch || 'master')}" required></div>
        <div class="field"><label>数据路径</label><input name="path" value="${safeHtml(config.path || 'data/performance.json')}" required></div>
      </div>
      <div class="field"><label>私人令牌 Access Token</label><input name="token" type="password" value="${safeHtml(config.token)}" placeholder="建议只给仓库内容读写权限" required></div>
      <button class="primary full" type="submit">保存同步设置</button>
    </form>
    <div class="row wrap" style="margin-top:10px">
      <button id="pullBtn" class="ghost">从 Gitee 拉取</button>
      <button id="pushBtn" class="soft">上传/覆盖到 Gitee</button>
    </div>
  </section>
  <section class="card">
    <div class="section-title"><h2>目标设置</h2></div>
    <form id="targetForm">
      <div class="field"><label>月度金额目标</label><input name="monthlyAmount" type="number" min="0" step="0.01" value="${state.targets.monthlyAmount || 0}"></div>
      <button class="primary full" type="submit">保存目标</button>
    </form>
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
        <div class="item-sub">${x.count} 笔 · 单位：${safeHtml(x.type.unit)}${x.type.includeInTotal ? ' · 计入金额合计' : ''}</div>
        ${withProgress ? `<div class="progress dark" style="margin-top:8px"><span style="width:${Math.max(4, x.value / max * 100)}%"></span></div>` : ''}
      </div>
      <div class="amount">${x.type.unit === '元' ? yuan(x.value) : `${num(x.value)} ${safeHtml(x.type.unit)}`}</div>
    </div>`).join('')}</div>`;
}
function recordItem(r) {
  const t = byId(r.typeId) || { name:'已删除类型', unit:'', color:'#98A2B3', includeInTotal:false };
  return `<div class="item">
    <div><div class="item-title"><span class="dot" style="background:${t.color}"></span>${safeHtml(t.name)}</div><div class="item-sub">${safeHtml(r.remark || '无备注')}</div></div>
    <div class="row"><div class="amount">${t.unit === '元' ? yuan(r.value) : `${num(r.value)} ${safeHtml(t.unit)}`}</div><button class="danger small" data-delete-record="${r.id}">删除</button></div>
  </div>`;
}
function typeItem(t) {
  return `<div class="item">
    <div><div class="item-title"><span class="dot" style="background:${t.color}"></span>${safeHtml(t.name)}</div><div class="item-sub">单位：${safeHtml(t.unit)} · ${t.includeInTotal ? '计入金额合计' : '不计入金额合计'}</div></div>
    <button class="danger small" data-delete-type="${t.id}">删除</button>
  </div>`;
}
function barChart(month) {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const values = Array.from({ length: days }, (_, i) => {
    const day = `${month}-${String(i+1).padStart(2,'0')}`;
    return amountTotal(dateRecords(day));
  });
  const max = Math.max(...values, 1);
  return `<div class="chart">${values.map((v,i) => `<div class="bar" title="${i+1}日 ${yuan(v)}" style="height:${Math.max(3, v / max * 130)}px"><span>${i+1}</span></div>`).join('')}</div>`;
}

function bindPage() {
  document.querySelectorAll('[data-page-jump]').forEach(b => b.onclick = () => { page = b.dataset.pageJump; render(); });
  const recordForm = document.getElementById('recordForm');
  if (recordForm) recordForm.onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(recordForm);
    state.records.push({ id: uid(), typeId: fd.get('typeId'), value: Number(fd.get('value')), date: fd.get('date'), remark: fd.get('remark'), createdAt: new Date().toISOString() });
    saveLocal(); showToast('已保存到本地'); recordForm.reset(); recordForm.date.value = todayStr();
  };
  const dayPicker = document.getElementById('dayPicker');
  if (dayPicker) dayPicker.onchange = e => { window.__selectedDate = e.target.value; render(); };
  const monthPicker = document.getElementById('monthPicker');
  if (monthPicker) monthPicker.onchange = e => { window.__selectedMonth = e.target.value; render(); };
  document.querySelectorAll('[data-delete-record]').forEach(b => b.onclick = () => {
    if (!confirm('确定删除这条记录？')) return;
    state.records = state.records.filter(r => r.id !== b.dataset.deleteRecord); saveLocal(); render();
  });
  document.querySelectorAll('[data-delete-type]').forEach(b => b.onclick = () => {
    if (state.records.some(r => r.typeId === b.dataset.deleteType)) { showToast('该类型已有记录，不能直接删除'); return; }
    if (!confirm('确定删除该业绩类型？')) return;
    state.types = state.types.filter(t => t.id !== b.dataset.deleteType); saveLocal(); render();
  });
  const addTypeBtn = document.getElementById('addTypeBtn');
  if (addTypeBtn) addTypeBtn.onclick = () => {
    const name = prompt('请输入业绩类型名称，例如：养老金账户'); if (!name) return;
    const unit = prompt('请输入单位：元 / 笔 / 户 / 张 / 次 / 份', '元') || '元';
    const includeInTotal = unit === '元' ? confirm('是否计入金额合计？') : false;
    const colors = ['#155EEF','#079455','#DC6803','#7A5AF8','#0E9384','#D92D20','#475467'];
    state.types.push({ id: uid(), name, unit, includeInTotal, color: colors[state.types.length % colors.length] });
    saveLocal(); render();
  };
  const targetForm = document.getElementById('targetForm');
  if (targetForm) targetForm.onsubmit = e => { e.preventDefault(); state.targets.monthlyAmount = Number(new FormData(targetForm).get('monthlyAmount') || 0); saveLocal(); showToast('目标已保存'); };
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
  if (clearBtn) clearBtn.onclick = () => { if(confirm('确定清空所有业绩记录？业绩类型和目标会保留。')) { state.records = []; saveLocal(); render(); } };
}

function checkConfig() {
  if (!config.owner || !config.repo || !config.branch || !config.path || !config.token) {
    page = 'settings'; render(); showToast('请先填写 Gitee 同步设置'); return false;
  }
  return true;
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
    showToast('正在从 Gitee 拉取...');
    const remote = await getRemoteFile();
    if (!remote) { showToast('Gitee 上还没有数据文件，可先上传'); return; }
    state = normalizeData(remote.data); saveLocal(); render(); showToast('已从 Gitee 同步到本机');
  } catch (err) { console.error(err); showToast('拉取失败：请检查 Token、仓库、分支或跨域限制'); }
}
async function pushToGitee() {
  if (!checkConfig()) return;
  try {
    showToast('正在上传到 Gitee...');
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
    showToast('已上传到 Gitee');
  } catch (err) { console.error(err); showToast('上传失败：请检查仓库权限、路径或 Token'); }
}
function normalizeData(d) {
  const base = defaultData();
  return {
    types: Array.isArray(d.types) ? d.types : base.types,
    records: Array.isArray(d.records) ? d.records : [],
    targets: d.targets || base.targets,
    updatedAt: d.updatedAt || new Date().toISOString()
  };
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportCsv() {
  const header = ['日期','类型','数值','单位','是否计入金额合计','备注'];
  const rows = state.records.map(r => {
    const t = byId(r.typeId) || { name:'已删除类型', unit:'', includeInTotal:false };
    return [r.date, t.name, r.value, t.unit, t.includeInTotal ? '是' : '否', r.remark || ''];
  });
  const csv = [header, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadFile('performance-records.csv', '\ufeff' + csv, 'text/csv;charset=utf-8');
}

document.querySelectorAll('.tabbar button').forEach(b => b.onclick = () => { page = b.dataset.page; render(); });
document.getElementById('syncBtn').onclick = pushToGitee;
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
render();
