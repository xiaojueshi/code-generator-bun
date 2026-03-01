import { Elysia, t } from "elysia";
import { localDatabase } from "../database/local";
import { initDefaultTemplates } from "../utils/template";

/** 模板管理路由 */
export const templateRoutes = new Elysia({ prefix: "/api/template" })

  // ========== 分组路由 ==========

  // 获取所有分组
  .get("/groups", async () => {
    try {
      const groups = await localDatabase.getAllGroups();
      return { success: true, data: groups };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  })

  // 创建分组
  .post(
    "/group/create",
    async ({ body }) => {
      try {
        const id = await localDatabase.createGroup(body.name, body.description);
        return { success: true, data: { id, name: body.name } };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        description: t.Optional(t.String()),
      }),
    }
  )

  // 更新分组
  .put(
    "/group/:id",
    async ({ params: { id }, body }) => {
      try {
        await localDatabase.updateGroup(Number(id), body);
        return { success: true, message: "分组更新成功" };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
      }),
    }
  )

  // 删除分组（组内模板将变为未分组）
  .delete("/group/:id", async ({ params: { id } }) => {
    try {
      const success = await localDatabase.deleteGroup(Number(id));
      if (!success) return { success: false, message: "分组不存在" };
      return { success: true, message: "分组已删除，原分组内的模板已移至未分组" };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  })

  // ========== 模板路由 ==========

  // 获取所有模板列表（可按分组筛选）
  .get("/list", async ({ query }) => {
    try {
      const groupId = query.groupId ? Number(query.groupId) : undefined;
      const templates = await localDatabase.getAllTemplates(groupId);
      return {
        success: true,
        data: templates.map(({ content, ...rest }) => rest),
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  })

  // 获取单个模板详情（含内容）
  .get("/:id", async ({ params: { id } }) => {
    try {
      const template = await localDatabase.getTemplate(Number(id));
      if (!template) return { success: false, message: "模板不存在" };
      return { success: true, data: template };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  })

  // 创建新模板
  .post(
    "/create",
    async ({ body }) => {
      try {
        await localDatabase.saveTemplate({
          name: body.name,
          filename: body.filename,
          content: body.content,
          groupId: body.groupId,
        });
        return { success: true, message: "模板创建成功" };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        filename: t.String({ minLength: 1 }),
        content: t.String(),
        groupId: t.Optional(t.Number()),
      }),
    }
  )

  // 更新模板
  .put(
    "/:id",
    async ({ params: { id }, body }) => {
      try {
        await localDatabase.updateTemplate(Number(id), body);
        return { success: true, message: "模板更新成功" };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        filename: t.Optional(t.String()),
        content: t.Optional(t.String()),
        groupId: t.Optional(t.Number()),
      }),
    }
  )

  // 删除模板
  .delete("/:id", async ({ params: { id } }) => {
    try {
      const success = await localDatabase.deleteTemplate(Number(id));
      if (!success) return { success: false, message: "模板不存在" };
      return { success: true, message: "模板删除成功" };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  })

  // 重置为默认模板
  .post("/reset", async () => {
    try {
      await initDefaultTemplates(true);
      return { success: true, message: "已重置为默认模板" };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  });
