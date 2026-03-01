/**
 * 代码生成器 - 前端交互逻辑
 */

// ============ 全局状态 ============
const state = {
  currentTab: 'generator',
  currentStep: 1,
  selectedDatasourceId: null,
  selectedDatabase: null,
  selectedTable: null,
  tableInfo: null,
  // 分组相关
  groups: [],
  currentGroupFilter: '', // 模板管理页当前筛选的分组 ID
  selectedGenGroupId: '', // 代码生成页选择的分组 ID
};

// ============ 工具函数 ============
const API = {
  async get(url) {
    const res = await fetch(url);
    return res.json();
  },
  async post(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async put(url, data) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async del(url) {
    const res = await fetch(url, { method: 'DELETE' });
    return res.json();
  },
};

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function hideModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function escapeHTML(str) {
  if (!str) return '';
  const s = String(str);
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// ============ 标签页切换 ============
function switchTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll('.nav-tab[data-tab]').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.toggle('active', el.id === `tab-${tab}`);
  });

  if (tab === 'datasource') loadDatasources();
  if (tab === 'templates') { loadGroups(); loadTemplates(); }
  if (tab === 'generator') { refreshDatasourceList(); loadGroupsForGenerate(); }
}

// ============ 分组管理 ============
async function loadGroups() {
  try {
    const res = await API.get('/api/template/groups');
    if (res.success) {
      state.groups = res.data;
      renderGroupTabs();
      renderGroupSelectOptions();
    }
  } catch (e) {
    console.error('加载分组失败:', e);
  }
}

function renderGroupTabs() {
  const container = document.getElementById('groupTabs');
  if (!container) return;

  let html = `<button class="nav-tab ${state.currentGroupFilter === '' ? 'active' : ''}" data-group-id="" onclick="switchGroupTab('')">全部</button>`;
  for (const g of state.groups) {
    html += `<button class="nav-tab ${state.currentGroupFilter === String(g.id) ? 'active' : ''}" data-group-id="${g.id}" onclick="switchGroupTab('${g.id}')">
      ${escapeHTML(g.name)}
      <span class="group-delete-btn" onclick="event.stopPropagation();deleteGroup(${g.id})" title="删除分组">×</span>
    </button>`;
  }
  container.innerHTML = html;
}

function renderGroupSelectOptions() {
  const selects = document.querySelectorAll('#templateGroupSelect');
  selects.forEach(sel => {
    let html = '<option value="">未分组</option>';
    for (const g of state.groups) {
      html += `<option value="${g.id}">${escapeHTML(g.name)}</option>`;
    }
    sel.innerHTML = html;
  });
}

function switchGroupTab(groupId) {
  state.currentGroupFilter = groupId;
  renderGroupTabs();
  loadTemplates();
}

function showAddGroupModal() {
  const form = document.getElementById('groupForm');
  form.reset();
  form.querySelector('[name="groupId"]').value = '';
  document.getElementById('groupModalTitle').textContent = '新建分组';
  showModal('groupModal');
}

async function saveGroup() {
  const form = document.getElementById('groupForm');
  const id = form.querySelector('[name="groupId"]').value;
  const name = form.querySelector('[name="groupName"]').value;
  const description = form.querySelector('[name="groupDescription"]').value;

  try {
    let res;
    if (id) {
      res = await API.put(`/api/template/group/${id}`, { name, description });
    } else {
      res = await API.post('/api/template/group/create', { name, description });
    }

    if (res.success) {
      showToast(id ? '分组更新成功' : '分组创建成功', 'success');
      hideModal('groupModal');
      loadGroups();
      loadGroupsForGenerate();
    } else {
      showToast('保存分组失败: ' + res.message, 'error');
    }
  } catch (e) {
    showToast('保存分组失败: ' + e.message, 'error');
  }
}

async function deleteGroup(id) {
  if (!confirm('确定删除该分组？分组内的模板将变为未分组。')) return;
  try {
    const res = await API.del(`/api/template/group/${id}`);
    if (res.success) {
      showToast('分组已删除', 'success');
      if (state.currentGroupFilter === String(id)) {
        state.currentGroupFilter = '';
      }
      loadGroups();
      loadTemplates();
      loadGroupsForGenerate();
    } else {
      showToast('删除失败: ' + res.message, 'error');
    }
  } catch (e) {
    showToast('删除失败: ' + e.message, 'error');
  }
}

