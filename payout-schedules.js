// db/payout-schedules.js
// نظام جدولة التحويلات الشهرية
const { pool } = require('./connection');
const { addDays } = require('../utils/date-utils'); // سأشرحه لاحقًا

/**
 * إنشاء جدول تحويل شهري جديد
 * @param {Date} dueDate - التاريخ القادم (مثلاً: 2025-04-05)
 */
async function createPayoutSchedule(dueDate) {
  const query = `
    INSERT INTO payout_schedules (due_date)
    VALUES ($1)
    ON CONFLICT (due_date) DO NOTHING
    RETURNING *;
  `;
  const result = await pool.query(query, [dueDate]);
  return result.rows[0];
}

/**
 * جلب الجدول القادم (الذي لم يُكتمل بعد)
 */
async function getNextPayoutSchedule() {
  const query = `
    SELECT * FROM payout_schedules
    WHERE status = 'pending' AND due_date >= CURRENT_DATE
    ORDER BY due_date ASC
    LIMIT 1;
  `;
  const result = await pool.query(query);
  return result.rows[0];
}

/**
 * جلب جميع جداول التحويلات
 */
async function getAllPayoutSchedules() {
  const query = `SELECT * FROM payout_schedules ORDER BY due_date DESC;`;
  const result = await pool.query(query);
  return result.rows;
}

/**
 * تحديث حالة الجدول إلى "مكتمل"
 * @param {Date} dueDate
 * @param {number} totalVendors
 * @param {number} totalAmount
 */
async function completePayoutSchedule(dueDate, totalVendors, totalAmount) {
  const query = `
    UPDATE payout_schedules
    SET status = 'completed',
        total_vendors = $1,
        total_amount = $2,
        completed_at = NOW()
    WHERE due_date = $3 AND status = 'pending'
    RETURNING *;
  `;
  const result = await pool.query(query, [totalVendors, totalAmount, dueDate]);
  return result.rows[0];
}

/**
 * التحقق مما إذا كان هناك تحويل قريب (لعرض التذكير)
 * @param {number} daysBefore - كم يوم قبل التحويل (مثلاً: 3)
 */
async function isUpcomingPayoutDue(daysBefore) {
  const targetDate = addDays(new Date(), daysBefore); // مثلاً: بعد 3 أيام
  const query = `
    SELECT EXISTS(
      SELECT 1 FROM payout_schedules
      WHERE status = 'pending'
        AND due_date = $1::date
    );
  `;
  const result = await pool.query(query, [targetDate]);
  return result.rows[0].exists;
}

/**
 * جلب الجدول حسب التاريخ
 * @param {Date} dueDate
 */
async function getPayoutScheduleByDate(dueDate) {
  const query = `SELECT * FROM payout_schedules WHERE due_date = $1;`;
  const result = await pool.query(query, [dueDate]);
  return result.rows[0];
}

module.exports = {
  createPayoutSchedule,
  getNextPayoutSchedule,
  getAllPayoutSchedules,
  completePayoutSchedule,
  isUpcomingPayoutDue,
  getPayoutScheduleByDate,
};