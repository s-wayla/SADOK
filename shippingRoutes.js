const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

/**
 * GET /shipping-methods
 * جلب جميع وسائل الشحن النشطة (عامة)
 */
router.get('/shipping-methods', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM shipping_methods WHERE is_active = TRUE;');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching shipping methods:', err);
        res.status(500).json({ message: 'Failed to fetch shipping methods.' });
    }
});

/**
 * POST /shipping-methods
 * إضافة وسيلة شحن جديدة (للمسؤول فقط)
 */
router.post('/shipping-methods', authenticateToken, authorizeRoles('admin'), [
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('cost').isFloat({ min: 0 }).withMessage('Cost must be a positive number.'),
    body('estimated_days').optional().trim(),
    body('is_active').optional().isBoolean(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { name, cost, estimated_days, is_active } = req.body;
    try {
        const newMethod = await db.insertShippingMethod(name, cost, estimated_days, is_active);
        res.status(201).json(newMethod);
    } catch (err) {
        console.error('Error creating shipping method:', err);
        res.status(500).json({ message: 'Failed to create shipping method.' });
    }
});

module.exports = router;