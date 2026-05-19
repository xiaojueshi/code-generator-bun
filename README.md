# 代码生成器

基于 **Bun + ElysiaJS** 的代码生成工具，同时提供 **Web 界面** 和 **CLI 命令行** 两种模式。

- **Web 模式**：通过浏览器可视化操作，管理数据源和模板，生成代码并下载 ZIP
- **CLI 模式**：供 AI Agent（如 opencode、Claude Code）调用，读取表结构，生成代码文件到磁盘

核心能力：逆向工程连接现有数据库，读取表结构，使用 Handlebars 模板自动生成 Vue 3 + TDesign CRUD 代码。

## 功能特性

### 数据库逆向工程
- 支持 **MySQL / PostgreSQL / SQLite / 达梦 8 (DMDB)** 四种数据库
- 自动读取表列表、字段名、数据类型、注释、可空性、默认值
- 达梦数据库：通过 `DBA_OBJECTS` + `DBA_USERS` 联合查询补齐纯 schema
- 短连接模式，用完即关，避免连接泄漏

### 代码生成
- 基于 Handlebars 模板引擎，用户可自定义模板
- 默认提供 6 个 Vue 3 + TDesign 模板（index.vue、api.ts、request.ts、constants.ts、type.ts、useListState.ts）
- 支持模板分组管理（如 "Vue3 项目"、"React 项目"）
- 支持代码预览和 ZIP 打包下载

### 5 步生成向导
| 步骤 | 操作 |
|------|------|
| 1 | 选择已保存的数据源 |
| 2 | 选择数据库 / Schema |
| 3 | 选择数据表（支持搜索过滤） |
| 4 | 编辑字段（勾选、重命名、注释、拖拽排序） |
| 5 | 预览生成的代码文件，下载 ZIP |

### 数据源管理
- 添加 / 删除数据库连接
- 连接配置持久化到本地 SQLite
- 重启后自动恢复已保存的连接

### 模板管理
- 模板 CRUD（创建、编辑、删除）
- 分组管理（新建、重命名、删除）
- 分组过滤筛选
- 一键重置为默认模板

