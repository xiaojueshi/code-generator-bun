import { localDatabase } from "../database/local";
import { databaseConnector } from "../database/connector";
import { initDefaultTemplates } from "../utils/template";

async function cliInit() {
  console.log("\x1b[36m🔧\x1b[0m 初始化...");
  await localDatabase.init();
  await databaseConnector.loadSavedConnections();
  await initDefaultTemplates();
}

function printHelp() {
  console.log(`用法: code-generator <命令> [选项]

命令:
  list datasources              列出所有已配置的数据源
  list templates                列出所有模板（按分组展示）
  list tables <数据源>          列出数据源下的所有表
  table info <数据源> <表>      查看表结构（JSON 输出）
  generate <数据源> <表>        生成代码

生成选项:
  --template-group <名称>       按模板组筛选
  --template <名称>              按模板名称筛选单个
  --columns <列1,列2,...>       只生成指定列
  --output <目录>, -o <目录>    输出目录（默认 ./<表名>-code/）`);
}

export async function runCli(args: string[]) {
  await cliInit();

  const [cmd, ...rest] = args;

  switch (cmd) {
    case "list":
      const { runListCmd } = await import("./list");
      await runListCmd(rest);
      break;
    case "table":
      const { runTableCmd } = await import("./table");
      await runTableCmd(rest);
      break;
    case "generate":
      const { runGenerateCmd } = await import("./generate");
      await runGenerateCmd(rest);
      break;
    case "-h":
    case "--help":
    default:
      if (cmd && cmd !== "-h" && cmd !== "--help") {
        console.error(`\x1b[31m未知命令: ${cmd}\x1b[0m`);
      }
      printHelp();
      process.exit(cmd ? 1 : 0);
  }
}
