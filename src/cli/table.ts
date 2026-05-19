import { databaseConnector } from "../database/connector";

export async function runTableCmd(args: string[]) {
  // table info <数据源> <表名>
  const sub = args[0];
  if (sub === "info") {
    args = args.slice(1);
  }

  if (args.length < 2) {
    console.error("用法: code-generator table info <数据源名称> <表名>");
    process.exit(1);
  }

  const [nameOrId, tableName] = args;

  const configs = databaseConnector.getConnectedDatabases();
  const config = configs.find((c) => c.name === nameOrId) || databaseConnector.getDatabaseConfig(nameOrId);

  if (!config) {
    console.error(`\x1b[31m未找到数据源: ${nameOrId}\x1b[0m`);
    console.log("可用数据源:");
    configs.forEach((c) => console.log(`  - ${c.name} (${c.type})`));
    process.exit(1);
  }

  console.log(`\x1b[36m📋\x1b[0m 正在获取表 \x1b[1m${tableName}\x1b[0m 的结构...\n`);

  try {
    const tableInfo = await databaseConnector.getTableInfo(config.id, tableName);

    console.log(JSON.stringify(tableInfo, null, 2));
  } catch (error: any) {
    console.error(`\x1b[31m获取表结构失败: ${error.message}\x1b[0m`);
    process.exit(1);
  }
}
