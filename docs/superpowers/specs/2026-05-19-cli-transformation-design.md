# CLI 转换设计文档

## 概述

将 code-generator 从纯 Web 应用改造为同时支持 CLI 和 Web 的双模二进制文件。保留 Web UI 不变，新增 CLI 子命令供 AI Agent 调用。

## 核心原则

1. **零依赖新增** — 只用 Bun 原生能力，不引入 `commander`、`chalk` 等外部库
2. **最小侵入** — 不改动现有路由/页面/数据库层代码
3. **向后兼容** — 无参数启动行为不变（启动 Web 服务器）
4. **模块复用** — CLI 直接调用现有的 `databaseConnector`、`generateFiles`、`renderTemplate`

## 架构

### 分支逻辑（src/index.ts 最顶部）

```
Bun.argv 检测
  ├── 有 CLI 子命令 (list|table|generate) → 导入 CLI 模块 → 执行 → process.exit(0)
  └── 无参数或 serve → 执行原有初始化 + 启动 Web 服务器
```

### CLI 子命令

| 命令 | 功能 |
|------|------|
| `list datasources` | 列出所有已配置的数据源 |
| `list templates` | 列出所有模板（含分组） |
| `table info <数据源> <表>` | 获取表结构（JSON 输出） |
| `generate <数据源> <表> [选项]` | 生成代码并写入文件 |

### generate 命令选项

| 选项 | 说明 |
|------|------|
| `--template-group <name>` | 按模板组名筛选 |
| `--template <name>` | 按模板名称筛选单个 |
| `--columns <col1,col2,...>` | 只生成指定列 |
| `--output <dir>` | 输出目录（默认 `./<表名>-code/`）|

### generate 执行流程

```
1. 根据名称在 data.sqlite 中查找数据源配置
2. 建立短连接 → 获取表结构 (getTableInfo)
3. 读取模板（可选按分组/名称筛选）
4. 调用 generateFiles() 渲染所有模板
5. 创建输出目录 → Bun.write() 写入每个文件
6. stdout 打印结果清单
```

## 文件变更

### 新增（5 个）
- `src/cli/index.ts` — 命令分发入口
- `src/cli/list.ts` — list 子命令
- `src/cli/table.ts` — table info 子命令
- `src/cli/generate.ts` — generate 子命令
- `src/cli/SKILL.md` — Agent Skill 文档

### 修改（2 个）
- `src/index.ts` — CLI 检测分支
- `src/assets.d.ts` — 添加 `*.md` 文本导入声明

### 不变
- `src/routes/`、`src/pages/`、`src/public/`、`src/database/`、
  `src/utils/`、`src/types/`、`src/templates/` — 完全不变

## Agent 工作流

```
User: "帮我生成用户管理模块代码"
Agent → User: "用哪个数据源？" (或先 list datasources)
Agent → User: "用哪个模板组？" (或先 list templates)
Agent → CLI: generate <ds> <table> --template-group "Vue3 管理端" --output ./temp-gen/
Agent → Read: 读取生成的所有文件
Agent → Analyze: 理解代码结构和业务语义
Agent → Write: 根据业务需求调整优化后写入项目
```

## 构建

现有 `bun build ./src/index.ts --compile` 不变，编译结果同时包含 CLI 和 Web。
