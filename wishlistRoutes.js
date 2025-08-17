const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

/**
 * POST /wishlist
 * إضافة منتج إلى المفضلة (للعملاء فقط)
 */
router.post('/wishlist', authenticateToken, authorizeRoles('customer'), [
    body('productId').isInt({ gt: 0 }).withMessage('Product ID is required and must be a positive integer.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { productId } = req.body;
    const userId = req.user.id;
    try {
        await db.addToWishlist(userId, productId);
        res.status(200).json({ message: 'Product added to wishlist.' });
    } catch (err) {
        console.error('Error adding to wishlist:', err);
        res.status(500).json({ message: 'Failed to add to wishlist.' });
    }
});

/**
 * GET /wishlist
 * جلب جميع المنتجات في المفضلة (للعملاء فقط)
 */
router.get('/wishlist', authenticateToken, authorizeRoles('customer'), async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await db.query(`
            SELECT 
                w.id,
                w.product_id,
                w.created_at,
                p.name,
                p.price,
                p.image_url
            FROM wishlist w
            JOIN products p ON w.product_id = p.id
            WHERE w.user_id = $1
            ORDER BY w.created_at DESC;
        `, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching wishlist:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;