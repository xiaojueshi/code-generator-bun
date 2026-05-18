import Handlebars from "handlebars";
import type { TableInfo, TemplateInfo } from "../types";
import { localDatabase } from "../database/local";
import { cleanString } from "./stringUtils";
import JSZip from "jszip";
import indexHbs from "../templates/index.hbs" with { type: "text" };
import requestHbs from "../templates/request.hbs" with { type: "text" };
import apiHbs from "../templates/api.hbs" with { type: "text" };
import constantsHbs from "../templates/constants.hbs" with { type: "text" };
import typeHbs from "../templates/type.hbs" with { type: "text" };
import useListStateHbs from "../templates/useListState.hbs" with { type: "text" };

// 注册 raw 助手，用于跳过模板处理
Handlebars.registerHelper("raw", function (options: any) {
  return options.fn();
});

/**
 * 初始化默认模板
 * 如果没有分组则创建默认分组，并从 src/templates/ 读取模板写入
 */
export const initDefaultTemplates = async (force = false): Promise<void> => {
  const count = await localDatabase.getTemplateCount();
  if (count > 0 && !force) {
    console.log(`模板已存在（${count} 个），跳过初始化`);
    return;
  }

  // 如果强制重置，先清空
  if (force) {
    const existing = await localDatabase.getAllTemplates();
    for (const tpl of existing) {
      await localDatabase.deleteTemplate(tpl.id);
    }
    // 也清空分组
    const groups = await localDatabase.getAllGroups();
    for (const g of groups) {
      await localDatabase.deleteGroup(g.id);
    }
  }

  // 创建默认分组
  const groups = await localDatabase.getAllGroups();
  let defaultGroupId: number;
  if (groups.length === 0) {
    defaultGroupId = await localDatabase.createGroup("默认分组", "项目初始化时自动创建的分组");
    console.log(`已创建默认分组 (ID: ${defaultGroupId})`);
  } else {
    defaultGroupId = groups[0].id;
  }

  // 默认模板配置
  const DEFAULT_TEMPLATES: Record<string, { filename: string; content: string }> = {
    index: { filename: "index.vue", content: indexHbs },
    request: { filename: "request.ts", content: requestHbs },
    api: { filename: "api.ts", content: apiHbs },
    constants: { filename: "constants.ts", content: constantsHbs },
    type: { filename: "type.ts", content: typeHbs },
    useListState: { filename: "useListState.ts", content: useListStateHbs },
  };

  for (const [name, info] of Object.entries(DEFAULT_TEMPLATES)) {
    if (info.content) {
      await localDatabase.saveTemplate({ name, filename: info.filename, content: info.content, groupId: defaultGroupId });
      console.log(`已加载默认模板: ${name} -> ${info.filename} (分组: 默认)`);
    } else {
      console.warn(`默认模板文件缺少内容: ${name}`);
    }
  }
};

/**
 * 使用表信息渲染单个模板
 */
export const renderTemplate = (template: TemplateInfo, tableInfo: TableInfo): string => {
  const compiled = Handlebars.compile(template.content, { noEscape: true });

  const fieldsList = tableInfo.columns
    .filter((col) => col.isSelected)
    .sort((a, b) => a.order - b.order)
    .map((col) => ({ ...col, comment: cleanString(col.comment) }));

  const data = {
    tableName: tableInfo.name,
    tableComment: cleanString(tableInfo.comment || ""),
    fieldsList,
  };

  const result = compiled(data);
  if (!result || result.trim().length === 0) {
    throw new Error(`模板 ${template.name} 渲染结果为空`);
  }

  return result;
};

/**
 * 生成代码文件（按分组筛选模板）
 */
export const generateFiles = async (tableInfo: TableInfo, groupId?: number): Promise<Record<string, string>> => {
  const templates = await localDatabase.getAllTemplates(groupId);
  if (templates.length === 0) {
    throw new Error(groupId ? "该分组下没有模板" : "没有可用的模板，请先添加模板");
  }

  const files: Record<string, string> = {};

  for (const template of templates) {
    try {
      const content = renderTemplate(template, tableInfo);
      files[template.filename] = content;
    } catch (error: any) {
      console.error(`渲染模板 ${template.name} 失败: ${error.message}`);
      throw error;
    }
  }

  console.log(`成功生成代码文件，表名: ${tableInfo.name}, 文件: ${Object.keys(files).join(", ")}`);
  return files;
};

/**
 * 生成 ZIP 文件（按分组筛选模板）
 */
export const generateZipFile = async (tableInfo: TableInfo, groupId?: number): Promise<Uint8Array> => {
  const zip = new JSZip();
  const folder = zip.folder(tableInfo.name);
  if (!folder) throw new Error("创建 ZIP 文件夹失败");

  const files = await generateFiles(tableInfo, groupId);
  for (const [fileName, content] of Object.entries(files)) {
    folder.file(fileName, content);
  }

  const zipContent = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  console.log(`成功生成 ZIP 文件，表名: ${tableInfo.name}, 文件数量: ${Object.keys(files).length}`);
  return zipContent;
};

/**
 * 获取支持的模板类型列表
 */
export const getSupportedTemplates = async (): Promise<TemplateInfo[]> => {
  return localDatabase.getAllTemplates();
};
