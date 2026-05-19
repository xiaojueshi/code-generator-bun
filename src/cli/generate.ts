import { join, resolve } from "path";
import { mkdir } from "fs/promises";
import { databaseConnector } from "../database/connector";
import { localDatabase } from "../database/local";
import { generateFiles } from "../utils/template";
import type { TableInfo } from "../types";

interface GenerateOptions {
  templateGroup?: string;
  template?: string;
  columns?: string;
  output?: string;
}

function toCamelCase(kebab: string): string {
  return kebab.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function parseOptions(args: string[], startIndex: number): { positionals: string[]; options: Record<string, string> } {
  const positionals: string[] = [];
  const options: Record<string, string> = {};

  for (let i = startIndex; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = toCamelCase(arg.slice(2));
      if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        options[key] = args[++i];
      } else {
        options[key] = "true";
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      const shortMap: Record<string, string> = { o: "output" };
      const key = shortMap[arg[1]] || arg[1];
      if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
        options[key] = args[++i];
      }
    } else {
      if (positionals.length < 2) {
        positionals.push(arg);
      }
    }
  }

  return { positionals, options };
}

export async function runGenerateCmd(args: string[]) {
  const { positionals, options } = parseOptions(args, 0);

  if (positionals.length < 2) {
    console.error("用法: code-generator generate <数据源名称> <表名> [选项]");
    console.error("选项:");
    console.error("  --template-group <名称>   按模板组筛选");
    console.error("  --template <名称>         按模板名称筛选单个");
    console.error("  --columns <列1,列2,...>   只生成指定列");
    console.error("  --output <目录>, -o <目录> 输出目录");
    process.exit(1);
  }

  const [nameOrId, tableName] = positionals;

  // 查找数据源
  const configs = databaseConnector.getConnectedDatabases();
  const config = configs.find((c) => c.name === nameOrId) || databaseConnector.getDatabaseConfig(nameOrId);

  if (!config) {
    console.error(`\x1b[31m❌ 未找到数据源: ${nameOrId}\x1b[0m`);
    console.log("可用数据源:");
    configs.forEach((c) => console.log(`  \x1b[33m- ${c.name}\x1b[0m (${c.type})`));
    process.exit(1);
  }

  // 获取表结构
  console.log(`\x1b[36m📋\x1b[0m 正在获取表 \x1b[1m${tableName}\x1b[0m 的结构...`);
  let tableInfo: TableInfo;
  try {
    tableInfo = await databaseConnector.getTableInfo(config.id, tableName);
  } catch (error: any) {
    console.error(`\x1b[31m❌ 获取表结构失败: ${error.message}\x1b[0m`);
    process.exit(1);
  }

  const fieldCount = tableInfo.columns.length;
  console.log(`  表注释: \x1b[33m${tableInfo.comment || "无"}\x1b[0m`);
  console.log(`  字段数: \x1b[33m${fieldCount}\x1b[0m`);

  // 按列筛选
  if (options.columns) {
    const selectedSet = new Set(options.columns.split(",").map((c) => c.trim()));
    tableInfo.columns = tableInfo.columns.map((col) => ({
      ...col,
      isSelected: selectedSet.has(col.name) || selectedSet.has(col.originalName),
    }));
    const selectedCount = tableInfo.columns.filter((c) => c.isSelected).length;
    console.log(`  选中列: \x1b[33m${selectedCount}/${fieldCount}\x1b[0m`);
  }

  // 查找模板分组
  let groupId: number | undefined;
  if (options.templateGroup) {
    const groups = await localDatabase.getAllGroups();
    const group = groups.find((g) => g.name === options.templateGroup);
    if (!group) {
      console.error(`\x1b[31m❌ 未找到模板分组: ${options.templateGroup}\x1b[0m`);
      console.log("可用分组:");
      groups.forEach((g) => console.log(`  \x1b[33m- ${g.name}\x1b[0m`));
      process.exit(1);
    }
    groupId = group.id;
    console.log(`  模板分组: \x1b[33m${group.name}\x1b[0m`);
  }

  // 获取模板（用于后续按文件名筛选）
  let templates = await localDatabase.getAllTemplates(groupId);
  if (templates.length === 0) {
    console.error("\x1b[31m❌ 没有可用的模板\x1b[0m");
    process.exit(1);
  }

  const templateName = options.template;
  if (templateName) {
    const matched = templates.find((t) => t.name === templateName);
    if (!matched) {
      console.error(`\x1b[31m❌ 未找到模板: ${templateName}\x1b[0m`);
      process.exit(1);
    }
    templates = [matched];
  }

  console.log(`  模板数量: \x1b[33m${templates.length}\x1b[0m`);
  console.log("");

  // 渲染模板
  console.log(`\x1b[36m⚙️\x1b[0m  正在生成代码...`);
  const files: Record<string, string> = {};
  for (const template of templates) {
    const { renderTemplate } = await import("../utils/template");
    try {
      const content = renderTemplate(template, tableInfo);
      files[template.filename] = content;
    } catch (error: any) {
      console.error(`\x1b[31m❌ 渲染模板 ${template.name} 失败: ${error.message}\x1b[0m`);
      process.exit(1);
    }
  }

  // 写入文件
  const outputDir = resolve(options.output || `./${tableInfo.name}-code`);
  await mkdir(outputDir, { recursive: true });

  const fileResults: { name: string; size: string; status: string }[] = [];
  for (const [filename, content] of Object.entries(files)) {
    const filePath = join(outputDir, filename);
    await Bun.write(filePath, content);
    const size = content.length < 1024 ? `${content.length} B` : `${(content.length / 1024).toFixed(1)} KB`;
    fileResults.push({ name: filename, size, status: "✅" });
  }

  // 输出结果
  console.log(`\n\x1b[32m✅\x1b[0m 成功为表 \x1b[1m${tableInfo.name}\x1b[0m 生成代码\n`);
  console.log(`  数据源:   \x1b[33m${config.name}\x1b[0m`);
  console.log(`  输出目录: \x1b[36m${outputDir}\x1b[0m\n`);

  const nameWidth = Math.max(...fileResults.map((f) => f.name.length), 4);
  const sizeWidth = Math.max(...fileResults.map((f) => f.size.length), 4);

  const hLine = `  ┌─${"─".repeat(nameWidth + 2)}─┬─${"─".repeat(sizeWidth + 2)}─┬──────────┐`;
  const sepLine = `  ├─${"─".repeat(nameWidth + 2)}─┼─${"─".repeat(sizeWidth + 2)}─┼──────────┤`;
  const bLine = `  └─${"─".repeat(nameWidth + 2)}─┴─${"─".repeat(sizeWidth + 2)}─┴──────────┘`;

  console.log(hLine);
  console.log(`  │ ${"文件".padEnd(nameWidth)} │ ${"大小".padEnd(sizeWidth)} │ 状态     │`);
  console.log(sepLine);
  for (const f of fileResults) {
    console.log(`  │ ${f.name.padEnd(nameWidth)} │ ${f.size.padEnd(sizeWidth)} │ ${f.status} 已写入 │`);
  }
  console.log(bLine);
  console.log();
}
