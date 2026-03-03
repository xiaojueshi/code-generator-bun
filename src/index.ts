import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { html } from "@elysiajs/html";

import { databaseRoutes } from "./routes/database";
import { generatorRoutes } from "./routes/generator";
import { templateRoutes } from "./routes/template";
import { localDatabase } from "./database/local";
import { databaseConnector } from "./database/connector";
import { initDefaultTemplates } from "./utils/template";
import { IndexPage } from "./pages/index";

// 静态文件导入以供二进制打包
import appJs from "./public/app.js" with { type: "text" };
import styleCss from "./public/style.css" with { type: "text" };

// 初始化
const init = async () => {
  console.log("🔧 初始化本地数据库...");
  await localDatabase.init();

  console.log("📂 加载已保存的数据源配置...");
  await databaseConnector.loadSavedConnections();

  console.log("📝 初始化默认模板...");
  await initDefaultTemplates();
};

await init();

// 创建应用
const app = new Elysia()
  .use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length", "Content-Disposition"],
  }))
  .use(html())
  // 页面路由
  .get("/", () => IndexPage())
  // 内存路由，用于静态打包
  .get("/public/app.js", () => new Response(appJs, { headers: { "Content-Type": "application/javascript; charset=utf-8" } }))
  .get("/public/style.css", () => new Response(styleCss, { headers: { "Content-Type": "text/css; charset=utf-8" } }))
  // API 路由
  .use(databaseRoutes)
  .use(generatorRoutes)
  .use(templateRoutes)
  .listen(3000);

console.log(`🦊 代码生成器运行在 http://${app.server?.hostname}:${app.server?.port}`);
