const express = require('express');
const { body,validationResult } = require('express-validator');
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

/**
 * GET /settings
 * جلب إعدادات الموقع (عامة)
 */
router.get('/settings', async (req, res) => {
    try {
        const settings = await db.getSiteSettings();
        res.json(settings);
    } catch (err) {
        console.error('Error fetching settings:', err);
        res.status(500).json({ message: 'Failed to fetch settings.' });
    }
});

/**
 * PUT /settings
 * تحديث إعدادات الموقع (للمسؤول فقط)
 */
router.put('/settings', authenticateToken, authorizeRoles('admin'), [
    body('site_name').optional().trim(),
    body('email').optional().isEmail(),
    body('phone').optional().trim(),
    body('currency').optional().trim(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { site_name, email, phone, currency } = req.body;
    try {
        const updatedSettings = await db.updateSiteSettings(site_name, email, phone, currency);
        res.json(updatedSettings);
    } catch (err) {
        console.error('Error updating settings:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});
router.get('/api/settings/archive-retention', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const settings = await db.getSiteSettings(); // دالتك الحالية
    const days = settings?.archive_retention_days ?? 90;
    res.json({ archive_retention_days: Number(days) });
  } catch (e) {
    console.error('get archive_retention_days error:', e);
    res.status(500).json({ message: 'فشل في جلب الإعداد.' });
  }
});

// تحديث مدة الاحتفاظ
router.put(
  '/api/settings/archive-retention',
  authenticateToken,
  authorizeRoles('admin'),
  [body('days').isInt({ min: 7, max: 3650 }).withMessage('الأيام يجب أن تكون بين 7 و 3650.')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { days } = req.body;
    try {
      // احصل على الإعدادات الحالية ثم حدّثها
      const current = await db.getSiteSettings();
      const updated = { ...(current || {}), archive_retention_days: Number(days) };
      await db.updateSiteSettings(updated); // دالتك الحالية
      res.json({ message: 'تم تحديث مدة الاحتفاظ.', archive_retention_days: Number(days) });
    } catch (e) {
      console.error('update archive_retention_days error:', e);
      res.status(500).json({ message: 'فشل في تحديث الإعداد.' });
    }
  }
);

module.exports = router;