// routes/adminRoutes.js
const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

// ------------------------------
// إدارة وسائل الدفع
// ------------------------------

// GET /api/admin/payout-methods
router.get('/payout-methods', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const methods = await db.getAllPayoutMethods();
    res.json(methods);
  } catch (err) {
    console.error('Error fetching payout methods:', err);
    res.status(500).json({ message: 'فشل في جلب وسائل الدفع' });
  }
});

// POST /api/admin/payout-methods
router.post('/payout-methods', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const method = await db.createPayoutMethod(req.body);
    res.status(201).json(method);
  } catch (err) {
    console.error('Error creating payout method:', err);
    res.status(500).json({ message: 'فشل في إنشاء وسيلة الدفع' });
  }
});

// PATCH /api/admin/payout-methods/:slug/toggle
router.patch('/payout-methods/:slug/toggle', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { slug } = req.params;
  const { is_active } = req.body;
  try {
    const method = await db.togglePayoutMethod(slug, is_active);
    res.json(method);
  } catch (err) {
    console.error('Error toggling payout method:', err);
    res.status(500).json({ message: 'فشل في تحديث حالة وسيلة الدفع' });
  }
});

// ------------------------------
// العقود الموقعّة
// ------------------------------

// GET /api/admin/contracts
router.get('/contracts', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const contracts = await db.getAllVendorContracts();
    res.json(contracts);
  } catch (err) {
    console.error('Error fetching contracts:', err);
    res.status(500).json({ message: 'فشل في جلب العقود' });
  }
});

// ------------------------------
// جدولة التحويلات
// ------------------------------

// GET /api/admin/payout-schedules
router.get('/payout-schedules', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const schedules = await db.getAllPayoutSchedules();
    res.json(schedules);
  } catch (err) {
    console.error('Error fetching payout schedules:', err);
    res.status(500).json({ message: 'فشل في جلب جدول التحويلات' });
  }
});

// ------------------------------
// التذكيرات
// ------------------------------

// GET /api/admin/reminders
router.get('/reminders', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const reminders = await db.getActiveReminders();
    res.json(reminders);
  } catch (err) {
    console.error('Error fetching reminders:', err);
    res.status(500).json({ message: 'فشل في جلب التذكيرات' });
  }
});

// PATCH /api/admin/reminders/:id/read
router.patch('/reminders/:id/read', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    await db.markReminderAsRead(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking reminder as read:', err);
    res.status(500).json({ message: 'فشل في تحديث التذكير' });
  }
});

// ------------------------------
// محفظة البائعين
// ------------------------------

// GET /api/admin/vendor-wallets
router.get('/vendor-wallets', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const wallets = await db.query(`
      SELECT 
        vw.vendor_id,
        v.store_name,
        vw.balance,
        vw.pending_balance,
        vw.payout_method,
        vw.last_payout_date
      FROM vendor_wallets vw
      JOIN vendors v ON vw.vendor_id = v.id
      ORDER BY vw.balance DESC;
    `);
    res.json(wallets.rows);
  } catch (err) {
    console.error('Error fetching vendor wallets:', err);
    res.status(500).json({ message: 'فشل في جلب المحافظ' });
  }
});

module.exports = router;