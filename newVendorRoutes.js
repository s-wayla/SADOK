// routes/newVendorRoutes.js - مسارات البائعين (الجديدة) - محدثة
const express = require('express');
const { body, param, validationResult } = require('express-validator'); // ✅ تمت إضافة validationResult هنا
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

// --- جلب جميع خطط الاشتراك ---
router.get('/subscription-plans', async (req, res) => {
  try {
    const plans = await db.getAllSubscriptionPlans();
    if (!plans || plans.length === 0) {
      return res.status(404).json({ message: 'لا توجد خطط متاحة حاليًا.' });
    }
    res.json(plans);
  } catch (err) {
    console.error('Error fetching subscription plans:', err);
    res.status(500).json({ message: 'فشل في جلب خطط الاشتراك.' });
  }
});

// --- جلب اشتراك البائع الحالي ---
// --- جلب اشتراك البائع الحالي ---
// --- جلب اشتراك البائع الحالي ---
// routes/newVendorRoutes.js
router.get('/my-subscription', authenticateToken, authorizeRoles('vendor'), async (req, res) => {
  const userId = req.user.id;
  try {
    const vendorRes = await db.query('SELECT id FROM vendors WHERE user_id = $1', [userId]);
    if (vendorRes.rows.length === 0) {
      return res.status(404).json({ message: 'البائع غير موجود.' });
    }
    const vendorId = vendorRes.rows[0].id;

    const subRes = await db.query(`
      SELECT 
        vs.id,
        vs.start_date,
        vs.end_date,
        vs.status,
        sp.name AS plan_name,
        sp.final_price AS amount,
        sp.billing_cycle,
        sp.has_support,
        sp.has_promotion,
        sp.description,
        sp.duration_months
      FROM vendor_subscriptions vs
      JOIN subscription_plans sp ON vs.plan_id = sp.id
      WHERE vs.vendor_id = $1 AND vs.status = 'active'
      ORDER BY vs.start_date DESC
      LIMIT 1;
    `, [vendorId]);

    if (subRes.rows.length === 0) {
      return res.status(404).json({ message: 'لا يوجد اشتراك نشط.' });
    }

    res.json(subRes.rows[0]);
  } catch (err) {
    console.error('Error fetching vendor subscription:', err);
    res.status(500).json({ message: 'خطأ داخلي.' });
  }
});

// --- الاشتراك في خطة ---
router.post('/subscribe', authenticateToken, authorizeRoles('vendor'), [
  body('planId').isInt({ min: 1 }).withMessage('رقم الخطة غير صالح.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { planId } = req.body;
  const userId = req.user.id;

  try {
    // التحقق من وجود البائع
    const vendorRes = await db.query('SELECT id FROM vendors WHERE user_id = $1', [userId]);
    if (vendorRes.rows.length === 0) {
      return res.status(404).json({ message: 'البائع غير موجود.' });
    }
    const vendorId = vendorRes.rows[0].id;

    // جلب الخطة
    const planRes = await db.query(`
      SELECT 
        id, 
        name, 
        final_price, 
        billing_cycle, 
        duration_months,
        features
      FROM subscription_plans 
      WHERE id = $1 AND is_active = TRUE
    `, [planId]);

    if (planRes.rows.length === 0) {
      return res.status(404).json({ message: 'الخطة غير موجودة أو غير نشطة.' });
    }
    const plan = planRes.rows[0];

    // حساب تاريخ الانتهاء
    const endDate = plan.duration_months
      ? `NOW() + INTERVAL '${plan.duration_months} months'`
      : null;

    // إلغاء أي اشتراك نشط أولاً (لضمان واحد فقط)
    await db.query(`
      UPDATE vendor_subscriptions 
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
      WHERE vendor_id = $1 AND status = 'active';
    `, [vendorId]);

    // إنشاء الاشتراك
    const subRes = await db.query(`
      INSERT INTO vendor_subscriptions (vendor_id, plan_id, start_date, end_date, status)
      VALUES ($1, $2, NOW(), ${endDate}, 'active')
      RETURNING id, start_date, end_date, status;
    `, [vendorId, plan.id]);

    // إرجاع البيانات الكاملة
    res.status(201).json({
      message: 'تم الاشتراك بنجاح.',
      subscription: {
        ...subRes.rows[0],
        plan_name: plan.name,
        amount: plan.final_price,
        billing_cycle: plan.billing_cycle,
        features: plan.features
      }
    });
  } catch (err) {
    console.error('Error subscribing vendor:', err);
    res.status(500).json({ message: 'فشل في عملية الاشتراك.' });
  }
});

// --- ترقية الاشتراك (بدون إلغاء) ---
router.post('/upgrade-subscription', authenticateToken, authorizeRoles('vendor'), [
  body('planId').isInt({ min: 1 }).withMessage('رقم الخطة غير صالح.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { planId } = req.body;
  const userId = req.user.id;

  try {
    const vendorRes = await db.query('SELECT id FROM vendors WHERE user_id = $1', [userId]);
    if (vendorRes.rows.length === 0) {
      return res.status(404).json({ message: 'البائع غير موجود.' });
    }
    const vendorId = vendorRes.rows[0].id;

    // جلب الخطة الجديدة
    const newPlanRes = await db.query(`
      SELECT id, name, final_price, billing_cycle, duration_months, features
      FROM subscription_plans
      WHERE id = $1 AND is_active = TRUE
    `, [planId]);

    if (newPlanRes.rows.length === 0) {
      return res.status(404).json({ message: 'الخطة غير موجودة أو غير نشطة.' });
    }
    const newPlan = newPlanRes.rows[0];

    // جلب الاشتراك الحالي
    const currentSubRes = await db.query(`
      SELECT vs.*, sp.final_price AS current_amount
      FROM vendor_subscriptions vs
      JOIN subscription_plans sp ON vs.plan_id = sp.id
      WHERE vs.vendor_id = $1 AND vs.status = 'active'
    `, [vendorId]);

    if (currentSubRes.rows.length > 0) {
      const currentSub = currentSubRes.rows[0];

      // ✅ منع التخفيض
      if (newPlan.final_price <= currentSub.current_amount) {
        return res.status(400).json({ message: 'يمكنك الترقية إلى خطة أعلى سعرًا فقط.' });
      }
    }

    // تحديث الاشتراك (لا يتم إنشاء واحد جديد)
    const endDate = newPlan.duration_months
      ? `NOW() + INTERVAL '${newPlan.duration_months} months'`
      : null;

    // أولاً: إلغاء الاشتراك النشط
    await db.query(`
      UPDATE subscriptions 
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
      WHERE vendor_id = $1 AND status = 'active';
    `, [vendorId]);

    // ثانيًا: إنشاء اشتراك جديد
    const newSubRes = await db.query(`
      INSERT INTO subscriptions (vendor_id, plan_id, start_date, end_date, status)
      VALUES ($1, $2, NOW(), ${endDate}, 'active');
    `, [vendorId, newPlan.id]);

    res.json({
      message: 'تم ترقية الاشتراك بنجاح.',
      difference: newPlan.final_price - (currentSubRes.rows[0]?.current_amount || 0),
      newPlan: newPlan,
      subscription: newSubRes.rows[0]
    });
  } catch (err) {
    console.error('Error upgrading subscription:', err);
    res.status(500).json({ message: 'فشل في ترقية الاشتراك.' });
  }
});
// routes/newVendorRoutes.js


// ❌ تم حذف /cancel-subscription حسب متطلباتك
// لا يمكن للبائع إلغاء اشتراكه، فقط الترقية

module.exports = router;