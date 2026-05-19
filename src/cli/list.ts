import { localDatabase } from "../database/local";
import { databaseConnector } from "../database/connector";

async function listTables(args: string[]) {
  const nameOrId = args[0];
  if (!nameOrId) {
    console.error("用法: code-generator list tables <数据源名称>");
    process.exit(1);
  }

  const configs = databaseConnector.getConnectedDatabases();
  const config = configs.find((c) => c.name === nameOrId) || databaseConnector.getDatabaseConfig(nameOrId);
  if (!config) {
    console.error(`\x1b[31m未找到数据源: ${nameOrId}\x1b[0m`);
    configs.forEach((c) => console.log(`  - ${c.name}`));
    process.exit(1);
  }

  try {
    const tables = await databaseConnector.listTables(config.id);
    if (tables.length === 0) {
      console.log(`数据源 \x1b[33m${config.name}\x1b[0m 中没有找到表。`);
      return;
    }
    console.log(`\n\x1b[1m${config.name}\x1b[0m 中的表 (\x1b[33m${tables.length}\x1b[0m 个):\n`);
    for (const table of tables) {
      console.log(`  \x1b[36m${table}\x1b[0m`);
    }
    console.log();
  } catch (error: any) {
    console.error(`\x1b[31m获取表列表失败: ${error.message}\x1b[0m`);
    process.exit(1);
  }
}

function pad(text: string, len: number): string {
  const visible = text.replace(/\x1b\[\d+m/g, "");
  const padLen = Math.max(0, len - visible.length);
  return text + " ".repeat(padLen);
}

function separator(widths: number[], left: string, mid: string, right: string, cross: string): string {
  return left + widths.map((w) => cross.repeat(w + 2)).join(mid) + right;
}

function printTable(headers: string[], rows: string[][]) {
  const colCount = headers.length;
  const widths = headers.map((h, i) => {
    const dataMax = Math.max(...rows.map((r) => (r[i] || "").replace(/\x1b\[\d+m/g, "").length));
    return Math.max(h.length, dataMax);
  });

  const hLine = separator(widths, "┌", "┬", "┐", "─");
  const mLine = separator(widths, "├", "┼", "┤", "─");
  const bLine = separator(widths, "└", "┴", "┘", "─");

  console.log(hLine);
  console.log("│ " + headers.map((h, i) => pad(h, widths[i])).join(" │ ") + " │");
  console.log(mLine);
  for (const row of rows) {
    console.log("│ " + row.map((cell, i) => pad(cell, widths[i])).join(" │ ") + " │");
  }
  console.log(bLine);
}

export async function runListCmd(args: string[]) {
  const sub = args[0];

  switch (sub) {
    case "datasources":
      return listDatasources();
    case "templates":
      return listTemplates();
    case "tables":
      return listTables(args.slice(1));
    default:
      console.error("用法: code-generator list datasources|templates|tables <数据源名称>");
      process.exit(1);
  }
}

async function listDatasources() {
  const configs = databaseConnector.getConnectedDatabases();

  if (configs.length === 0) {
    console.log("暂无已配置的数据源。请通过 Web 界面添加。");
    return;
  }

  const headers = ["\x1b[1m名称\x1b[0m", "\x1b[1m类型\x1b[0m", "\x1b[1m主机\x1b[0m", "\x1b[1m数据库\x1b[0m"];
  const rows = configs.map((c) => {
    const host = c.type === "sqlite" ? (c.filename || "-") : `${c.host || "localhost"}:${c.port || "-"}`;
    return [c.name, c.type, host, c.database];
  });

  console.log("\n\x1b[1m已配置的数据源:\x1b[0m");
  printTable(headers, rows);
  console.log();
}

async function listTemplates() {
  const groups = await localDatabase.getAllGroups();

  if (groups.length === 0) {
    // 可能模板以无分组方式存在，直接查模板
    const templates = await localDatabase.getAllTemplates();
    if (templates.length === 0) {
      console.log("暂无模板。请通过 Web 界面添加或运行重置。");
      return;
    }
    const headers = ["\x1b[1m名称\x1b[0m", "\x1b[1m文件名\x1b[0m"];
    const rows = templates.map((t) => [t.name, t.filename]);
    console.log("\n\x1b[1m模板列表:\x1b[0m");
    printTable(headers, rows);
    console.log();
    return;
  }

  for (const group of groups) {
    const members = await localDatabase.getAllTemplates(group.id);
    if (members.length === 0) continue;

    console.log(`\n\x1b[1m${group.name}\x1b[0m${group.description ? ` — ${group.description}` : ""}`);
    const headers = ["\x1b[1m名称\x1b[0m", "\x1b[1m文件名\x1b[0m"];
    const rows = members.map((t) => [t.name, t.filename]);
    printTable(headers, rows);
  }
  console.log();
}
