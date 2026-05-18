import { SQL } from "bun";
import type { DatabaseConfig, TableColumn, TableInfo } from "../types";
import { localDatabase } from "./local";
import { cleanString } from "../utils/stringUtils";

/** 超时包装：为任意 Promise 添加超时限制 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} 超时（${ms / 1000}秒）`));
    }, ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/** 达梦操作默认超时时间（毫秒） */
const DMDB_CONNECT_TIMEOUT = 10_000;
const DMDB_QUERY_TIMEOUT = 30_000;

/**
 * 数据库连接器
 * 使用 Bun 原生 SQL 模块统一管理 MySQL/PostgreSQL/SQLite 连接
 * 考虑到 DMDB 是独立的 Node.js 驱动，我们将特殊处理其连接池/生命周期
 * 关键设计：短连接模式，每次操作创建连接，操作完成后立即关闭
 */
class DatabaseConnector {
  private configs: Map<string, DatabaseConfig> = new Map();

  /** 创建达梦专属的临时连接（带超时） */
  private async getDmdbConnection(config: DatabaseConfig): Promise<any> {
    const dmdb = require("dmdb");
    const connPromise = dmdb.getConnection({
      user: config.user || config.database,
      password: config.password,
      connectString: `${config.host || "localhost"}:${config.port || 5236}`,
      loginEncrypt: false,
      maxRows: 0,
    });
    return withTimeout(connPromise, DMDB_CONNECT_TIMEOUT, "达梦数据库连接");
  }

  /** 创建临时数据库连接 */
  private createConnection(config: DatabaseConfig): InstanceType<typeof SQL> {
    switch (config.type) {
      case "mysql":
        return new SQL({
          adapter: "mysql",
          hostname: config.host || "localhost",
          port: config.port || 3306,
          database: config.database,
          username: config.user || "root",
          password: config.password || "",
          max: 1,
          idleTimeout: 5,
        });

      case "postgres":
        return new SQL({
          hostname: config.host || "localhost",
          port: config.port || 5432,
          database: config.database,
          username: config.user || "postgres",
          password: config.password || "",
          max: 1,
          idleTimeout: 5,
        });

      case "sqlite":
        if (!config.filename) {
          throw new Error("SQLite 数据库需要指定文件路径");
        }
        return new SQL({
          adapter: "sqlite",
          filename: config.filename,
        });

      default:
        throw new Error(`不支持的数据库类型: ${config.type}`);
    }
  }

  /** 关闭连接 */
  private async closeConnection(conn: InstanceType<typeof SQL>): Promise<void> {
    try {
      await conn.close();
    } catch (error) {
      console.warn("关闭数据库连接时出错:", error);
    }
  }

  /** 验证并保存数据库配置 */
  async connect(config: DatabaseConfig): Promise<boolean> {
    if (config.type === "dmdb") {
      let dmdbConn;
      try {
        dmdbConn = await this.getDmdbConnection(config);
        await withTimeout(dmdbConn.execute("SELECT 1 FROM DUAL"), DMDB_QUERY_TIMEOUT, "达梦连接验证查询");

        await localDatabase.saveConnection(config);
        this.configs.set(config.id, config);
        return true;
      } catch (error: any) {
        console.error(`连接达梦数据库失败: ${error.message}`);
        throw error;
      } finally {
        if (dmdbConn) {
          try { await dmdbConn.close(); } catch (e) { }
        }
      }
    }

    const conn = this.createConnection(config);
    try {
      // 分别验证原生查询库的连接
      if (config.type === "sqlite") {
        await conn`SELECT 1`;
      } else if (config.type === "mysql") {
        await conn`SELECT 1`;
      } else {
        await conn`SELECT 1`;
      }

      // 保存配置
      await localDatabase.saveConnection(config);
      this.configs.set(config.id, config);
      return true;
    } catch (error: any) {
      console.error(`连接数据库失败: ${error.message}`);
      throw error;
    } finally {
      await this.closeConnection(conn);
    }
  }

  /** 删除数据库配置 */
  async disconnect(id: string): Promise<boolean> {
    const config = this.configs.get(id);
    if (!config) return false;

    await localDatabase.deleteConnection(id);
    this.configs.delete(id);
    return true;
  }

