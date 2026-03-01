/**
 * 字符串处理工具函数
 */

/**
 * 清理字符串中的换行符、回车符和其他可能导致模板渲染错误的特殊字符
 */
export const cleanString = (str: string | undefined | null): string => {
  if (!str) return "";

  return str
    .replace(/\r\n/g, " ")
    .replace(/\n/g, " ")
    .replace(/\r/g, " ")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * 转义特殊字符，防止 HTML 和 JavaScript 注入
 */
export const escapeHtml = (str: string | undefined | null): string => {
  if (!str) return "";

  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};
