// routes/adminPlans.js - مسارات إدارة خطط الاشتراك والميزات (مُعدّل بالكامل لدعم نموذج اشتراك ضخم)
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

// ------------------------------
// 🔧 إدارة الميزات
// ------------------------------

// 🔹 جلب جميع الميزات
router.get('/features', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const features = await db.getAllFeatures();
    res.json(features);
  } catch (err) {
    console.error('Error fetching features:', err);
    res.status(500).json({ message: 'فشل في جلب الميزات.' });
  }
});

// 🔹 إضافة ميزة جديدة
router.post('/features', authenticateToken, authorizeRoles('admin'), [
  body('name').trim().notEmpty().withMessage('اسم الميزة مطلوب.'),
  body('type').isIn(['boolean', 'number', 'text', 'select']).withMessage('نوع الميزة غير صالح.'),
  body('description').optional().trim(),
  body('options').optional().isArray().withMessage('يجب أن تكون الخيارات مصفوفة.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, type, description, options } = req.body;

  try {
    const feature = await db.createFeature({
      name,
      type,
      description,
      options
    });

    res.status(201).json({
      message: 'تم إضافة الميزة بنجاح.',
      feature
    });
  } catch (err) {
    console.error('Error creating feature:', err);
    res.status(500).json({ message: 'فشل في إضافة الميزة.' });
  }
});

// 🔹 تعديل ميزة
router.put('/features/:id', authenticateToken, authorizeRoles('admin'), [
  param('id').isInt().withMessage('معرّف غير صالح.'),
  body('name').optional().trim().notEmpty(),
  body('type').optional().isIn(['boolean', 'number', 'text', 'select']),
  body('description').optional().trim(),
  body('options').optional().isArray()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const id = parseInt(req.params.id);
  const updateData = req.body;

  try {
    const feature = await db.updateFeature(id, updateData);
    if (!feature) {
      return res.status(404).json({ message: 'الميزة غير موجودة.' });
    }

    res.json({
      message: 'تم تعديل الميزة بنجاح.',
      feature
    });
  } catch (err) {
    console.error('Error updating feature:', err);
    res.status(500).json({ message: 'فشل في تعديل الميزة.' });
  }
});

// 🔹 حذف ميزة
router.delete('/features/:id', authenticateToken, authorizeRoles('admin'), [
  param('id').isInt().withMessage('معرّف غير صالح.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const id = parseInt(req.params.id);

  try {
    const result = await db.deleteFeature(id);
    if (!result) {
      return res.status(404).json({ message: 'الميزة غير موجودة.' });
    }

    res.json({
      message: 'تم حذف الميزة بنجاح.',
      feature: result
    });
  } catch (err) {
    console.error('Error deleting feature:', err);
    res.status(500).json({ message: 'فشل في حذف الميزة.' });
  }
});

// ------------------------------
// 📋 إدارة خطط الاشتراك
// ------------------------------

// 🔹 جلب جميع الخطط مع الميزات
router.get('/subscription-plans', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const plans = await db.getAllSubscriptionPlans();
    res.json(plans);
  } catch (err) {
    console.error('Error fetching subscription plans:', err);
    res.status(500).json({ message: 'فشل في جلب خطط الاشتراك.' });
  }
});

// 🔹 إنشاء خطة اشتراك جديدة (مُعدّلة لدعم جميع الحقول)
router.post('/subscription-plans', authenticateToken, authorizeRoles('admin'), [
  body('name').trim().notEmpty().withMessage('اسم الخطة مطلوب.'),
  body('price').isFloat({ min: 0 }).withMessage('السعر الشهري يجب أن يكون رقمًا موجبًا.'),
  body('annual_price').optional().isFloat({ min: 0 }).withMessage('السعر السنوي يجب أن يكون رقمًا موجبًا.'),
  body('sales_fee').isFloat({ min: 0, max: 100 }).withMessage('نسبة العمولة يجب أن تكون بين 0 و 100.'),
  body('max_products').optional().isInt({ min: 0 }).withMessage('عدد المنتجات يجب أن يكون رقمًا صحيحًا.'),
  body('max_variants_per_product').optional().isInt({ min: 0 }).withMessage('عدد المتغيرات يجب أن يكون رقمًا صحيحًا.'),
  body('custom_domain').optional().isBoolean().withMessage('custom_domain يجب أن يكون true أو false.'),
  body('custom_theme').optional().isBoolean(),
  body('advanced_reports').optional().isBoolean(),
  body('support_level').optional().isIn(['محدود', '24/7', 'لا يوجد']).withMessage('مستوى الدعم غير صالح.'),
  body('staff_accounts').optional().isInt({ min: 1 }).withMessage('عدد الحسابات يجب أن يكون 1 على الأقل.'),
  body('coupons').optional().isBoolean(),
  body('api_access').optional().isBoolean(),
  body('csv_import_export').optional().isBoolean(),
  body('marketing_tools').optional().isBoolean(),
  body('color').optional().isIn(['blue', 'green', 'purple', 'orange', 'red']),
  body('description').optional().trim(),
  body('is_active').optional().isBoolean(),
  body('order').optional().isInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    name,
    price,
    annual_price,
    sales_fee,
    max_products,
    max_variants_per_product,
    custom_domain,
    custom_theme,
    advanced_reports,
    support_level,
    staff_accounts,
    coupons,
    api_access,
    csv_import_export,
    marketing_tools,
    color,
    description,
    is_active,
    order
  } = req.body;

  try {
    const plan = await db.createSubscriptionPlan({
      name,
      price,
      annual_price,
      sales_fee,
      max_products,
      max_variants_per_product,
      custom_domain,
      custom_theme,
      advanced_reports,
      support_level,
      staff_accounts,
      coupons,
      api_access,
      csv_import_export,
      marketing_tools,
      color: color || 'blue',
      description,
      is_active,
      order
    });

    res.status(201).json({
      message: 'تم إنشاء الخطة بنجاح.',
      plan
    });
  } catch (err) {
    console.error('Error creating subscription plan:', err);
    res.status(500).json({ message: 'فشل في إنشاء الخطة.' });
  }
});

