const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

/**
 * POST /coupons
 * إنشاء كوبون جديد (للمسؤول فقط)
 */
router.post('/coupons', authenticateToken, authorizeRoles('admin'), [
    body('code').trim().notEmpty().withMessage('Coupon code is required.'),
    body('type').isIn(['percentage', 'fixed']).withMessage('Type must be "percentage" or "fixed".'),
    body('value').isFloat({ min: 0 }).withMessage('Value must be a positive number.'),
    body('min_order_amount').optional().isFloat({ min: 0 }),
    body('usage_limit').optional().isInt({ min: 1 }),
    body('start_date').optional().isISO8601(),
    body('end_date').optional().isISO8601(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { code, type, value, min_order_amount, usage_limit, start_date, end_date } = req.body;
    try {
        const existing = await db.query('SELECT * FROM coupons WHERE code = $1', [code]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ message: 'Coupon code already exists.' });
        }
        const result = await db.query(`
            INSERT INTO coupons (code, type, value, min_order_amount, usage_limit, start_date, end_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `, [code, type, value, min_order_amount, usage_limit, start_date, end_date]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating coupon:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * POST /vendor/coupons
 * إنشاء كوبون من قبل البائع
 */
router.post('/vendor/coupons', authenticateToken, authorizeRoles('vendor'), [
    body('code').trim().notEmpty().withMessage('Coupon code is required.'),
    body('type').isIn(['percentage', 'fixed']).withMessage('Type must be "percentage" or "fixed".'),
    body('value').isFloat({ min: 0 }).withMessage('Value must be a positive number.'),
    body('min_order_amount').optional().isFloat({ min: 0 }),
    body('usage_limit').optional().isInt({ min: 1 }),
    body('start_date').optional().isISO8601(),
    body('end_date').optional().isISO8601(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { code, type, value, min_order_amount, usage_limit, start_date, end_date } = req.body;
    const vendorId = req.user.id;
    try {
        const vendor = await db.query('SELECT * FROM vendors WHERE user_id = $1', [vendorId]);
        if (vendor.rows.length === 0) {
            return res.status(400).json({ message: 'You must create a vendor store first.' });
        }
        const existing = await db.query('SELECT * FROM coupons WHERE code = $1', [code]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ message: 'Coupon code already exists.' });
        }
        const coupon = await db.createCouponForVendor(
            vendorId,
            code,
            type,
            value,
            min_order_amount,
            usage_limit,
            start_date,
            end_date
        );
        res.status(201).json(coupon);
    } catch (err) {
        console.error('Error creating vendor coupon:', err);
        res.status(500).json({ message: 'Failed to create coupon.' });
    }
});

/**
 * GET /vendor/coupons
 * جلب كوبونات البائع الحالي
 */
router.get('/vendor/coupons', authenticateToken, authorizeRoles('vendor'), async (req, res) => {
    const vendorId = req.user.id;
    try {
        const coupons = await db.getVendorCoupons(vendorId);
        res.json(coupons);
    } catch (err) {
        console.error('Error fetching vendor coupons:', err);
        res.status(500).json({ message: 'فشل في جلب الكوبونات.' });
    }
});

/**
 * GET /coupons
 * جلب جميع الكوبونات (للمسؤول فقط)
 */
router.get('/coupons', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const coupons = await db.getAllCoupons();
        res.json(coupons);
    } catch (err) {
        console.error('Error fetching coupons:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * GET /admin/vendor-coupons
 * جلب جميع كوبونات البائعين (للمسؤول فقط)
 */
router.get('/admin/vendor-coupons', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const coupons = await db.query(`
            SELECT 
                c.id,
                c.code,
                c.type,
                c.value,
                c.min_order_amount,
                c.usage_limit,
                c.start_date,
                c.end_date,
                c.is_active,
                c.created_at,
                COALESCE(v.store_name, 'N/A') AS vendor_store_name,
                COALESCE(u.name, 'Unknown') AS vendor_owner_name
            FROM coupons c
            LEFT JOIN vendor_coupons vc ON c.id = vc.coupon_id
            LEFT JOIN vendors v ON vc.vendor_id = v.id
            LEFT JOIN users u ON v.user_id = u.id
            ORDER BY c.created_at DESC;
        `);
        res.json(coupons.rows);
    } catch (err) {
        console.error('Error fetching vendor coupons for admin:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * POST /cart/apply-coupon
 * تطبيق كوبون على السلة (للعملاء فقط)
 */
router.post('/cart/apply-coupon', authenticateToken, authorizeRoles('customer'), [
    body('code').trim().notEmpty().withMessage('Coupon code is required.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { code } = req.body;
    const userId = req.user.id;
    try {
        const coupon = await db.applyCoupon(code, userId);
        res.json({ message: 'Coupon applied successfully.', coupon });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;