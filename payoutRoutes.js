const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

/**
 * GET /payouts
 * جلب جميع دفعات البائعين (للمسؤول فقط)
 */
router.get('/payouts', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const payouts = await db.getAllPayouts();
        res.json(payouts);
    } catch (err) {
        console.error('Error fetching payouts:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * POST /payouts
 * إنشاء دفعة جديدة للبائع (للمسؤول فقط)
 */
router.post('/payouts', authenticateToken, authorizeRoles('admin'), [
    body('vendorId').isInt({ gt: 0 }).withMessage('Vendor ID must be a positive integer.'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number.'),
    body('method').trim().notEmpty().withMessage('Payment method is required.'),
    body('status').optional().isIn(['pending', 'completed', 'failed']).withMessage('Status must be pending, completed, or failed.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { vendorId, amount, method, status = 'pending' } = req.body;
    try {
        const newPayout = await db.createPayout(vendorId, amount, method, status);
        res.status(201).json(newPayout);
    } catch (err) {
        console.error('Error creating payout:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * GET /vendors/:vendorId/payouts
 * جلب جميع دفعات بائع معين (للمسؤول أو البائع نفسه)
 */
router.get('/vendors/:vendorId/payouts', authenticateToken, [
    param('vendorId').isInt({ gt: 0 }).withMessage('Vendor ID must be a positive integer.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const vendorId = parseInt(req.params.vendorId);
    const userId = req.user.id;
    const userRole = req.user.role;
    try {
        // إذا كان البائع، تحقق من أن الـ vendorId يطابق متجره
        if (userRole === 'vendor') {
            const vendor = await db.query('SELECT id FROM vendors WHERE user_id = $1', [userId]);
            if (vendor.rows.length === 0 || vendor.rows[0].id !== vendorId) {
                return res.status(403).json({ message: 'Forbidden: You can only view your own payouts.' });
            }
        }
        const payouts = await db.getPayoutsByVendorId(vendorId);
        res.json(payouts);
    } catch (err) {
        console.error('Error fetching vendor payouts:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;