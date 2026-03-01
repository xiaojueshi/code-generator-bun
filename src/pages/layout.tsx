import { Html } from "@elysiajs/html";

/** 公共页面布局 */
export const Layout = ({ children, title }: { children: any; title?: string }) => (
  <html lang="zh-CN">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title || "代码生成器"}</title>
      <meta name="description" content="基于数据库表结构的代码生成工具" />
      <link rel="stylesheet" href="/public/style.css" />
    </head>
    <body>
      <div class="app-container">
        <header class="app-header">
          <div>
            <h1>⚡ 代码生成器</h1>
            <div class="subtitle">基于数据库表结构 · Bun + ElysiaJS</div>
          </div>
        </header>

        <nav class="nav-tabs" id="navTabs">
          <button class="nav-tab active" data-tab="generator" onclick="switchTab('generator')">🚀 代码生成</button>
          <button class="nav-tab" data-tab="datasource" onclick="switchTab('datasource')">🗄️ 数据源管理</button>
          <button class="nav-tab" data-tab="templates" onclick="switchTab('templates')">📝 模板管理</button>
        </nav>

        {children}

        <div class="toast-container" id="toastContainer"></div>
      </div>

      <script src="/public/app.js"></script>
    </body>
  </html>
);
