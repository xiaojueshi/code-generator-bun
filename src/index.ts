import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { staticPlugin } from "@elysiajs/static";
import { html } from "@elysiajs/html";

import { databaseRoutes } from "./routes/database";
import { generatorRoutes } from "./routes/generator";
import { templateRoutes } from "./routes/template";
import { localDatabase } from "./database/local";
import { databaseConnector } from "./database/connector";
import { initDefaultTemplates } from "./utils/template";
import { IndexPage } from "./pages/index";

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
  .use(staticPlugin({
    prefix: "/public",
    assets: "src/public",
  }))
  // 页面路由
  .get("/", () => IndexPage())
  // API 路由
  .use(databaseRoutes)
  .use(generatorRoutes)
  .use(templateRoutes)
  .listen(3000);

console.log(`🦊 代码生成器运行在 http://${app.server?.hostname}:${app.server?.port}`);