// 代码生成页面的分组下拉
async function loadGroupsForGenerate() {
  try {
    const res = await API.get('/api/template/groups');
    if (!res.success) return;

    const sel = document.getElementById('genGroupSelect');
    if (!sel) return;

    let html = '<option value="">全部模板</option>';
    for (const g of res.data) {
      html += `<option value="${g.id}" ${state.selectedGenGroupId === String(g.id) ? 'selected' : ''}>${escapeHTML(g.name)}</option>`;
    }
    sel.innerHTML = html;
  } catch (e) {
    console.error('加载分组失败', e);
  }
}

function onGenGroupChange() {
  state.selectedGenGroupId = document.getElementById('genGroupSelect').value;
  // 如果在步骤5，重新生成预览
  if (state.currentStep === 5) {
    previewCode();
  }
}

// ============ 数据源管理 ============
async function loadDatasources() {
  const container = document.getElementById('datasourceList');
  try {
    const res = await API.get('/api/database/list');
    if (!res.success || !res.data.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">🗄️</div>
          <p>暂无数据源，点击上方按钮添加</p>
        </div>`;
      return;
    }

    container.innerHTML = res.data.map(db => `
      <div class="list-item">
        <div class="list-item-info">
          <span class="badge badge-${db.type}">${db.type.toUpperCase()}</span>
          <div>
            <div class="list-item-name">${escapeHTML(db.name)}</div>
            <div class="list-item-meta">${db.host ? db.host + ':' + db.port : ''} / ${escapeHTML(db.database)}</div>
          </div>
        </div>
        <div class="btn-group">
          <button class="btn btn-danger btn-sm" onclick="deleteDatasource('${db.id}')">删除</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    showToast('加载数据源失败: ' + e.message, 'error');
  }
}

function showAddDatasourceModal() {
  document.getElementById('datasourceForm').reset();
  onDbTypeChange('mysql');
  showModal('addDatasourceModal');
}

function onDbTypeChange(type) {
  const serverFields = document.getElementById('serverDbFields');
  const sqliteFields = document.getElementById('sqliteDbFields');
  if (type === 'sqlite') {
    serverFields.classList.add('hidden');
    sqliteFields.classList.remove('hidden');
  } else {
    serverFields.classList.remove('hidden');
    sqliteFields.classList.add('hidden');
    const portInput = document.querySelector('[name="port"]');
    portInput.value = type === 'mysql' ? '3306' : '5432';
  }
}

async function addDatasource() {
  const form = document.getElementById('datasourceForm');
  const type = form.querySelector('[name="type"]').value;
  const btn = document.getElementById('addDatasourceBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 连接中...';

  try {
    const data = { type, name: form.querySelector('[name="name"]').value };

    if (type === 'sqlite') {
      data.filename = form.querySelector('[name="filename"]').value;
      data.database = form.querySelector('[name="sqliteDbName"]').value || 'main';
    } else {
      data.host = form.querySelector('[name="host"]').value;
      data.port = parseInt(form.querySelector('[name="port"]').value) || undefined;
      data.user = form.querySelector('[name="user"]').value;
      data.password = form.querySelector('[name="password"]').value;
      data.database = form.querySelector('[name="database"]').value;
    }

    const res = await API.post('/api/database/connect', data);
    if (res.success) {
      showToast('数据源添加成功', 'success');
      hideModal('addDatasourceModal');
      loadDatasources();
    } else {
      showToast('连接失败: ' + res.message, 'error');
    }
  } catch (e) {
    showToast('连接失败: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '测试并保存';
  }
}

async function deleteDatasource(id) {
  if (!confirm('确定删除该数据源？')) return;
  try {
    const res = await API.del(`/api/database/disconnect/${id}`);
    if (res.success) {
      showToast('数据源已删除', 'success');
      loadDatasources();
    } else {
      showToast('删除失败: ' + res.message, 'error');
    }
  } catch (e) {
    showToast('删除失败: ' + e.message, 'error');
  }
}

// ============ 模板管理 ============
async function loadTemplates() {
  const container = document.getElementById('templateList');
  try {
    const url = state.currentGroupFilter
      ? `/api/template/list?groupId=${state.currentGroupFilter}`
      : '/api/template/list';
    const res = await API.get(url);
    if (!res.success || !res.data.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">📝</div>
          <p>暂无模板</p>
        </div>`;
      return;
    }

    container.innerHTML = res.data.map(tpl => `
      <div class="list-item">
        <div class="list-item-info">
          ${tpl.groupName ? `<span class="badge badge-postgres">${escapeHTML(tpl.groupName)}</span>` : '<span class="badge" style="background:rgba(150,150,150,0.15);color:var(--text-muted)">未分组</span>'}
          <div>
            <div class="list-item-name">${escapeHTML(tpl.name)}</div>
            <div class="list-item-meta">输出: ${escapeHTML(tpl.filename)}</div>
          </div>
        </div>
        <div class="btn-group">
          <button class="btn btn-secondary btn-sm" onclick="editTemplate(${tpl.id})">编辑</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTemplate(${tpl.id})">删除</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    showToast('加载模板失败: ' + e.message, 'error');
  }
}

function showAddTemplateModal() {
  const form = document.getElementById('templateForm');
  form.reset();
  form.querySelector('[name="templateId"]').value = '';
  document.getElementById('templateModalTitle').textContent = '新建模板';
  // 刷新分组列表
  renderGroupSelectOptions();
  showModal('templateModal');
}

async function editTemplate(id) {
  try {
    const res = await API.get(`/api/template/${id}`);
    if (!res.success) {
      showToast('加载模板失败', 'error');
      return;
    }

    await loadGroups();
    renderGroupSelectOptions();

    const form = document.getElementById('templateForm');
    form.querySelector('[name="templateId"]').value = res.data.id;
    form.querySelector('[name="templateName"]').value = res.data.name;
    form.querySelector('[name="templateFilename"]').value = res.data.filename;
    form.querySelector('[name="templateContent"]').value = res.data.content;
    form.querySelector('[name="templateGroupId"]').value = res.data.groupId || '';
    document.getElementById('templateModalTitle').textContent = '编辑模板';
    showModal('templateModal');
  } catch (e) {
    showToast('加载模板失败: ' + e.message, 'error');
  }
}

async function saveTemplate() {
  const form = document.getElementById('templateForm');
  const id = form.querySelector('[name="templateId"]').value;
  const groupIdVal = form.querySelector('[name="templateGroupId"]').value;
  const data = {
    name: form.querySelector('[name="templateName"]').value,
    filename: form.querySelector('[name="templateFilename"]').value,
    content: form.querySelector('[name="templateContent"]').value,
    groupId: groupIdVal ? Number(groupIdVal) : undefined,
  };

  try {
    let res;
    if (id) {
      res = await API.put(`/api/template/${id}`, data);
    } else {
      res = await API.post('/api/template/create', data);
    }

    if (res.success) {
      showToast(id ? '模板更新成功' : '模板创建成功', 'success');
      hideModal('templateModal');
      loadTemplates();
    } else {
      showToast('保存失败: ' + res.message, 'error');
    }
  } catch (e) {
    showToast('保存失败: ' + e.message, 'error');
  }
}

async function deleteTemplate(id) {
  if (!confirm('确定删除该模板？')) return;
  try {
    const res = await API.del(`/api/template/${id}`);
    if (res.success) {
      showToast('模板已删除', 'success');
      loadTemplates();
    } else {
      showToast('删除失败: ' + res.message, 'error');
    }
  } catch (e) {
    showToast('删除失败: ' + e.message, 'error');
  }
}

async function resetTemplates() {
  if (!confirm('确定重置为默认模板？现有所有模板和分组将被覆盖！')) return;
  try {
    const res = await API.post('/api/template/reset');
    if (res.success) {
      showToast('已重置为默认模板', 'success');
      state.currentGroupFilter = '';
      loadGroups();
      loadTemplates();
      loadGroupsForGenerate();
    } else {
      showToast('重置失败: ' + res.message, 'error');
    }
  } catch (e) {
    showToast('重置失败: ' + e.message, 'error');
  }
}

// ============ 代码生成流程 ============
function goToStep(step) {
  state.currentStep = step;

  document.querySelectorAll('#genSteps .step').forEach(el => {
    const s = parseInt(el.dataset.step);
    el.classList.remove('active', 'completed');
    if (s === step) el.classList.add('active');
    else if (s < step) el.classList.add('completed');
  });

  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`step-${i}`);
    if (el) el.classList.toggle('hidden', i !== step);
  }

  if (step === 1) refreshDatasourceList();
  if (step === 2 && state.selectedDatasourceId) loadDatabases();
  if (step === 3 && state.selectedDatasourceId) loadTables();
  if (step === 5) { loadGroupsForGenerate(); previewCode(); }
}

async function refreshDatasourceList() {
  const container = document.getElementById('datasourceSelectList');
  try {
    const res = await API.get('/api/database/list');
    if (!res.success || !res.data.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">🗄️</div>
          <p>暂无数据源，请先在「数据源管理」中添加</p>
        </div>`;
      return;
    }

    container.innerHTML = res.data.map(db => `
      <div class="select-list-item ${state.selectedDatasourceId === db.id ? 'selected' : ''}"
           onclick="selectDatasource('${db.id}', '${escapeHTML(db.name)}')">
        <span class="badge badge-${db.type}" style="margin-right:8px">${db.type.toUpperCase()}</span>
        <strong>${escapeHTML(db.name)}</strong>
        <span style="color:var(--text-muted);margin-left:8px">${db.host ? db.host + ':' + db.port : ''} / ${escapeHTML(db.database)}</span>
      </div>
    `).join('');
  } catch (e) {
    showToast('加载数据源失败', 'error');
  }
}

function selectDatasource(id) {
  state.selectedDatasourceId = id;
  state.selectedDatabase = null;
  state.selectedTable = null;
  goToStep(2);
}

async function loadDatabases() {
  const container = document.getElementById('databaseSelectList');
  container.innerHTML = '<div class="loading-overlay"><span class="spinner"></span> 加载数据库列表...</div>';

  try {
    const res = await API.get(`/api/database/${state.selectedDatasourceId}/databases`);
    if (!res.success || !res.data.length) {
      container.innerHTML = '<div class="empty-state"><p>未找到数据库</p></div>';
      return;
    }

    container.innerHTML = res.data.map(db => `
      <div class="select-list-item" onclick="selectDatabase('${escapeHTML(db)}')">${escapeHTML(db)}</div>
    `).join('');
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p>加载失败: ${escapeHTML(e.message)}</p></div>`;
  }
}

async function selectDatabase(dbName) {
  state.selectedDatabase = dbName;
  try {
    const res = await API.post(`/api/database/${state.selectedDatasourceId}/switch-database`, { database: dbName });
    if (res.success) state.selectedDatasourceId = res.data.id;
  } catch (e) { /* ignore */ }
  goToStep(3);
}

async function loadTables() {
  const container = document.getElementById('tableSelectList');
  container.innerHTML = '<div class="loading-overlay"><span class="spinner"></span> 加载表列表...</div>';

  try {
    const res = await API.get(`/api/database/${state.selectedDatasourceId}/tables`);
    if (!res.success || !res.data.length) {
      container.innerHTML = '<div class="empty-state"><p>该数据库中没有表</p></div>';
      return;
    }

    container.innerHTML = res.data.map(table => `
      <div class="select-list-item" onclick="selectTable('${escapeHTML(table)}')">${escapeHTML(table)}</div>
    `).join('');
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p>加载失败: ${escapeHTML(e.message)}</p></div>`;
  }
}

async function selectTable(tableName) {
  state.selectedTable = tableName;
  try {
    const res = await API.get(`/api/database/${state.selectedDatasourceId}/tables/${tableName}`);
    if (res.success) {
      state.tableInfo = res.data;
      renderFieldsTable();
      goToStep(4);
    } else {
      showToast('加载表结构失败: ' + res.message, 'error');
    }
  } catch (e) {
    showToast('加载表结构失败: ' + e.message, 'error');
  }
}

// ============ 字段编辑 + 拖拽排序 ============
let dragSrcIndex = null;

function renderFieldsTable() {
  const tbody = document.getElementById('fieldsTableBody');
  const info = state.tableInfo;
  if (!info || !info.columns) return;

  document.getElementById('editTableTitle').textContent =
    `编辑字段 - ${info.name}${info.comment ? ' (' + info.comment + ')' : ''}`;

  tbody.innerHTML = info.columns.map((col, idx) => `
    <tr data-index="${idx}" draggable="true">
      <td>
        <div class="checkbox-wrapper">
          <input type="checkbox" ${col.isSelected ? 'checked' : ''}
                 onchange="updateField(${idx}, 'isSelected', this.checked)" />
        </div>
      </td>
      <td>
        <span class="drag-handle" title="拖拽排序">☰</span>
      </td>
      <td>
        <input type="text" class="editable-input" value="${escapeHTML(col.name)}"
               onchange="updateField(${idx}, 'name', this.value)" />
      </td>
      <td style="color:var(--text-muted)">${escapeHTML(col.originalName)}</td>
      <td><span class="badge badge-mysql">${escapeHTML(col.dataType)}</span></td>
      <td>
        <input type="text" class="editable-input" value="${escapeHTML(col.comment)}"
               onchange="updateField(${idx}, 'comment', this.value)" />
      </td>
      <td style="color:${col.isNullable ? 'var(--accent-success)' : 'var(--text-muted)'}">
        ${col.isNullable ? '是' : '否'}
      </td>
      <td style="color:var(--text-muted)">${col.defaultValue != null ? escapeHTML(String(col.defaultValue)) : '-'}</td>
    </tr>
  `).join('');

  initDragAndDrop();
}

function initDragAndDrop() {
  const tbody = document.getElementById('fieldsTableBody');
  if (!tbody) return;

  const rows = tbody.querySelectorAll('tr[draggable]');
  rows.forEach(row => {
    row.addEventListener('dragstart', handleDragStart);
    row.addEventListener('dragover', handleDragOver);
    row.addEventListener('dragenter', handleDragEnter);
    row.addEventListener('dragleave', handleDragLeave);
    row.addEventListener('drop', handleDrop);
    row.addEventListener('dragend', handleDragEnd);
  });
}

function handleDragStart(e) {
  dragSrcIndex = parseInt(this.dataset.index);
  this.style.opacity = '0.4';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragSrcIndex);
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
  e.preventDefault();
  this.classList.add('drag-over');
}

function handleDragLeave() {
  this.classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  this.classList.remove('drag-over');

  const targetIndex = parseInt(this.dataset.index);
  if (dragSrcIndex === null || dragSrcIndex === targetIndex) return;

  // 重新排列数组
  const columns = state.tableInfo.columns;
  const [moved] = columns.splice(dragSrcIndex, 1);
  columns.splice(targetIndex, 0, moved);

  // 更新所有 order 值
  columns.forEach((col, i) => { col.order = i; });

  // 重新渲染
  renderFieldsTable();
}

function handleDragEnd() {
  this.style.opacity = '1';
  document.querySelectorAll('#fieldsTableBody tr').forEach(row => {
    row.classList.remove('drag-over');
  });
  dragSrcIndex = null;
}

function updateField(index, key, value) {
  if (state.tableInfo && state.tableInfo.columns[index]) {
    state.tableInfo.columns[index][key] = value;
  }
}

// ============ 代码预览 & 下载 ============
async function previewCode() {
  const container = document.getElementById('codePreview');
  container.innerHTML = '<div class="loading-overlay"><span class="spinner"></span> 生成代码中...</div>';

  try {
    const payload = { ...state.tableInfo };
    if (state.selectedGenGroupId) {
      payload.groupId = Number(state.selectedGenGroupId);
    }

    const res = await API.post('/api/generator/preview', payload);
    if (!res.success) {
      container.innerHTML = `<div class="empty-state"><p>生成失败: ${escapeHTML(res.message)}</p></div>`;
      return;
    }

    const files = res.data;
    const fileNames = Object.keys(files);
    if (fileNames.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>没有生成任何文件</p></div>';
      return;
    }

    let html = '<div class="code-preview-tabs">';
    fileNames.forEach((name, i) => {
      html += `<button class="code-preview-tab ${i === 0 ? 'active' : ''}"
                       onclick="switchCodeTab(this, '${escapeHTML(name)}')">${escapeHTML(name)}</button>`;
    });
    html += '</div>';

    fileNames.forEach((name, i) => {
      html += `<div class="code-preview-content" id="code-${CSS.escape(name)}" style="${i > 0 ? 'display:none' : ''}">
        <pre>${escapeHTML(files[name])}</pre>
      </div>`;
    });

    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p>生成失败: ${escapeHTML(e.message)}</p></div>`;
  }
}

function switchCodeTab(btn, fileName) {
  btn.parentElement.querySelectorAll('.code-preview-tab').forEach(el => el.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.code-preview-content').forEach(el => el.style.display = 'none');
  const target = document.getElementById(`code-${CSS.escape(fileName)}`);
  if (target) target.style.display = '';
}

async function downloadCode() {
  if (!state.tableInfo) {
    showToast('请先选择表', 'error');
    return;
  }

  try {
    const payload = { ...state.tableInfo };
    if (state.selectedGenGroupId) {
      payload.groupId = Number(state.selectedGenGroupId);
    }

    const res = await fetch('/api/generator/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // 检查 content-type 判断是否返回了错误 JSON
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || contentType.includes('application/json')) {
      const err = await res.json().catch(() => ({ message: '未知错误' }));
      showToast('下载失败: ' + (err.message || '未知错误'), 'error');
      return;
    }

    const blob = await res.blob();
    if (blob.size === 0) {
      showToast('下载失败: 文件为空', 'error');
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.tableInfo.name}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // 延迟释放 ObjectURL，确保浏览器有足够时间完成下载
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    showToast('代码已下载', 'success');
  } catch (e) {
    showToast('下载失败: ' + e.message, 'error');
  }
}

// ============ 页面初始化 ============
document.addEventListener('DOMContentLoaded', () => {
  refreshDatasourceList();
  loadGroups();
  loadTemplates();
  loadGroupsForGenerate();
});
