// routes/newAdminRoutes.js - مسارات لوحة المسؤول (محدثة)
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

// ===================================================================
// ✅ إدارة إعدادات المتجر
// ===================================================================

/**
 * GET /admin/settings
 * جلب جميع إعدادات المتجر (للمسؤول فقط)
 */
router.get('/settings', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const settings = await db.getSiteSettings();
    res.json(settings);
  } catch (err) {
    console.error('Error fetching admin settings:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * POST /admin/settings
 * تحديث إعداد معين (للمسؤول فقط)
 */
router.post('/settings', authenticateToken, authorizeRoles('admin'), [
  body('site_name').optional().trim().notEmpty(),
  body('email').optional().isEmail(),
  body('phone').optional().trim(),
  body('currency').optional().trim().isIn(['SAR', 'USD', 'EUR']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { site_name, email, phone, currency } = req.body;

  try {
    const updated = await db.updateSiteSettings(site_name, email, phone, currency);
    res.json(updated);
  } catch (err) {
    console.error('Error updating setting:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// ===================================================================
// ✅ إدارة خطط الاشتراك
// ===================================================================

/**
 * GET /admin/subscription-plans
 * جلب جميع خطط الاشتراك (للمسؤول فقط)
 */
router.get('/subscription-plans', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const plans = await db.getAllSubscriptionPlans();
    res.json(plans);
  } catch (err) {
    console.error('Error fetching subscription plans:', err);
    res.status(500).json({ message: 'فشل في جلب خطط الاشتراك.' });
  }
});

/**
 * POST /admin/subscription-plans
 * إنشاء خطة اشتراك جديدة (للمسؤول فقط)
 */
router.post('/subscription-plans', authenticateToken, authorizeRoles('admin'), [
  body('name').trim().notEmpty().withMessage('اسم الخطة مطلوب.'),
  body('description').optional().trim(),
  body('original_price').isFloat({ min: 0 }).withMessage('السعر الأصلي يجب أن يكون رقمًا موجبًا.'),
  body('discount_type').optional().isIn(['percentage', 'fixed', null]).withMessage('نوع الخصم غير صالح.'),
  body('discount_value').optional().isFloat({ min: 0 }).withMessage('قيمة الخصم يجب أن تكون رقمًا موجبًا.'),
  body('billing_cycle').isIn(['monthly', 'quarterly', 'semi-annual', 'annual']).withMessage('دورة الفوترة غير صالحة.'),
  body('duration_months').isInt({ min: 1, max: 12 }).withMessage('مدة الخطة بالأشهر يجب أن تكون بين 1 و 12.'),
  body('features').optional().isArray().withMessage('المزايا يجب أن تكون مصفوفة.'),
  body('is_featured').optional().isBoolean(),
  body('sort_order').optional().isInt(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    name,
    description,
    original_price,
    discount_type,
    discount_value,
    billing_cycle,
    duration_months,
    features,
    is_featured,
    sort_order
  } = req.body;

  try {
    const newPlan = await db.createSubscriptionPlan({
      name,
      description,
      original_price,
      discount_type,
      discount_value,
      billing_cycle,
      duration_months,
      features,
      is_featured,
      sort_order
    });

    res.status(201).json({
      message: 'تم إنشاء خطة الاشتراك بنجاح.',
      plan: newPlan
    });
  } catch (err) {
    console.error('Error creating subscription plan:', err);
    res.status(500).json({ message: 'فشل في إنشاء الخطة.' });
  }
});

/**
 * PUT /admin/subscription-plans/:id
 * تعديل خطة اشتراك موجودة (للمسؤول فقط)
 */
router.put('/subscription-plans/:id', authenticateToken, authorizeRoles('admin'), [
  param('id').isInt().withMessage('معرّف الخطة غير صالح.'),
  body('name').optional().trim().notEmpty(),
  body('description').optional().trim(),
  body('original_price').optional().isFloat({ min: 0 }),
  body('discount_type').optional().isIn(['percentage', 'fixed', null]),
  body('discount_value').optional().isFloat({ min: 0 }),
  body('billing_cycle').optional().isIn(['monthly', 'quarterly', 'semi-annual', 'annual']),
  body('duration_months').optional().isInt({ min: 1, max: 12 }),
  body('features').optional().isArray(),
  body('is_featured').optional().isBoolean(),
  body('sort_order').optional().isInt(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const id = parseInt(req.params.id);
  const updateData = req.body;

  try {
    const updatedPlan = await db.updateSubscriptionPlan(id, updateData);
    if (!updatedPlan) {
      return res.status(404).json({ message: 'الخطة غير موجودة.' });
    }

    res.json({
      message: 'تم تحديث الخطة بنجاح.',
      plan: updatedPlan
    });
  } catch (err) {
    console.error('Error updating subscription plan:', err);
    res.status(500).json({ message: 'فشل في تحديث الخطة.' });
  }
});

/**
 * DELETE /admin/subscription-plans/:id
 * إيقاف تفعيل خطة اشتراك (للمسؤول فقط)
 * (لا يُحذف من قاعدة البيانات، بل يُعطّل فقط)
 */
router.delete('/subscription-plans/:id', authenticateToken, authorizeRoles('admin'), [
  param('id').isInt().withMessage('معرّف الخطة غير صالح.'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const id = parseInt(req.params.id);

  try {
    const result = await db.deleteSubscriptionPlan(id);
    if (!result) {
      return res.status(404).json({ message: 'الخطة غير موجودة.' });
    }

    res.json({
      message: 'تم إيقاف تفعيل الخطة بنجاح.',
      plan: result
    });
  } catch (err) {
    console.error('Error deactivating subscription plan:', err);
    res.status(500).json({ message: 'فشل في إيقاف التفعيل.' });
  }
});
router.get('/vendors/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await db.query(`
      SELECT 
        v.id,
        v.store_name,
        v.description,
        v.logo_url,
        v.created_at,
        u.name AS owner_name,
        u.email AS owner_email
      FROM vendors v
      JOIN users u ON v.user_id = u.id
      WHERE v.id = $1;
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching vendor by ID:', err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;