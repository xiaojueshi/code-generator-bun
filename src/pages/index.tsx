import { Html } from "@elysiajs/html";
import { Layout } from "./layout";

/** 主页面 - 包含所有标签页内容 */
export const IndexPage = () => (
  <Layout title="代码生成器">
    {/* ====== 代码生成标签页 ====== */}
    <div class="tab-content active" id="tab-generator">
      <div class="card">
        <div class="steps" id="genSteps">
          <div class="step active" data-step="1">
            <span class="step-number">1</span>
            <span>选择数据源</span>
          </div>
          <div class="step-divider"></div>
          <div class="step" data-step="2">
            <span class="step-number">2</span>
            <span>选择数据库</span>
          </div>
          <div class="step-divider"></div>
          <div class="step" data-step="3">
            <span class="step-number">3</span>
            <span>选择表</span>
          </div>
          <div class="step-divider"></div>
          <div class="step" data-step="4">
            <span class="step-number">4</span>
            <span>编辑字段</span>
          </div>
          <div class="step-divider"></div>
          <div class="step" data-step="5">
            <span class="step-number">5</span>
            <span>预览 & 下载</span>
          </div>
        </div>

        {/* 步骤1: 选择数据源 */}
        <div id="step-1" class="step-content">
          <div class="card-header">
            <span class="card-title">选择数据源</span>
            <button class="btn btn-secondary btn-sm" onclick="refreshDatasourceList()">刷新列表</button>
          </div>
          <div id="datasourceSelectList" class="select-list">
            <div class="empty-state">
              <div class="icon">🗄️</div>
              <p>暂无数据源，请先在「数据源管理」中添加</p>
            </div>
          </div>
        </div>

        {/* 步骤2: 选择数据库 */}
        <div id="step-2" class="step-content hidden">
          <div class="card-header">
            <span class="card-title">选择数据库</span>
            <button class="btn btn-secondary btn-sm" onclick="goToStep(1)">← 返回</button>
          </div>
          <div style="margin-bottom: 15px;">
             <input type="text" class="form-input" id="searchDatabaseInput" placeholder="输入关键字搜索数据库..." oninput="filterList('databaseSelectList', this.value)" />
          </div>
          <div id="databaseSelectList" class="select-list">
            <div class="loading-overlay"><span class="spinner"></span> 加载中...</div>
          </div>
        </div>

        {/* 步骤3: 选择表 */}
        <div id="step-3" class="step-content hidden">
          <div class="card-header">
            <span class="card-title">选择表</span>
            <button class="btn btn-secondary btn-sm" onclick="goToStep(2)">← 返回</button>
          </div>
          <div style="margin-bottom: 15px;">
             <input type="text" class="form-input" id="searchTableInput" placeholder="输入关键字搜索表..." oninput="filterList('tableSelectList', this.value)" />
          </div>
          <div id="tableSelectList" class="select-list">
            <div class="loading-overlay"><span class="spinner"></span> 加载中...</div>
          </div>
        </div>

        {/* 步骤4: 编辑字段 */}
        <div id="step-4" class="step-content hidden">
          <div class="card-header">
            <span class="card-title" id="editTableTitle">编辑字段</span>
            <div class="btn-group">
              <button class="btn btn-secondary btn-sm" onclick="goToStep(3)">← 返回</button>
              <button class="btn btn-primary btn-sm" onclick="goToStep(5)">预览代码 →</button>
            </div>
          </div>
          <div style="overflow-x: auto;">
            <table class="data-table" id="fieldsTable">
              <thead>
                <tr>
                  <th style="width: 50px;">选择</th>
                  <th style="width: 50px;">排序</th>
                  <th>字段名</th>
                  <th>原始名称</th>
                  <th>数据类型</th>
                  <th>注释</th>
                  <th>可空</th>
                  <th>默认值</th>
                </tr>
              </thead>
              <tbody id="fieldsTableBody">
              </tbody>
            </table>
          </div>
        </div>

        {/* 步骤5: 预览 & 下载 */}
        <div id="step-5" class="step-content hidden">
          <div class="card-header">
            <span class="card-title">预览生成代码</span>
            <div class="btn-group">
              <button class="btn btn-secondary btn-sm" onclick="goToStep(4)">← 返回</button>
              <select class="form-select" id="genGroupSelect" style="width:auto;display:inline-block;min-width:150px;" onchange="onGenGroupChange()">
                <option value="">全部模板</option>
              </select>
              <button class="btn btn-success btn-sm" onclick="downloadCode()">📦 下载 ZIP</button>
            </div>
          </div>
          <div id="codePreview">
            <div class="loading-overlay"><span class="spinner"></span> 生成中...</div>
          </div>
        </div>
      </div>
    </div>

    {/* ====== 数据源管理标签页 ====== */}
    <div class="tab-content" id="tab-datasource">
      <div class="card">
        <div class="card-header">
          <span class="card-title">数据源管理</span>
          <button class="btn btn-primary btn-sm" onclick="showAddDatasourceModal()">+ 添加数据源</button>
        </div>
        <div id="datasourceList">
          <div class="empty-state">
            <div class="icon">🗄️</div>
            <p>暂无数据源，点击上方按钮添加</p>
          </div>
        </div>
      </div>
    </div>

    {/* ====== 模板管理标签页 ====== */}
    <div class="tab-content" id="tab-templates">
      <div class="card">
        <div class="card-header">
          <span class="card-title">模板管理</span>
          <div class="btn-group">
            <button class="btn btn-secondary btn-sm" onclick="showAddGroupModal()">+ 新建分组</button>
            <button class="btn btn-primary btn-sm" onclick="showAddTemplateModal()">+ 新建模板</button>
            <button class="btn btn-danger btn-sm" onclick="resetTemplates()">重置为默认</button>
          </div>
        </div>

        {/* 分组标签 */}
        <div class="nav-tabs" id="groupTabs" style="margin-bottom: 16px;">
          <button class="nav-tab active" data-group-id="" onclick="switchGroupTab('')">全部</button>
        </div>

        <div id="templateList">
          <div class="empty-state">
            <div class="icon">📝</div>
            <p>加载中...</p>
          </div>
        </div>
      </div>
    </div>

    {/* ====== 添加数据源弹窗 ====== */}
    <div class="modal-overlay hidden" id="addDatasourceModal">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">添加数据源</span>
          <button class="modal-close" onclick="hideModal('addDatasourceModal')">×</button>
        </div>
        <form id="datasourceForm" onsubmit="return false;">
          <div class="form-group">
            <label class="form-label">数据源名称</label>
            <input class="form-input" name="name" placeholder="如：本地 MySQL" required />
          </div>
          <div class="form-group">
            <label class="form-label">数据库类型</label>
            <select class="form-select" name="type" required onchange="onDbTypeChange(this.value)">
              <option value="mysql">MySQL</option>
              <option value="postgres">PostgreSQL</option>
              <option value="sqlite">SQLite</option>
              <option value="dmdb">达梦8 (DM8)</option>
            </select>
          </div>
          <div id="serverDbFields">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">主机</label>
                <input class="form-input" name="host" placeholder="localhost" value="localhost" />
              </div>
              <div class="form-group">
                <label class="form-label">端口</label>
                <input class="form-input" name="port" type="number" placeholder="3306" value="3306" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">用户名</label>
                <input class="form-input" name="user" placeholder="root" value="root" />
              </div>
              <div class="form-group">
                <label class="form-label">密码</label>
                <input class="form-input" name="password" type="password" placeholder="密码" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">数据库名</label>
              <input class="form-input" name="database" placeholder="mydb" required />
            </div>
          </div>
          <div id="sqliteDbFields" class="hidden">
            <div class="form-group">
              <label class="form-label">数据库文件路径</label>
              <input class="form-input" name="filename" placeholder="./data.db" />
            </div>
            <div class="form-group">
              <label class="form-label">数据库名称标识</label>
              <input class="form-input" name="sqliteDbName" placeholder="mydb" />
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="hideModal('addDatasourceModal')">取消</button>
            <button type="button" class="btn btn-primary" onclick="addDatasource()" id="addDatasourceBtn">测试并保存</button>
          </div>
        </form>
      </div>
    </div>

    {/* ====== 模板编辑弹窗 ====== */}
    <div class="modal-overlay hidden" id="templateModal">
      <div class="modal" style="max-width: 900px;">
        <div class="modal-header">
          <span class="modal-title" id="templateModalTitle">编辑模板</span>
          <button class="modal-close" onclick="hideModal('templateModal')">×</button>
        </div>
        <form id="templateForm" onsubmit="return false;">
          <input type="hidden" name="templateId" />
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">模板名称</label>
              <input class="form-input" name="templateName" placeholder="如：index" required />
            </div>
            <div class="form-group">
              <label class="form-label">输出文件名</label>
              <input class="form-input" name="templateFilename" placeholder="如：index.vue" required />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">所属分组</label>
            <select class="form-select" name="templateGroupId" id="templateGroupSelect">
              <option value="">未分组</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">模板内容 (Handlebars)</label>
            <textarea class="form-textarea" name="templateContent" style="min-height: 400px;" placeholder="输入 Handlebars 模板内容..."></textarea>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="hideModal('templateModal')">取消</button>
            <button type="button" class="btn btn-primary" onclick="saveTemplate()" id="saveTemplateBtn">保存</button>
          </div>
        </form>
      </div>
    </div>

    {/* ====== 分组弹窗 ====== */}
    <div class="modal-overlay hidden" id="groupModal">
      <div class="modal" style="max-width: 500px;">
        <div class="modal-header">
          <span class="modal-title" id="groupModalTitle">新建分组</span>
          <button class="modal-close" onclick="hideModal('groupModal')">×</button>
        </div>
        <form id="groupForm" onsubmit="return false;">
          <input type="hidden" name="groupId" />
          <div class="form-group">
            <label class="form-label">分组名称</label>
            <input class="form-input" name="groupName" placeholder="如：Vue3 项目" required />
          </div>
          <div class="form-group">
            <label class="form-label">分组描述（可选）</label>
            <input class="form-input" name="groupDescription" placeholder="描述..." />
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="hideModal('groupModal')">取消</button>
            <button type="button" class="btn btn-primary" onclick="saveGroup()">保存</button>
          </div>
        </form>
      </div>
    </div>

    {/* ====== 自定义 Confirm 弹窗 ====== */}
    <div class="modal-overlay hidden" id="customConfirmModal" style="z-index: 10000;">
      <div class="modal" style="max-width: 400px; padding: 20px;">
        <div class="modal-header" style="border-bottom: none; padding-bottom: 5px;">
          <span class="modal-title" style="font-size: 18px;">确认操作</span>
        </div>
        <div style="padding: 10px 0 25px 0;" id="customConfirmMessage">
          确定执行此操作吗？
        </div>
        <div class="modal-footer" style="border-top: none; padding-top: 0;">
          <button type="button" class="btn btn-secondary" id="customConfirmCancelBtn">取消</button>
          <button type="button" class="btn btn-danger" id="customConfirmOkBtn">确定</button>
        </div>
      </div>
    </div>
  </Layout>
);
