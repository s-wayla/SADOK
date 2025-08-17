const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

/**
 * POST /products
 * ✅ إضافة منتج جديد (للبائع أو المسؤول)
 */
router.post('/products', authenticateToken, authorizeRoles('vendor', 'admin'), [
    body('name')
        .trim()
        .notEmpty().withMessage('Product name is required.')
        .isLength({ min: 3 }).withMessage('Product name must be at least 3 characters long.'),
    body('description').optional().trim(),
    body('price').isFloat({ gt: 0 }).withMessage('Price must be a positive number.'),
    body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer.'),
    body('imageUrl').optional().isURL().withMessage('Invalid image URL format.'),
    body('categoryId').optional().isInt({ gt: 0 }).withMessage('Category ID must be a positive integer.'),
    body('subcategoryId').optional().isInt({ gt: 0 }).withMessage('Subcategory ID must be a positive integer if provided.'),
    body('vendorId')
        .optional()
        .isInt({ gt: 0 }).withMessage('Vendor ID must be a positive integer if provided.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { name, description, price, stock, imageUrl, categoryId, subcategoryId, vendorId } = req.body;

    const finalVendorId = req.user.role === 'admin' && vendorId ? vendorId : req.user.id;

    try {
        // ⬅️ دالة insertProduct الجديدة تقوم بالتحقق من حالة الاشتراك
        const newProduct = await db.insertProduct(name, description, price, stock, imageUrl, finalVendorId, categoryId, subcategoryId);
        res.status(201).json(newProduct);
    } catch (err) {
        console.error('Error adding product:', err);
        // ⬅️ التعامل مع خطأ انتهاء الفترة التجريبية
        if (err.message.includes('trial period')) {
            return res.status(403).json({ message: err.message });
        }
        res.status(500).json({ message: 'Internal server error.' });
    }
});


/**
 * GET /products
 * جلب جميع المنتجات
 */
router.get('/products', async (req, res) => {
    try {
        const products = await db.getAllProducts();
        res.json(products);
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * GET /products/:id
 * جلب منتج حسب الـ ID
 */
router.get('/products/:id', [
    param('id').isInt({ gt: 0 }).withMessage('Product ID must be an integer.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const product = await db.getProductById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        res.json(product);
    } catch (err) {
        console.error('Error fetching product:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * GET /products/vendor/:vendorId
 * جلب منتجات بائع معين
 */
router.get('/products/vendor/:vendorId', [
    param('vendorId').isInt({ gt: 0 }).withMessage('Vendor ID must be an integer.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const products = await db.getProductsByVendorId(req.params.vendorId);
        res.json(products);
    } catch (err) {
        console.error('Error fetching vendor products:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * PUT /products/:id
 * تحديث منتج (للبائع أو المسؤول)
 */
router.put('/products/:id', authenticateToken, authorizeRoles('vendor', 'admin'), [
    param('id').isInt({ gt: 0 }).withMessage('Product ID must be an integer.'),
    body('name').optional().trim().notEmpty().withMessage('Product name cannot be empty.'),
    body('description').optional().trim().notEmpty().withMessage('Product description cannot be empty.'),
    body('price').optional().isFloat({ gt: 0 }).withMessage('Price must be a positive number.'),
    body('stock').optional().isInt({ gt: -1 }).withMessage('Stock must be a non-negative integer.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const productId = req.params.id;
    const { name, description, price, stock, imageUrl, categoryId, subcategoryId } = req.body;
    try {
        const product = await db.getProductById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        if (req.user.role === 'vendor' && product.vendor_id !== req.user.id) {
            return res.status(403).json({ message: 'Forbidden: You do not own this product.' });
        }
        const updatedProduct = await db.updateProduct(productId, name, description, price, stock, imageUrl, categoryId, subcategoryId);
        res.json(updatedProduct);
    } catch (err) {
        console.error('Error updating product:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * DELETE /products/:id
 * حذف منتج (للبائع أو المسؤول)
 */
router.delete('/products/:id', authenticateToken, authorizeRoles('vendor', 'admin'), [
    param('id').isInt({ gt: 0 }).withMessage('Product ID must be an integer.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const productId = req.params.id;
    try {
        const product = await db.getProductById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        if (req.user.role === 'vendor' && product.vendor_id !== req.user.id) {
            return res.status(403).json({ message: 'Forbidden: You do not own this product.' });
        }
        await db.deleteProduct(productId);
        res.json({ message: 'Product deleted successfully.' });
    } catch (err) {
        console.error('Error deleting product:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * POST /products/:productId/images
 * إضافة صورة لمنتج (للبائع أو المسؤول)
 */
router.post('/products/:productId/images', authenticateToken, authorizeRoles('vendor', 'admin'), [
    body('imageUrl').isURL().withMessage('Valid image URL is required.'),
    body('isPrimary').optional().isBoolean(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { imageUrl, isPrimary = false } = req.body;
    const productId = parseInt(req.params.productId);
    try {
        const product = await db.getProductById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        if (req.user.role === 'vendor' && product.vendor_id !== req.user.id) {
            return res.status(403).json({ message: 'You can only add images to your own products.' });
        }
        const image = await db.addProductImage(productId, imageUrl, isPrimary);
        res.status(201).json(image);
    } catch (err) {
        console.error('Error adding product image:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;