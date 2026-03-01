import { SQL } from "bun";
import type { DatabaseConfig, TemplateInfo, TemplateGroup } from "../types";

/**
 * 本地 SQLite 数据库存储
 * 使用 Bun 原生 SQL 模块管理连接配置、模板分组和模板数据
 */
class LocalDatabase {
  private db: InstanceType<typeof SQL>;
  private initialized = false;

  constructor() {
    this.db = new SQL({
      adapter: "sqlite",
      filename: "./data.sqlite",
    });
  }

  /** 初始化数据库表结构 */
  async init(): Promise<void> {
    if (this.initialized) return;

    // 创建连接记录表
    await this.db`
      CREATE TABLE IF NOT EXISTS connections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        host TEXT,
        port INTEGER,
        user TEXT,
        password TEXT,
        database_name TEXT NOT NULL,
        filename TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 创建模板分组表
    await this.db`
      CREATE TABLE IF NOT EXISTS template_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 创建模板表（含分组外键）
    await this.db`
      CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        filename TEXT NOT NULL,
        content TEXT NOT NULL,
        group_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES template_groups(id) ON DELETE SET NULL
      )
    `;

    this.initialized = true;
  }

  // ========== 连接配置 CRUD ==========

  async saveConnection(config: DatabaseConfig): Promise<void> {
    await this.init();
    await this.db`DELETE FROM connections WHERE id = ${config.id}`;
    await this.db`
      INSERT INTO connections (id, name, type, host, port, user, password, database_name, filename)
      VALUES (
        ${config.id},
        ${config.name},
        ${config.type},
        ${config.host || null},
        ${config.port || null},
        ${config.user || null},
        ${config.password || null},
        ${config.database},
        ${config.filename || null}
      )
    `;
  }

  async deleteConnection(id: string): Promise<boolean> {
    await this.init();
    const result = await this.db`DELETE FROM connections WHERE id = ${id}`;
    return (result as any)?.changes > 0;
  }

  async getAllConnections(): Promise<DatabaseConfig[]> {
    await this.init();
    const rows = await this.db`SELECT * FROM connections ORDER BY created_at DESC`;
    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type as DatabaseConfig["type"],
      host: row.host,
      port: row.port,
      user: row.user,
      password: row.password,
      database: row.database_name,
      filename: row.filename,
    }));
  }

  // ========== 模板分组 CRUD ==========

  async createGroup(name: string, description?: string): Promise<number> {
    await this.init();
    await this.db`
      INSERT INTO template_groups (name, description)
      VALUES (${name}, ${description || null})
    `;
    const rows = await this.db`SELECT last_insert_rowid() as id`;
    return (rows[0] as any).id;
  }

  async updateGroup(id: number, data: Partial<Pick<TemplateGroup, "name" | "description">>): Promise<boolean> {
    await this.init();
    if (data.name !== undefined) {
      await this.db`UPDATE template_groups SET name = ${data.name} WHERE id = ${id}`;
    }
    if (data.description !== undefined) {
      await this.db`UPDATE template_groups SET description = ${data.description} WHERE id = ${id}`;
    }
    return true;
  }

  async deleteGroup(id: number): Promise<boolean> {
    await this.init();
    // 先将该分组下的模板取消分组
    await this.db`UPDATE templates SET group_id = NULL WHERE group_id = ${id}`;
    const result = await this.db`DELETE FROM template_groups WHERE id = ${id}`;
    return (result as any)?.changes > 0;
  }

  async getAllGroups(): Promise<TemplateGroup[]> {
    await this.init();
    const rows = await this.db`SELECT * FROM template_groups ORDER BY id ASC`;
    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
    }));
  }

  async getGroupById(id: number): Promise<TemplateGroup | null> {
    await this.init();
    const rows = await this.db`SELECT * FROM template_groups WHERE id = ${id}`;
    if (rows.length === 0) return null;
    const row = rows[0] as any;
    return { id: row.id, name: row.name, description: row.description, createdAt: row.created_at };
  }

  // ========== 模板 CRUD ==========

  async saveTemplate(template: Omit<TemplateInfo, "id" | "createdAt" | "updatedAt" | "groupName">): Promise<void> {
    await this.init();
    await this.db`
      INSERT INTO templates (name, filename, content, group_id)
      VALUES (${template.name}, ${template.filename}, ${template.content}, ${template.groupId || null})
    `;
  }

  async updateTemplate(id: number, data: Partial<Pick<TemplateInfo, "name" | "filename" | "content" | "groupId">>): Promise<boolean> {
    await this.init();
    if (data.content !== undefined) {
      await this.db`UPDATE templates SET content = ${data.content}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
    }
    if (data.name !== undefined) {
      await this.db`UPDATE templates SET name = ${data.name}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
    }
    if (data.filename !== undefined) {
      await this.db`UPDATE templates SET filename = ${data.filename}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
    }
    if (data.groupId !== undefined) {
      await this.db`UPDATE templates SET group_id = ${data.groupId || null}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
    }
    return true;
  }

  async deleteTemplate(id: number): Promise<boolean> {
    await this.init();
    const result = await this.db`DELETE FROM templates WHERE id = ${id}`;
    return (result as any)?.changes > 0;
  }

  async getAllTemplates(groupId?: number): Promise<TemplateInfo[]> {
    await this.init();
    let rows: any[];
    if (groupId !== undefined) {
      rows = await this.db`
        SELECT t.*, g.name as group_name
        FROM templates t
        LEFT JOIN template_groups g ON t.group_id = g.id
        WHERE t.group_id = ${groupId}
        ORDER BY t.id ASC
      `;
    } else {
      rows = await this.db`
        SELECT t.*, g.name as group_name
        FROM templates t
        LEFT JOIN template_groups g ON t.group_id = g.id
        ORDER BY t.id ASC
      `;
    }
    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      filename: row.filename,
      content: row.content,
      groupId: row.group_id,
      groupName: row.group_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getTemplate(id: number): Promise<TemplateInfo | null> {
    await this.init();
    const rows = await this.db`
      SELECT t.*, g.name as group_name
      FROM templates t
      LEFT JOIN template_groups g ON t.group_id = g.id
      WHERE t.id = ${id}
    `;
    if (rows.length === 0) return null;
    const row = rows[0] as any;
    return {
      id: row.id,
      name: row.name,
      filename: row.filename,
      content: row.content,
      groupId: row.group_id,
      groupName: row.group_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getTemplateCount(): Promise<number> {
    await this.init();
    const rows = await this.db`SELECT COUNT(*) as count FROM templates`;
    return (rows[0] as any).count;
  }
}

export const localDatabase = new LocalDatabase();