// 🔹 تعديل خطة (مُعدّلة لدعم جميع الحقول)
router.put('/subscription-plans/:id', authenticateToken, authorizeRoles('admin'), [
  param('id').isInt().withMessage('معرّف غير صالح.'),
  body('name').optional().trim().notEmpty(),
  body('price').optional().isFloat({ min: 0 }),
  body('annual_price').optional().isFloat({ min: 0 }),
  body('sales_fee').optional().isFloat({ min: 0, max: 100 }),
  body('max_products').optional().isInt({ min: 0 }),
  body('max_variants_per_product').optional().isInt({ min: 0 }),
  body('custom_domain').optional().isBoolean(),
  body('custom_theme').optional().isBoolean(),
  body('advanced_reports').optional().isBoolean(),
  body('support_level').optional().isIn(['محدود', '24/7', 'لا يوجد']),
  body('staff_accounts').optional().isInt({ min: 1 }),
  body('coupons').optional().isBoolean(),
  body('api_access').optional().isBoolean(),
  body('csv_import_export').optional().isBoolean(),
  body('marketing_tools').optional().isBoolean(),
  body('color').optional().isIn(['blue', 'green', 'purple', 'orange', 'red']),
  body('description').optional().trim(),
  body('is_active').optional().isBoolean(),
  body('order').optional().isInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const id = parseInt(req.params.id);
  const updateData = req.body;

  try {
    const plan = await db.updateSubscriptionPlan(id, updateData);
    if (!plan) {
      return res.status(404).json({ message: 'الخطة غير موجودة.' });
    }

    res.json({
      message: 'تم تحديث الخطة بنجاح.',
      plan
    });
  } catch (err) {
    console.error('Error updating subscription plan:', err);
    res.status(500).json({ message: 'فشل في تحديث الخطة.' });
  }
});

// 🔹 حذف خطة (إيقاف التفعيل)
router.delete('/subscription-plans/:id', authenticateToken, authorizeRoles('admin'), [
  param('id').isInt().withMessage('معرّف غير صالح.')
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
    res.status(500).json({ message: 'فشل في إيقاف الخطة.' });
  }
});

// ------------------------------
// 🔗 ربط الميزات بالخطط (للميزات الإضافية النادرة)
// ------------------------------

// 🔹 إضافة ميزة إلى خطة
router.post('/subscription-plans/:planId/features', authenticateToken, authorizeRoles('admin'), [
  body('featureId').isInt().withMessage('معرّف الميزة غير صالح.'),
  body('value').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const planId = parseInt(req.params.planId);
  const { featureId, value } = req.body;

  try {
    const result = await db.addFeatureToPlan(planId, featureId, value);
    res.status(201).json({
      message: 'تم ربط الميزة بالخطة بنجاح.',
      feature: result
    });
  } catch (err) {
    console.error('Error adding feature to plan:', err);
    res.status(500).json({ message: 'فشل في ربط الميزة بالخطة.' });
  }
});

// 🔹 إزالة ميزة من خطة
router.delete('/subscription-plans/:planId/features/:featureId', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const planId = parseInt(req.params.planId);
  const featureId = parseInt(req.params.featureId);

  try {
    const result = await db.removeFeatureFromPlan(planId, featureId);
    if (!result) {
      return res.status(404).json({ message: 'الارتباط غير موجود.' });
    }

    res.json({
      message: 'تم إزالة الميزة من الخطة بنجاح.',
      feature: result
    });
  } catch (err) {
    console.error('Error removing feature from plan:', err);
    res.status(500).json({ message: 'فشل في إزالة الميزة من الخطة.' });
  }
});

module.exports = router;