  /** 获取表列表 */
  async listTables(id: string): Promise<string[]> {
    const config = this.configs.get(id);
    if (!config) throw new Error(`未找到 ID 为 ${id} 的数据源`);

    if (config.type === "dmdb") {
      let dmdbConn;
      try {
        const dmdb = require("dmdb");
        dmdbConn = await this.getDmdbConnection(config);
        const targetSchema = config.database.toUpperCase();
        // 达梦查表，指定 outFormat: dmdb.OUT_FORMAT_OBJECT 可以取属性，或不指定走下标。指定省事
        const result: any = await withTimeout(dmdbConn.execute(
          `SELECT table_name FROM all_tables WHERE owner = '${targetSchema}' ORDER BY table_name`,
          [],
          { outFormat: dmdb.OUT_FORMAT_OBJECT }
        ), DMDB_QUERY_TIMEOUT, "达梦查询表列表");
        return (result.rows || []).map((row: any) => row.TABLE_NAME);
      } finally {
        if (dmdbConn) {
          try { await dmdbConn.close(); } catch (e) { }
        }
      }
    }

    const conn = this.createConnection(config);
    try {
      switch (config.type) {
        case "mysql": {
          const rows = await conn`
            SELECT table_name as TABLE_NAME
            FROM information_schema.tables
            WHERE table_schema = ${config.database}
            ORDER BY table_name
          `;
          return rows.map((row: any) => row.TABLE_NAME);
        }

        case "postgres": {
          const rows = await conn`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
          `;
          return rows.map((row: any) => row.table_name);
        }

        case "sqlite": {
          const rows = await conn`
            SELECT name FROM sqlite_master
            WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
          `;
          return rows.map((row: any) => row.name);
        }

        default:
          throw new Error(`不支持的数据库类型: ${config.type}`);
      }
    } finally {
      await this.closeConnection(conn);
    }
  }

