// db/reminders.js
// نظام التذكيرات للمسؤول (مثلاً: "لا تنسَ تحويل الأرباح")
const { pool } = require('./connection');

/**
 * إنشاء تذكير جديد
 * @param {Object} reminder - { title, message, trigger_date, user_type }
 */
async function createReminder(reminder) {
  const { title, message, trigger_date, user_type = 'admin' } = reminder;

  const query = `
    INSERT INTO reminders (title, message, trigger_date, user_type)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;

  const values = [title, message, trigger_date, user_type];
  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * جلب جميع التذكيرات النشطة (التي لم يمضَ عليها التاريخ بعد أو اليوم)
 */
async function getActiveReminders() {
  const query = `
    SELECT * FROM reminders
    WHERE trigger_date >= CURRENT_DATE - INTERVAL '1 day'
      AND is_read = FALSE
    ORDER BY trigger_date ASC;
  `;
  const result = await pool.query(query);
  return result.rows;
}

/**
 * جلب التذكيرات القادمة (في الأيام القليلة القادمة)
 * @param {number} daysAhead - كم يوم قُدمًا (مثلاً: 7)
 */
async function getUpcomingReminders(daysAhead = 7) {
  const query = `
    SELECT * FROM reminders
    WHERE trigger_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '$1 days'
      AND is_read = FALSE
    ORDER BY trigger_date ASC;
  `;
  const result = await pool.query(query, [daysAhead]);
  return result.rows;
}

/**
 * علامة "تم القراءة" على تذكير
 * @param {number} id
 */
async function markReminderAsRead(id) {
  const query = `
    UPDATE reminders
    SET is_read = TRUE
    WHERE id = $1 OR trigger_date <= CURRENT_DATE
    RETURNING *;
  `;
  const result = await pool.query(query, [id]);
  return result.rows;
}

/**
 * حذف تذكير (نادرًا)
 * @param {number} id
 */
async function deleteReminder(id) {
  const query = `DELETE FROM reminders WHERE id = $1 RETURNING *;`;
  const result = await pool.query(query, [id]);
  return result.rows[0];
}

/**
 * إنشاء تذكير تلقائي للتحويل الشهري
 * (تُستدعى عند إنشاء جدول تحويل)
 */
async function createPayoutReminder(scheduleDate, daysBefore = 3) {
  const reminderDate = new Date(scheduleDate);
  reminderDate.setDate(reminderDate.getDate() - daysBefore);

  return await createReminder({
    title: "تذكير: موعد تحويل أرباح البائعين",
    message: `موعد التحويل الشهري يحين في ${scheduleDate}. لا تنسَ التحقق من البائعين المؤهلين وبدء التحويل.`,
    trigger_date: reminderDate,
    user_type: 'admin'
  });
}

/**
 * جلب جميع التذكيرات (للمسؤول)
 */
async function getAllReminders() {
  const query = `SELECT * FROM reminders ORDER BY trigger_date DESC;`;
  const result = await pool.query(query);
  return result.rows;
}

module.exports = {
  createReminder,
  getActiveReminders,
  getUpcomingReminders,
  markReminderAsRead,
  deleteReminder,
  createPayoutReminder,
  getAllReminders,
};