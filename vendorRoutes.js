// routes/vendorRoutes.js
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const onboardingController = require('../controllers/onboardingController');
const { createVendor } = require('../controllers/vendorController');


// --- تكوين Multer ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    if (!allowed.includes(ext)) {
      return cb(new Error('Only images are allowed'), false);
    }
    const uniqueName = `img_${Date.now()}_${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only images are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// ... (بقية المسارات كما هي)

/**
 * POST /vendor
 * إنشاء متجر بائع جديد (مُعدّل ليدعم رفع الصور بأمان)
 */
router.post('/vendor', authenticateToken, authorizeRoles('vendor'), upload.single('profileImage'), [
    body('storeName').trim().notEmpty().withMessage('اسم المتجر مطلوب.'),
    body('country').trim().notEmpty().withMessage('الدولة مطلوبة.'),
    body('lat').isFloat().withMessage('خط العرض مطلوب.'),
    body('lng').isFloat().withMessage('خط الطول مطلوب.'),
    body('contractName').trim().notEmpty().withMessage('الاسم في العقد مطلوب.'),
    body('contractIdNumber').trim().notEmpty().withMessage('رقم الهوية مطلوب.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    // سيتم معالجته في controller
    await createVendor(req, res);
});
/**
 * GET /vendor/profile
 * جلب ملف تعريف البائع (للبائع فقط)
 */
router.get('/vendor/profile', authenticateToken, authorizeRoles('vendor'), async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await db.query(`
            SELECT 
                id,
                store_name,
                description,
                logo_url,
                cover_image_url,
                COALESCE(total_sales, 0) AS total_sales,
                created_at,
                updated_at
            FROM vendors 
            WHERE user_id = $1
        `, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Vendor profile not found.' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching vendor profile:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * PUT /vendor/profile
 * تحديث ملف تعريف البائع (للبائع فقط)
 */
router.put('/vendor/profile', authenticateToken, authorizeRoles('vendor'), [
    body('storeName').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('logoUrl').optional().isURL(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { storeName, description, logoUrl } = req.body;
    const userId = req.user.id;
    try {
        const vendor = await db.query('SELECT * FROM vendors WHERE user_id = $1', [userId]);
        if (vendor.rows.length === 0) {
            return res.status(404).json({ message: 'Vendor profile not found.' });
        }
        let vendorSlug = vendor.rows[0].store_slug;
        if (storeName && storeName !== vendor.rows[0].store_name) {
            vendorSlug = storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        }
        const result = await db.query(`
            UPDATE vendors SET 
                store_name = COALESCE($1, store_name),
                description = COALESCE($2, description),
                logo_url = COALESCE($3, logo_url),
                store_slug = $4,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $5
            RETURNING *;
        `, [storeName, description, logoUrl, vendorSlug, userId]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating vendor profile:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * GET /vendors
 * جلب جميع البائعين (للمسؤول فقط)
 */
router.get('/vendors', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const vendors = await db.getAllVendors();
        res.json(vendors);
    } catch (err) {
        console.error('Error fetching vendors:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * GET /vendors/:vendorId/products
 * جلب منتجات بائع معين (للبائع نفسه أو المسؤول)
 */
router.get('/vendors/:vendorId/products', authenticateToken, authorizeRoles('vendor', 'admin'), [
    param('vendorId').isInt().withMessage('Vendor ID must be an integer.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const vendorId = parseInt(req.params.vendorId);
    if (req.user.role === 'vendor' && req.user.id !== vendorId) {
        return res.status(403).json({ message: 'Forbidden: You can only view your own products.' });
    }
    try {
        const products = await db.getProductsByVendorId(vendorId);
        res.json(products);
    } catch (err) {
        console.error('Error fetching vendor products:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * GET /vendors/:vendorId/orders
 * جلب طلبات بائع معين (للبائع نفسه أو المسؤول)
 */
router.get('/vendors/:vendorId/orders', authenticateToken, authorizeRoles('vendor', 'admin'), [
    param('vendorId').isInt().withMessage('Vendor ID must be an integer.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const vendorId = parseInt(req.params.vendorId);
    if (req.user.role === 'vendor' && req.user.id !== vendorId) {
        return res.status(403).json({ message: 'Forbidden: You can only view your own orders.' });
    }
    try {
        const orders = await db.getOrdersByVendorId(vendorId);
        res.json(orders);
    } catch (err) {
        console.error('Error fetching vendor orders:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * GET /vendor/orders
 * جلب جميع طلبات البائع الحالي
 */
router.get('/vendor/orders', authenticateToken, authorizeRoles('vendor'), async (req, res) => {
    const vendorId = req.user.id;
    try {
        const orders = await db.getOrdersByVendorId(vendorId);
        res.json(orders);
    } catch (err) {
        console.error('Error fetching orders for vendor:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * GET /vendors/:id
 * جلب بيانات بائع بواسطة ID (بدون مصادقة، لاستخدامه في "ملفي" في لوحة التحكم)
 */
router.get('/vendors/:id', async (req, res) => {
  const userId = req.params.id; // ← رقم المستخدم، ليس رقم البائع
  try {
    const result = await db.query(`
      SELECT 
        v.id AS vendor_id,
        v.store_name,
        v.description,
        v.logo_url,
        v.created_at,
        u.name AS owner_name,
        u.email AS owner_email
      FROM vendors v
      JOIN users u ON v.user_id = u.id
      WHERE u.id = $1; -- ← تأكد أن الشرط على u.id وليس v.id
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.serror('Error fetching vendor by ID:', err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===================================================================
// ✅ مسارات نظام الاشتراكات الجديد
// ===================================================================

/**
 * GET /subscription-plans
 * جلب جميع خطط الاشتراك النشطة (متاح للجميع)
 */
router.get('/subscription-plans', async (req, res) => {
  try {
    const plans = await db.getAllSubscriptionPlans();
    res.json(plans);
  } catch (err) {
    console.error('Error fetching subscription plans:', err);
    res.status(500).json({ message: 'فشل في جلب خطط الاشتراك.' });
  }
});

/**
 * POST /subscribe
 * اشتراك البائع في خطة (للبائع فقط)
 */
router.post('/subscribe', authenticateToken, authorizeRoles('vendor'), [
  body('planId').isInt().withMessage('رقم الخطة غير صالح.'),
  body('paymentMethod').trim().notEmpty().withMessage('طريقة الدفع مطلوبة.'),
  body('transactionId').trim().notEmpty().withMessage('رقم العملية مطلوب.'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { planId, paymentMethod, transactionId } = req.body;
  const userId = req.user.id;

  try {
    // جلب vendor_id من جدول vendors
    const vendorRes = await db.query('SELECT id FROM vendors WHERE user_id = $1', [userId]);
    if (vendorRes.rows.length === 0) {
      return res.status(404).json({ message: 'البائع غير موجود.' });
    }
    const vendorId = vendorRes.rows[0].id;

    // الاشتراك
    const subscription = await db.subscribeVendor(vendorId, planId, paymentMethod, transactionId);

    res.status(201).json({
      message: 'تم الاشتراك بنجاح.',
      subscription
    });
  } catch (err) {
    console.error('Error subscribing vendor:', err);
    res.status(500).json({ message: 'فشل في عملية الاشتراك.' });
  }
});

/**
 * GET /my-subscription
 * جلب اشتراك البائع الحالي (للبائع فقط)
 */
router.get('/my-subscription', authenticateToken, authorizeRoles('vendor'), async (req, res) => {
  const userId = req.user.id;
  try {
    const vendorRes = await db.query('SELECT id FROM vendors WHERE user_id = $1', [userId]);
    if (vendorRes.rows.length === 0) {
      return res.status(404).json({ message: 'البائع غير موجود.' });
    }
    const vendorId = vendorRes.rows[0].id;

    const subscription = await db.getVendorSubscription(vendorId);
    if (!subscription) {
      return res.status(404).json({ message: 'لا يوجد اشتراك نشط.' });
    }

    res.json(subscription);
  } catch (err) {
    console.error('Error fetching vendor subscription:', err);
    res.status(500).json({ message: 'خطأ داخلي.' });
  }
});

/**
 * POST /cancel-subscription
 * إلغاء اشتراك البائع (للبائع فقط)
 */
router.post('/cancel-subscription', authenticateToken, authorizeRoles('vendor'), async (req, res) => {
  const userId = req.user.id;
  try {
    const vendorRes = await db.query('SELECT id FROM vendors WHERE user_id = $1', [userId]);
    if (vendorRes.rows.length === 0) {
      return res.status(404).json({ message: 'البائع غير موجود.' });
    }
    const vendorId = vendorRes.rows[0].id;

    const sub = await db.getVendorSubscription(vendorId);
    if (!sub) {
      return res.status(404).json({ message: 'لا يوجد اشتراك نشط.' });
    }

    const result = await db.cancelVendorSubscription(sub.id);
    res.json({ message: 'تم إلغاء الاشتراك بنجاح.', subscription: result });
  } catch (err) {
    console.error('Error cancelling subscription:', err);
    res.status(500).json({ message: 'خطأ داخلي.' });
  }
});

// POST /upgrade-subscription
router.post('/upgrade-subscription', authenticateToken, authorizeRoles('vendor'), [
  body('planId').isInt().withMessage('رقم الخطة غير صالح.'),
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

    // جلب بيانات الاشتراك الحالي للبائع
    const currentSubscription = await db.getVendorSubscription(vendorId);
    if (!currentSubscription) {
        return res.status(400).json({ message: 'لا يوجد اشتراك نشط للترقية منه.' });
    }

    // جلب سعر الخطة الجديدة
    const newPlanRes = await db.query('SELECT price FROM subscription_plans WHERE id = $1', [planId]);
    if (newPlanRes.rows.length === 0) {
        return res.status(404).json({ message: 'الخطة الجديدة غير موجودة.' });
    }
    
    // ✅ تصحيح: تحويل الأسعار إلى أرقام قبل المقارنة
    const newPlanPrice = parseFloat(newPlanRes.rows[0].price);
    const currentPlanPrice = parseFloat(currentSubscription.price);
    
    if (newPlanPrice <= currentPlanPrice) {
        return res.status(400).json({ message: `لا يمكن الترقية إلى باقة سعرها ${newPlanPrice} لأنها أقل أو تساوي سعر باقتك الحالية (${currentPlanPrice}).` });
    }

    // إذا كان السعر أكبر، يتم المتابعة لإجراء الترقية
    const result = await db.upgradeVendorSubscription(vendorId, planId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ... (بقية المسارات)
// 🟢 جلب بيانات اشتراك البائع الحالي
// ✅ تم تعديل هذا المسار ليطابق ما تتوقعه الواجهة الأمامية تمامًا.
// routes/vendorRoutes.js - المسار الصحيح
router.get('/subscription', authenticateToken, authorizeRoles('vendor'), async (req, res) => {
  try {
    const userId = req.user.id;

    // ✅ جلب vendor_id باستخدام user_id
    const vendorRes = await db.query('SELECT id FROM vendors WHERE user_id = $1', [userId]);
    if (vendorRes.rows.length === 0) {
      return res.status(404).json(null);
    }
    const vendorId = vendorRes.rows[0].id; // ✅ الآن لديك vendorId الصحيح

    // استخدام vendorId الصحيح لجلب الاشتراك
    const subscription = await db.getVendorSubscription(vendorId);

    if (!subscription) {
      return res.status(404).json(null);
    }

    res.json(subscription);
  } catch (err) {
    console.error('Error fetching vendor subscription:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});
// حالة البائع بعد تسجيل الدخول
router.get('/vendor/status',
  authenticateToken,
  authorizeRoles('vendor','admin'),
  onboardingController.getVendorStatus
);

// توقيع العقد وإنشاؤه
router.post('/vendor/contract/sign',
  authenticateToken,
  authorizeRoles('vendor','admin'),
  onboardingController.signContract
);

module.exports = router;