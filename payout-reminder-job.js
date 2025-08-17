// jobs/payout-reminder-job.js
const db = require('../db');
const { addDays } = require('../utils/date-utils');

function startPayoutReminderJob() {
  setInterval(async () => {
    console.log('🔄 تشغيل مهمة التذكير بالتحويلات...');

    try {
      const upcoming = await db.isUpcomingPayoutDue(3);
      if (upcoming) {
        const targetDate = addDays(new Date(), 3);
        const dueDate = targetDate.split('T')[0];

        const existing = await db.getUpcomingReminders(7);
        const exists = existing.some(r => r.trigger_date.startsWith(dueDate));

        if (!exists) {
          await db.createPayoutReminder(dueDate);
          console.log(`✅ تم إنشاء تذكير للتحويل بتاريخ: ${dueDate}`);
        }
      }
    } catch (err) {
      console.error('❌ خطأ في مهمة التذكير:', err);
    }
  }, 24 * 60 * 60 * 1000);
}

module.exports = { startPayoutReminderJob };