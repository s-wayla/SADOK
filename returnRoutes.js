const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

/**
 * POST /returns
 * إرسال طلب إرجاع منتج (للعملاء فقط)
 */
router.post('/returns', authenticateToken, authorizeRoles('customer'), [
    body('orderItemId').isInt({ gt: 0 }).withMessage('Order item ID is required.'),
    body('reason').trim().notEmpty().withMessage('Reason is required.'),
    body('images').optional().isArray(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { orderItemId, reason, images } = req.body;
    const userId = req.user.id;
    try {
        const returnReq = await db.requestReturn(orderItemId, userId, reason, images);
        res.status(201).json(returnReq);
    } catch (err) {
        console.error('Error creating return request:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * GET /returns
 * جلب جميع طلبات الإرجاع (للمسؤول فقط)
 */
router.get('/returns', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const returns = await db.getAllReturns();
        res.json(returns);
    } catch (err) {
        console.error('Error fetching returns:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;