  /** 获取表结构信息 */
  async getTableInfo(id: string, tableName: string): Promise<TableInfo> {
    const config = this.configs.get(id);
    if (!config) throw new Error(`未找到 ID 为 ${id} 的数据源`);

    if (config.type === "dmdb") {
      let dmdbConn;
      try {
        const dmdb = require("dmdb");
        dmdbConn = await this.getDmdbConnection(config);
        const targetSchema = config.database.toUpperCase();

        const escapedSchema = targetSchema.replace(/'/g, "''");
        const candidates = Array.from(new Set([tableName, tableName.toUpperCase()]));

        let matchedName = candidates[0];
        let tableComment = tableName;
        let columnRows: any[] = [];

        for (const candidate of candidates) {
          const escapedName = candidate.replace(/'/g, "''");
          const result: any = await withTimeout(dmdbConn.execute(
            `SELECT 
               t.column_name, 
               t.data_type, 
               t.nullable,
               t.data_default,
               t.column_id,
               c.comments
             FROM all_tab_columns t
             LEFT JOIN all_col_comments c 
               ON t.owner = c.owner AND t.table_name = c.table_name AND t.column_name = c.column_name
             WHERE t.owner = '${escapedSchema}' AND t.table_name = '${escapedName}'
             ORDER BY t.column_id`,
            [],
            { outFormat: dmdb.OUT_FORMAT_OBJECT }
          ), DMDB_QUERY_TIMEOUT, "达梦查询列信息");

          if (result.rows && result.rows.length > 0) {
            columnRows = result.rows;
            matchedName = candidate;
            break;
          }
        }

        const escapedMatched = matchedName.replace(/'/g, "''");
        const commentResult: any = await withTimeout(dmdbConn.execute(
          `SELECT comments FROM all_tab_comments WHERE owner = '${escapedSchema}' AND table_name = '${escapedMatched}'`,
          [],
          { outFormat: dmdb.OUT_FORMAT_OBJECT }
        ), DMDB_QUERY_TIMEOUT, "达梦查询表注释");
        if (commentResult.rows && commentResult.rows.length > 0) {
          tableComment = cleanString(commentResult.rows[0].COMMENTS || tableName);
        }

        const columns: TableColumn[] = columnRows.map((row: any, index: number) => ({
          name: row.COLUMN_NAME,
          originalName: row.COLUMN_NAME,
          dataType: row.DATA_TYPE,
          comment: cleanString(row.COMMENTS || row.COLUMN_NAME),
          isNullable: row.NULLABLE === 'Y',
          defaultValue: row.DATA_DEFAULT,
          isSelected: true,
          order: index,
        }));

        return { name: tableName, comment: tableComment, columns };
      } finally {
        if (dmdbConn) {
          try { await dmdbConn.close(); } catch (e) { }
        }
      }
    }

    const conn = this.createConnection(config);
    try {
      let columns: TableColumn[] = [];
      let tableComment = "";

      switch (config.type) {
        case "mysql": {
          // 获取表注释
          const tableMeta = await conn`
            SELECT table_comment
            FROM information_schema.tables
            WHERE table_schema = ${config.database} AND table_name = ${tableName}
          `;
          if (tableMeta.length > 0) {
            tableComment = cleanString((tableMeta[0] as any).table_comment || "");
          }

          // 获取字段信息
          const rows = await conn`
            SELECT
              column_name as COLUMN_NAME,
              data_type as DATA_TYPE,
              column_comment as COLUMN_COMMENT,
              is_nullable as IS_NULLABLE,
              column_default as COLUMN_DEFAULT
            FROM information_schema.columns
            WHERE table_schema = ${config.database} AND table_name = ${tableName}
            ORDER BY ordinal_position
          `;

          columns = rows.map((row: any, index: number) => ({
            name: row.COLUMN_NAME,
            originalName: row.COLUMN_NAME,
            dataType: row.DATA_TYPE,
            comment: cleanString(row.COLUMN_COMMENT || row.COLUMN_NAME),
            isNullable: row.IS_NULLABLE === "YES",
            defaultValue: row.COLUMN_DEFAULT,
            isSelected: true,
            order: index,
          }));
          break;
        }

        case "postgres": {
          // 获取表注释
          const commentResult = await conn`
            SELECT obj_description(to_regclass(${tableName}), 'pg_class') AS comment
          `;
          if (commentResult.length > 0) {
            tableComment = cleanString((commentResult[0] as any).comment || "");
          }

          // 获取字段信息
          const rows = await conn`
            SELECT
              a.attname as column_name,
              t.typname as data_type,
              pg_catalog.col_description(a.attrelid, a.attnum) as column_comment,
              a.attnotnull as is_not_null,
              pg_get_expr(d.adbin, d.adrelid) as column_default
            FROM pg_catalog.pg_attribute a
            JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
            JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
            JOIN pg_catalog.pg_type t ON a.atttypid = t.oid
            LEFT JOIN pg_catalog.pg_attrdef d ON (a.attrelid, a.attnum) = (d.adrelid, d.adnum)
            WHERE c.relname = ${tableName}
            AND a.attnum > 0
            AND NOT a.attisdropped
            ORDER BY a.attnum
          `;

          columns = rows.map((row: any, index: number) => ({
            name: row.column_name,
            originalName: row.column_name,
            dataType: row.data_type,
            comment: cleanString(row.column_comment || row.column_name),
            isNullable: !row.is_not_null,
            defaultValue: row.column_default,
            isSelected: true,
            order: index,
          }));
          break;
        }

        case "sqlite": {
          tableComment = cleanString(tableName);

          const escapedTableName = tableName.replace(/"/g, '""');
          const rows = await conn.unsafe(`PRAGMA table_info("${escapedTableName}")`);

          columns = rows.map((row: any, index: number) => ({
            name: row.name,
            originalName: row.name,
            dataType: row.type,
            comment: cleanString(row.name), // SQLite 不支持列注释
            isNullable: row.notnull === 0,
            defaultValue: row.dflt_value,
            isSelected: true,
            order: index,
          }));
          break;
        }

        default:
          throw new Error(`不支持的数据库类型: ${config.type}`);
      }

      return { name: tableName, comment: tableComment, columns };
    } finally {
      await this.closeConnection(conn);
    }
  }

  /** 获取已连接的数据库列表 */
  getConnectedDatabases(): DatabaseConfig[] {
    return Array.from(this.configs.values());
  }

  /** 获取数据库配置 */
  getDatabaseConfig(id: string): DatabaseConfig | undefined {
    return this.configs.get(id);
  }

  /** 获取数据源下可访问的数据库列表 */
  async listDatabases(id: string): Promise<string[]> {
    const config = this.configs.get(id);
    if (!config) throw new Error(`未找到 ID 为 ${id} 的数据源`);

    if (config.type === "dmdb") {
      let dmdbConn;
      try {
        const dmdb = require("dmdb");
        dmdbConn = await this.getDmdbConnection(config);
        const seen = new Set<string>();
        const schemas: string[] = [];
        let anySucceeded = false;

        // 从 dba_objects 获取所有拥有任意对象的 owner（覆盖纯 schema）
        try {
          const r = await withTimeout(dmdbConn.execute(
            "SELECT DISTINCT owner FROM dba_objects ORDER BY owner",
            [],
            { outFormat: dmdb.OUT_FORMAT_OBJECT }
          ), DMDB_QUERY_TIMEOUT, "达梦查询对象所属模式列表");
          for (const row of (r.rows || [])) {
            const name = row.OWNER;
            if (name && !seen.has(name)) {
              seen.add(name);
              schemas.push(name);
            }
          }
          anySucceeded = true;
        } catch (e) { /* 可能无权限，继续尝试 dba_users */ }

        // 从 dba_users 补充用户级 schema（覆盖有用户但无表的 schema）
        try {
          const r = await withTimeout(dmdbConn.execute(
            "SELECT username FROM dba_users ORDER BY username",
            [],
            { outFormat: dmdb.OUT_FORMAT_OBJECT }
          ), DMDB_QUERY_TIMEOUT, "达梦查询用户列表");
          for (const row of (r.rows || [])) {
            const name = row.USERNAME;
            if (name && !seen.has(name)) {
              seen.add(name);
              schemas.push(name);
            }
          }
          anySucceeded = true;
        } catch (e) {
          try {
            const r = await withTimeout(dmdbConn.execute(
              "SELECT username FROM all_users ORDER BY username",
              [],
              { outFormat: dmdb.OUT_FORMAT_OBJECT }
            ), DMDB_QUERY_TIMEOUT, "达梦查询用户列表");
            for (const row of (r.rows || [])) {
              const name = row.USERNAME;
              if (name && !seen.has(name)) {
                seen.add(name);
                schemas.push(name);
              }
            }
            anySucceeded = true;
          } catch (e2) { /* 都失败 */ }
        }

        if (!anySucceeded) return [config.database.toUpperCase()];
        schemas.sort();
        return schemas;
      } finally {
        if (dmdbConn) {
          try { await dmdbConn.close(); } catch (e) { }
        }
      }
    }

    const conn = this.createConnection(config);
    try {
      switch (config.type) {
        case "mysql": {
          // 检查用户权限
          const grantRows = await conn`SHOW GRANTS FOR CURRENT_USER()`;
          const grantsStr = JSON.stringify(grantRows);
          const isAdmin = grantsStr.includes("ALL PRIVILEGES") || config.user === "root";

          if (isAdmin) {
            const rows = await conn`SHOW DATABASES`;
            return rows
              .map((row: any) => row.Database)
              .filter((name: string) =>
                !["information_schema", "mysql", "performance_schema", "sys"].includes(name)
              );
          }
          return [config.database];
        }

        case "postgres": {
          const result = await conn`
            SELECT rolsuper FROM pg_roles WHERE rolname = current_user
          `;
          const isSuperUser = result.length > 0 && (result[0] as any).rolsuper;

          if (isSuperUser) {
            const dbResult = await conn`
              SELECT datname FROM pg_database
              WHERE datistemplate = false AND datname != 'postgres'
              ORDER BY datname
            `;
            return dbResult.map((row: any) => row.datname);
          }
          return [config.database];
        }

        case "sqlite":
          return [config.database];

        default:
          throw new Error(`不支持的数据库类型: ${config.type}`);
      }
    } finally {
      await this.closeConnection(conn);
    }
  }

  /** 加载已保存的连接配置 */
  async loadSavedConnections(): Promise<void> {
    try {
      const connections = await localDatabase.getAllConnections();
      for (const config of connections) {
        this.configs.set(config.id, config);
      }
      console.log(`已加载 ${connections.length} 个保存的数据源配置`);
    } catch (error) {
      console.error("加载保存的连接失败:", error);
    }
  }
}

export const databaseConnector = new DatabaseConnector();
