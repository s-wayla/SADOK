/**
 * date-utils.js
 * وظائف مساعدة للتعامل مع التواريخ
 */

/**
 * إضافة أيام إلى تاريخ
 * @param {Date|string} date - التاريخ الأصلي
 * @param {number} days - عدد الأيام المراد إضافتها
 * @returns {string} - التاريخ الجديد بصيغة YYYY-MM-DD
 */
function addDays(date, days) {
  const result = new Date(date);
  if (isNaN(result.getTime())) {
    throw new Error('Invalid date provided');
  }
  result.setDate(result.getDate() + days);
  return result.toISOString().split('T')[0]; // تنسيق: YYYY-MM-DD
}

/**
 * تنسيق التاريخ إلى نص مقروء
 * @param {Date|string} date
 * @param {string} locale - مثلاً: 'ar-SA', 'en-US'
 * @returns {string}
 */
function formatDate(date, locale = 'ar-SA') {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error('Invalid date provided');
  }
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(d);
}

/**
 * التحقق مما إذا كان التاريخ في المستقبل
 * @param {Date|string} date
 * @returns {boolean}
 */
function isFutureDate(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  return d > new Date();
}

/**
 * التحقق مما إذا كان التاريخ في الماضي
 * @param {Date|string} date
 * @returns {boolean}
 */
function isPastDate(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  return d < new Date();
}

/**
 * الحصول على اليوم الحالي بصيغة YYYY-MM-DD
 * @returns {string}
 */
function today() {
  return new Date().toISOString().split('T')[0];
}

module.exports = {
  addDays,
  formatDate,
  isFutureDate,
  isPastDate,
  today
};