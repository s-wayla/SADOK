const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

/**
 * POST /orders
 * إنشاء طلب جديد من السلة (للعملاء أو المسؤول)
 */
router.post('/orders', authenticateToken, authorizeRoles('customer', 'admin'), [
    body('shippingAddress').trim().notEmpty().withMessage('Shipping address is required.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { shippingAddress } = req.body;
    const userId = req.user.id;
    try {
        const newOrder = await db.createOrder(userId, shippingAddress);
        res.status(201).json(newOrder);
    } catch (err) {
        console.error('Error creating order:', err);
        if (err.message.includes('Not enough stock')) {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: 'Internal server error during order creation.' });
    }
});


/**
 * POST /checkout
 * ✅ إتمام الشراء (تحويل السلة إلى طلب)
 */
router.post('/checkout', authenticateToken, authorizeRoles('customer'), [
    body('shippingAddress').trim().notEmpty().withMessage('Shipping address is required.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const userId = req.user.id;
    const { shippingAddress } = req.body;
    try {
        // ⬅️ استخدام دالة db.createOrderFromCart الجديدة
        const orderDetails = await db.createOrderFromCart(userId, shippingAddress);
        if (!orderDetails) {
            return res.status(400).json({ message: 'Cart is empty or order creation failed.' });
        }
        res.status(201).json({ message: 'Order created successfully!', orderDetails });
    } catch (err) {
        console.error('Error during checkout:', err);
        // ⬅️ التعامل مع خطأ انتهاء الفترة التجريبية
        if (err.message.includes('trial period')) {
            return res.status(403).json({ message: err.message });
        }
        res.status(500).json({ message: 'Internal server error.' });
    }
});


/**
 * GET /orders
 * جلب جميع الطلبات (للمسؤول فقط)
 */
router.get('/orders', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const orders = await db.getAllOrders();
        res.json(orders);
    } catch (err) {
        console.error('Error fetching all orders:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * GET /orders/user
 * جلب طلبات المستخدم الحالي (للمستخدمين العاديين)
 */
router.get('/orders/user', authenticateToken, authorizeRoles('customer'), async (req, res) => {
    const userId = req.user.id;
    try {
        const orders = await db.getOrdersByUserId(userId);
        res.json(orders);
    } catch (err) {
        console.error('Error fetching user orders:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * GET /orders/vendor
 * جلب طلبات البائع الحالي (للبائعين)
 */
router.get('/orders/vendor', authenticateToken, authorizeRoles('vendor'), async (req, res) => {
    const vendorId = req.user.id;
    try {
        const orders = await db.getOrdersByVendorId(vendorId);
        res.json(orders);
    } catch (err) {
        console.error('Error fetching vendor orders:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});


/**
 * GET /orders/:id
 * جلب تفاصيل طلب محدد
 */
router.get('/orders/:id', authenticateToken, authorizeRoles('customer', 'vendor', 'admin'), async (req, res) => {
    const orderId = req.params.id;
    try {
        const orderDetails = await db.getOrderDetails(orderId);
        if (!orderDetails) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        // التحقق من صلاحية الوصول
        if (req.user.role === 'customer' && orderDetails.user_id !== req.user.id) {
            return res.status(403).json({ message: 'Forbidden: You do not have permission to view this order.' });
        }
        if (req.user.role === 'vendor' && !orderDetails.vendors.some(v => v.id === req.user.id)) {
            return res.status(403).json({ message: 'Forbidden: You do not have permission to view this order.' });
        }
        res.json(orderDetails);
    } catch (err) {
        console.error('Error fetching order details:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});


/**
 * PUT /orders/:id/status
 * تحديث حالة الطلب (للمسؤول أو البائع)
 */
router.put('/orders/:id/status', authenticateToken, authorizeRoles('vendor', 'admin'), async (req, res) => {
    const { status } = req.body;
    const orderId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;
    if (!status) {
        return res.status(400).json({ message: 'Status is required.' });
    }
    try {
        const order = await db.getOrderById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        if (userRole === 'admin') {
            const updatedOrder = await db.updateOrderStatus(orderId, status);
            return res.json(updatedOrder);
        }
        if (userRole === 'vendor') {
            const isVendorOrder = await db.isOrderForVendor(orderId, userId);
            if (!isVendorOrder) {
                return res.status(403).json({ message: 'Forbidden. You do not have permission to update this order.' });
            }
            const updatedOrder = await db.updateOrderStatus(orderId, status);
            return res.json(updatedOrder);
        }
        return res.status(403).json({ message: 'Forbidden. You do not have the required role to access this resource.' });
    } catch (err) {
        console.error('Error updating order status:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;