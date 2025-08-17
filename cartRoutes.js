const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

/**
 * POST /cart
 * إضافة منتج إلى السلة (للعملاء أو المسؤول)
 */
router.post('/cart', authenticateToken, authorizeRoles('customer', 'admin'), [
    body('productId').isInt({ gt: 0 }).withMessage('Product ID is required and must be a positive integer.'),
    body('quantity').isInt({ gt: 0 }).withMessage('Quantity is required and must be a positive integer.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { productId, quantity } = req.body;
    const userId = req.user.id;
    try {
        const product = await db.getProductById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        if (product.stock < quantity) {
            return res.status(400).json({ message: `Not enough stock for ${product.name}. Available: ${product.stock}` });
        }
        const cart = await db.getOrCreateCart(userId);
        const result = await db.addProductToCart(cart.id, productId, quantity);
        res.status(200).json(result);
    } catch (err) {
        console.error('Error adding product to cart:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * GET /cart
 * جلب سلة المستخدم (للعملاء أو المسؤول)
 */
router.get('/cart', authenticateToken, authorizeRoles('customer', 'admin'), async (req, res) => {
    const userId = req.user.id;
    try {
        const cart = await db.getCartByUserId(userId);
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found for this user.' });
        }
        res.json(cart);
    } catch (err) {
        console.error('Error fetching cart:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * PUT /cart/item/:id
 * تحديث كمية عنصر في السلة (للعملاء أو المسؤول)
 */
router.put('/cart/item/:id', authenticateToken, authorizeRoles('customer', 'admin'), [
    param('id').isInt().withMessage('Cart item ID must be an integer.'),
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const cartItemId = parseInt(req.params.id);
    const { quantity } = req.body;
    const userId = req.user.id;
    try {
        const cart = await db.getCartByUserId(userId);
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found for this user.' });
        }
        const cartItem = cart.items.find(item => item.cart_item_id === cartItemId);
        if (!cartItem) {
            return res.status(404).json({ message: 'Cart item not found in your cart.' });
        }
        if (quantity > 0) {
            const product = await db.getProductById(cartItem.product_id);
            if (!product) {
                return res.status(404).json({ message: 'Product associated with cart item not found.' });
            }
            if (product.stock < quantity) {
                return res.status(400).json({ message: `Not enough stock for ${product.name}. Available: ${product.stock}` });
            }
        }
        const updatedItem = await db.updateCartItemQuantity(cartItemId, quantity);
        if (!updatedItem) {
            return res.status(404).json({ message: 'Cart item not found or already removed.' });
        }
        res.json(updatedItem);
    } catch (err) {
        console.error('Error updating cart item quantity:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * DELETE /cart/item/:id
 * حذف منتج من السلة (للعملاء أو المسؤول)
 */
router.delete('/cart/item/:id', authenticateToken, authorizeRoles('customer', 'admin'), [
    param('id').isInt().withMessage('Cart item ID must be an integer.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const cartItemId = parseInt(req.params.id);
    const userId = req.user.id;
    try {
        const cart = await db.getCartByUserId(userId);
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found for this user.' });
        }
        const cartItem = cart.items.find(item => item.cart_item_id === cartItemId);
        if (!cartItem) {
            return res.status(404).json({ message: 'Cart item not found in your cart.' });
        }
        const deletedItem = await db.removeProductFromCart(cartItemId);
        if (!deletedItem) {
            return res.status(404).json({ message: 'Cart item not found.' });
        }
        res.json({ message: 'Product removed from cart successfully.', deletedItem });
    } catch (err) {
        console.error('Error removing product from cart:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * DELETE /cart/clear
 * مسح السلة بالكامل (للعملاء أو المسؤول)
 */
router.delete('/cart/clear', authenticateToken, authorizeRoles('customer', 'admin'), async (req, res) => {
    const userId = req.user.id;
    try {
        const cart = await db.getCartByUserId(userId);
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found for this user.' });
        }
        await db.clearCart(cart.id);
        res.json({ message: 'Cart cleared successfully.' });
    } catch (err) {
        console.error('Error clearing cart:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;