## 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 运行时 | [Bun](https://bun.sh) | JavaScript/TypeScript 运行时，内置 SQL 客户端和打包器 |
| Web 框架 | [ElysiaJS](https://elysiajs.com) | HTTP 框架，内建参数验证 |
| 服务端渲染 | [@kitajs/html](https://github.com/kitajs/html) + TSX | 服务端 JSX 渲染 HTML |
| 模板引擎 | [Handlebars](https://handlebarsjs.com) v4.7.8 | 代码生成模板渲染 |
| 数据库 ORM | Bun 原生 `SQL` 模块 | MySQL / PostgreSQL / SQLite 连接 |
| 达梦驱动 | `dmdb` v1.0.46190 | 达梦 8 原生 Node.js 驱动 |
| ZIP 生成 | [JSZip](https://stuk.github.io/jszip) v3.10.1 | 代码文件打包 |
| 前端 | 原生 JavaScript + CSS | 深色玻璃态主题，无前端框架依赖 |
| 本地存储 | SQLite（Bun SQL） | 连接配置、模板数据持久化 |

## 快速开始

```bash
# 安装依赖
bun install

# 启动开发服务器（热更新）
bun run dev

# 访问
open http://localhost:3000
```

## 构建部署

Bun 支持将整个应用编译为单文件原生二进制，无需 Node.js 运行时。编译后的二进制同时包含 Web 服务和 CLI 两种模式。

```bash
# 构建所有平台
bun run build

# 构建指定平台
bun run build:win       # Windows x64
bun run build:linux     # Linux x64
bun run build:mac       # macOS ARM64 (Apple Silicon)
bun run build:mac-x64   # macOS x64 (Intel)
```

编译产物输出到 `dist/` 目录，完全自包含（静态资源、模板、CLI 逻辑均嵌入二进制）。

### 运行模式

```bash
# Web 模式（无参数启动）
./dist/code_generator-darwin-arm64        # 启动 Web 服务，监听 3000 端口

# CLI 模式（带子命令）
./dist/code_generator-darwin-arm64 list datasources
./dist/code_generator-darwin-arm64 generate 生产库 sys_user -o ./output/
```

## 使用指南

### 添加数据源
1. 切换到「数据源管理」标签页
2. 点击「添加数据源」，选择数据库类型
3. 填写连接信息后点击「测试并保存」

### 生成代码
1. 切换到「代码生成器」标签页
2. 步骤 1：选择数据源
3. 步骤 2：选择数据库
4. 步骤 3：选择数据表
5. 步骤 4：编辑字段——可重命名、修改注释、勾选是否生成、拖拽排序
6. 步骤 5：选择模板分组，预览代码，点击下载 ZIP

### 管理模板
- 模板使用 Handlebars 语法，变量上下文见「模板变量」章节
- 支持 `{{#raw}}...{{/raw}}` 标签避免 Vue 双花括号语法冲突
- 点击「重置为默认」恢复出厂模板

## CLI 模式

编译后的二进制文件根据启动参数自动切换模式——无参数启动 Web 服务，有子命令时进入 CLI 模式。

### 命令参考

```
code-generator <命令> [选项]
```

| 命令 | 功能 |
|------|------|
| `list datasources` | 列出所有已配置的数据源 |
| `list templates` | 列出所有模板（按分组展示） |
| `list tables <数据源>` | 列出数据源下的所有表 |
| `table info <数据源> <表>` | 获取表结构（JSON 输出） |
| `generate <数据源> <表>` | 生成代码文件到磁盘 |

### 生成代码

```bash
# 基本用法
code-generator generate 生产库 sys_user

# 指定模板分组和输出目录
code-generator generate 生产库 sys_user \
  --template-group "Vue3 管理端" \
  --output ./my-module/

# 指定单个模板 + 只生成部分列
code-generator generate 生产库 sys_user \
  --template type \
  --columns id,username,email \
  -o ./types/
```

| 生成选项 | 说明 |
|----------|------|
| `--template-group <名称>` | 按模板组名筛选 |
| `--template <名称>` | 按模板名称筛选单个 |
| `--columns <列1,列2,...>` | 只生成指定列 |
| `--output <目录>`, `-o <目录>` | 输出目录（默认 `./<表名>-code/`） |

### Agent 集成

Agent 可直接调用上述 CLI 命令完成代码生成工作流：确认数据源 → 确认模板 → 生成代码 → 读取分析 → 业务调整 → 写入项目。

## 数据库支持

| 类型 | 驱动 | 默认端口 | 元数据查询 |
|------|------|----------|------------|
| MySQL | Bun SQL（adapter: mysql） | 3306 | `information_schema.tables` / `information_schema.columns` |
| PostgreSQL | Bun SQL（adapter: postgres） | 5432 | `information_schema.tables` / `pg_catalog.pg_attribute` + `pg_type` |
| SQLite | Bun SQL（adapter: sqlite） | 文件路径 | `sqlite_master` / `PRAGMA table_info` |
| 达梦 8 | `dmdb` npm 包 | 5236 | `all_tables` / `all_tab_columns` / `dba_objects` / `dba_users` |

### 达梦数据库说明
- 连接参数中 `user` 为登录用户，`database` 为查询目标 Schema
- 数据库列表通过 `DBA_OBJECTS`（对象所有者）和 `DBA_USERS`（用户账号）联合查询，覆盖纯 schema 和有用户无表的场景
- 超时时间：连接 10 秒，查询 30 秒

## 模板系统

### 模板变量

```typescript
{
  tableName: string;       // 表名（如 "sys_user"）
  tableComment: string;    // 表注释（如 "系统用户表"）
  fieldsList: Array<{      // 字段列表
    name: string;          // 字段名（可编辑）
    originalName: string;  // 数据库原始字段名
    dataType: string;      // 数据类型
    comment: string;       // 字段注释
    isNullable: boolean;   // 是否可为空
    defaultValue: any;     // 默认值
    isSelected: boolean;   // 是否选中生成
    order: number;         // 排序索引
  }>;
}
```

### 默认模板

| 模板名 | 输出文件 | 说明 |
|--------|----------|------|
| index | `index.vue` | Vue 3 单文件组件：表格、搜索栏、CRUD 按钮、分页、抽屉表单 |
| request | `request.ts` | DataService 类，封装 CRUD API 调用 |
| api | `api.ts` | 接口地址常量与 API 函数 |
| constants | `constants.ts` | 表格列配置、默认分页与表单数据 |
| type | `type.ts` | TypeScript 接口定义 |
| useListState | `useListState.ts` | Vue 3 Composition API 状态管理 Hook |

## 项目结构

```
code_generator_bun/
├── src/
│   ├── index.ts                 # 入口：CLI 检测 + 初始化 + 路由注册 + 启动服务
│   ├── cli/                     # CLI 命令行模块
│   │   ├── index.ts             #   命令分发器
│   │   ├── list.ts              #   list 子命令
│   │   ├── table.ts             #   table info 子命令
│   │   └── generate.ts          #   generate 子命令
│   ├── types/index.ts           # 共享 TypeScript 类型
│   ├── database/
│   │   ├── local.ts             # 本地 SQLite 持久化（连接配置、模板）
│   │   └── connector.ts         # 远程数据库连接管理器
│   ├── routes/
│   │   ├── database.ts          # /api/database/* 数据源路由
│   │   ├── generator.ts         # /api/generator/* 代码生成路由
│   │   └── template.ts          # /api/template/* 模板管理路由
│   ├── pages/
│   │   ├── layout.tsx           # HTML 布局（页眉、导航标签）
│   │   └── index.tsx            # 完整 SPA 页面（所有标签页、弹窗）
│   ├── public/
│   │   ├── app.js               # 前端交互逻辑
│   │   └── style.css            # 深色玻璃态主题
│   ├── templates/               # 默认 Handlebars 模板（6 个 .hbs 文件）
│   └── utils/
│       ├── stringUtils.ts       # 字符串清理工具
│       └── template.ts          # Handlebars 编译与代码生成
├── data.sqlite                  # 运行时数据库（已 gitignore）
├── dist/                        # 编译产物（已 gitignore）
├── package.json
├── tsconfig.json
└── docs/superpowers/specs/      # 设计文档
```

## 架构概览

### Web 模式

```
浏览器                    Bun + Elysia 服务器
  │                             │
  │  GET /                       │  服务端渲染 HTML（TSX → HTML）
  │  POST /api/database/connect  │  连接远程数据库
  │  GET /api/database/:id/      │  获取库/表/字段元数据
  │      (databases|tables)      │
  │  POST /api/generator/preview │  Handlebars 渲染 → JSON
  │  POST /api/generator/generate│  Handlebars 渲染 → ZIP
  │  CRUD /api/template/*        │  模板和分组管理
```

### CLI 模式

```
AI Agent ──→ code-generator generate <ds> <table> ──→ data.sqlite（查找连接配置）
                                                          │
                                                          ↓
                                                    远程数据库（获取表结构）
                                                          │
                                                          ↓
                                                    Handlebars 渲染
                                                          │
                                                          ↓
                                                    写入磁盘文件 ←── Agent 读取 → 业务调整 → 写入项目
```

## 开发

```bash
bun run dev    # 热更新开发
```

## 构建

```bash
bun run build  # 编译为原生二进制
```

## 许可证

MIT
