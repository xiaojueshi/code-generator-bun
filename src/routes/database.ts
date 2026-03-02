import { Elysia, t } from "elysia";
import { databaseConnector } from "../database/connector";
import type { DatabaseConfig, DatabaseType } from "../types";

/** 数据源管理路由 */
export const databaseRoutes = new Elysia({ prefix: "/api/database" })
  // 添加数据源连接
  .post(
    "/connect",
    async ({ body }) => {
      try {
        const id = `${body.type}-${Date.now()}`;
        const config: DatabaseConfig = {
          id,
          type: body.type as DatabaseType,
          name: body.name,
          host: body.host,
          port: body.port,
          user: body.user,
          password: body.password,
          database: body.database,
          filename: body.filename,
        };

        await databaseConnector.connect(config);
        return { success: true, data: { id, name: config.name, type: config.type } };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },
    {
      body: t.Object({
        type: t.Union([t.Literal("mysql"), t.Literal("postgres"), t.Literal("sqlite"), t.Literal("dmdb")]),
        name: t.String({ minLength: 1 }),
        host: t.Optional(t.String()),
        port: t.Optional(t.Number()),
        user: t.Optional(t.String()),
        password: t.Optional(t.String()),
        database: t.String({ minLength: 1 }),
        filename: t.Optional(t.String()),
      }),
    }
  )

  // 删除数据源
  .delete("/disconnect/:id", async ({ params: { id } }) => {
    try {
      const success = await databaseConnector.disconnect(id);
      if (!success) return { success: false, message: "未找到该数据源" };
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  })

  // 获取已保存的数据源列表
  .get("/list", () => {
    const databases = databaseConnector.getConnectedDatabases();
    return {
      success: true,
      data: databases.map((db) => ({
        id: db.id,
        name: db.name,
        type: db.type,
        host: db.host,
        port: db.port,
        database: db.database,
      })),
    };
  })

  // 获取数据源下的数据库列表
  .get("/:id/databases", async ({ params: { id } }) => {
    try {
      const databases = await databaseConnector.listDatabases(id);
      return { success: true, data: databases };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  })

  // 获取表列表
  .get("/:id/tables", async ({ params: { id } }) => {
    try {
      const tables = await databaseConnector.listTables(id);
      return { success: true, data: tables };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  })

  // 获取表结构信息
  .get("/:id/tables/:table", async ({ params: { id, table } }) => {
    try {
      const tableInfo = await databaseConnector.getTableInfo(id, table);
      return { success: true, data: tableInfo };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  })

  // 切换数据库
  .post(
    "/:id/switch-database",
    async ({ params: { id }, body }) => {
      try {
        const config = databaseConnector.getDatabaseConfig(id);
        if (!config) return { success: false, message: "未找到数据源" };

        await databaseConnector.disconnect(id);

        const newConfig: DatabaseConfig = {
          ...config,
          id: `${config.type}-${Date.now()}`,
          database: body.database,
        };

        await databaseConnector.connect(newConfig);
        return {
          success: true,
          data: { id: newConfig.id, name: newConfig.name, type: newConfig.type },
        };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },
    {
      body: t.Object({
        database: t.String({ minLength: 1 }),
      }),
    }
  );
