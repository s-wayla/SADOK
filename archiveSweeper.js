// jobs/archiveSweeper.js
const cron = require('node-cron');
const db = require('../db');

// الجدولة: كل يوم الساعة 03:00 صباحًا (حسب توقيت السيرفر)
function startArchiveSweeper() {
  cron.schedule('0 3 * * *', async () => {
    try {
      await db.sweepArchive();
      console.log('[archiveSweeper] ✅ archive sweep done');
    } catch (e) {
      console.error('[archiveSweeper] ❌ failed:', e);
    }
  });
}

module.exports = { startArchiveSweeper };
