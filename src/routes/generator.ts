import { Elysia, file, t } from "elysia";
import { databaseConnector } from "../database/connector";
import { generateZipFile, generateFiles, getSupportedTemplates } from "../utils/template";
import { cleanString } from "../utils/stringUtils";
import type { TableInfo } from "../types";
import { tmpdir } from "os";
import { join } from "path";
import { writeFile, unlink } from "fs/promises";

// 表信息验证 schema
const tableInfoSchema = t.Object({
  name: t.String({ minLength: 1 }),
  comment: t.Optional(t.String()),
  columns: t.Array(
    t.Object({
      name: t.String({ minLength: 1 }),
      originalName: t.String({ minLength: 1 }),
      dataType: t.String(),
      comment: t.String(),
      isNullable: t.Boolean(),
      defaultValue: t.Optional(t.Any()),
      isSelected: t.Boolean(),
      order: t.Number(),
    })
  ),
  groupId: t.Optional(t.Number()),
});

/** 验证表信息 */
const validateTableInfo = (tableInfo: TableInfo): void => {
  if (!tableInfo.name) throw new Error("表名不能为空");
  if (!tableInfo.columns || tableInfo.columns.length === 0) throw new Error("表字段列表不能为空");

  const selected = tableInfo.columns.filter((col) => col.isSelected);
  if (selected.length === 0) throw new Error("至少需要选择一个字段用于代码生成");

  const emptyName = tableInfo.columns.filter((col) => col.isSelected && !col.name);
  if (emptyName.length > 0) throw new Error("选中的字段名称不能为空");
};

/** 清理表信息中的特殊字符 */
const cleanTableInfo = (tableInfo: TableInfo): TableInfo => {
  const cleaned = JSON.parse(JSON.stringify(tableInfo)) as TableInfo;
  if (cleaned.comment) cleaned.comment = cleanString(cleaned.comment);
  cleaned.columns = cleaned.columns.map((col) => ({
    ...col,
    comment: cleanString(col.comment || ""),
  }));
  return cleaned;
};

/** 代码生成路由 */
export const generatorRoutes = new Elysia({ prefix: "/api/generator" })
  // 健康检查
  .get("/health", async () => {
    try {
      const templates = await getSupportedTemplates();
      return {
        success: true,
        message: "代码生成器运行正常",
        data: {
          templateCount: templates.length,
          templateNames: templates.map((t) => t.name),
          version: "1.0.0",
        },
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  })

  // 生成代码并下载 ZIP
  .post(
    "/generate",
    async ({ body, set }) => {
      try {
        const tableInfo = body as TableInfo & { groupId?: number };
        validateTableInfo(tableInfo);
        const cleaned = cleanTableInfo(tableInfo);
        const zipData = await generateZipFile(cleaned, tableInfo.groupId);

        // 写入临时文件
        const tmpPath = join(tmpdir(), `codegen_${Date.now()}_${cleaned.name}.zip`);
        await writeFile(tmpPath, zipData);

        // 设置响应头
        set.headers["Content-Type"] = "application/zip";
        set.headers["Content-Disposition"] = `attachment; filename="${encodeURIComponent(cleaned.name)}.zip"`;
        set.headers["Content-Length"] = String(zipData.byteLength);

        // 异步清理临时文件（延迟 10 秒，确保文件传输完成）
        setTimeout(() => unlink(tmpPath).catch(() => { }), 10000);

        return file(tmpPath);
      } catch (error: any) {
        console.error("代码生成失败:", error);
        set.status = 500;
        return { success: false, message: `代码生成失败: ${error.message}` };
      }
    },
    { body: tableInfoSchema }
  )

  // 根据数据库 ID 和表名预览代码
  .get("/preview/:dbId/:tableName", async ({ params: { dbId, tableName }, query }) => {
    try {
      const groupId = query.groupId ? Number(query.groupId) : undefined;
      const tableInfo = await databaseConnector.getTableInfo(dbId, tableName);
      validateTableInfo(tableInfo);
      const files = await generateFiles(tableInfo, groupId);

      return {
        success: true,
        data: files,
        metadata: {
          tableName: tableInfo.name,
          tableComment: tableInfo.comment,
          fieldCount: tableInfo.columns.length,
          selectedFieldCount: tableInfo.columns.filter((c) => c.isSelected).length,
          generatedFiles: Object.keys(files),
        },
      };
    } catch (error: any) {
      return { success: false, message: `预览生成失败: ${error.message}` };
    }
  })

  // 根据提交数据预览代码
  .post(
    "/preview",
    async ({ body }) => {
      try {
        const tableInfo = body as TableInfo & { groupId?: number };
        validateTableInfo(tableInfo);
        const cleaned = cleanTableInfo(tableInfo);
        cleaned.columns.sort((a, b) => a.order - b.order);
        const files = await generateFiles(cleaned, tableInfo.groupId);

        return {
          success: true,
          data: files,
          metadata: {
            tableName: cleaned.name,
            tableComment: cleaned.comment,
            fieldCount: cleaned.columns.length,
            selectedFieldCount: cleaned.columns.filter((c) => c.isSelected).length,
            generatedFiles: Object.keys(files),
          },
        };
      } catch (error: any) {
        return { success: false, message: `预览生成失败: ${error.message}` };
      }
    },
    { body: tableInfoSchema }
  );
