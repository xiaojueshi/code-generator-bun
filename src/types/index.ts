/** 支持的数据库类型 */
export type DatabaseType = "mysql" | "postgres" | "sqlite";

/** 数据源连接配置 */
export interface DatabaseConfig {
  id: string;
  name: string;
  type: DatabaseType;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database: string;
  filename?: string; // 仅 SQLite 使用
}

/** 表字段信息 */
export interface TableColumn {
  name: string; // 字段名称
  originalName: string; // 原始字段名称
  dataType: string; // 数据类型
  comment: string; // 字段注释
  isNullable: boolean; // 是否可为空
  defaultValue?: any; // 默认值
  isSelected: boolean; // 是否选中生成
  order: number; // 排序
}

/** 表信息 */
export interface TableInfo {
  name: string; // 表名
  comment?: string; // 表注释
  columns: TableColumn[]; // 字段列表
}

/** 模板分组 */
export interface TemplateGroup {
  id: number;
  name: string;       // 分组名称
  description?: string; // 分组描述
  createdAt?: string;
}

/** 模板信息 */
export interface TemplateInfo {
  id: number;
  name: string; // 模板名称（如 "index"）
  filename: string; // 输出文件名（如 "index.vue"）
  content: string; // 模板内容
  groupId?: number; // 所属分组 ID
  groupName?: string; // 所属分组名称（查询时 JOIN）
  createdAt?: string;
  updatedAt?: string;
}

