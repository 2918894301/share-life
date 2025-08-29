/**
 * 通用工具函数库
 * 包含各种常用的工具方法
 */

/**
 * 格式化评论时间
 * 显示格式：当年显示 MM-DD，跨年显示 YYYY-MM-DD
 * @param {string} dateString - 日期字符串
 * @returns {string} 格式化后的时间字符串
 */
function formatCommentTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const now = new Date();
  const currentYear = now.getFullYear();
  const commentYear = date.getFullYear();
  return commentYear === currentYear ? `${month}-${day}` : `${commentYear}-${month}-${day}`;
}

// 导出函数供其他文件使用
module.exports = {
  formatCommentTime
};
