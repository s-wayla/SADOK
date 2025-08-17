const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

/**
 * POST /products/:productId/reviews
 * إضافة مراجعة لمنتج (للعملاء فقط)
 */
router.post('/products/:productId/reviews', authenticateToken, authorizeRoles('customer'), [
    param('productId').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be an integer between 1 and 5.'),
    body('comment').optional().trim().notEmpty().withMessage('Comment cannot be empty if provided.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const productId = parseInt(req.params.productId);
    const { rating, comment } = req.body;
    const userId = req.user.id;
    try {
        const productExists = await db.getProductById(productId);
        if (!productExists) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        const newReview = await db.insertReview(productId, userId, rating, comment);
        res.status(201).json(newReview);
    } catch (err) {
        console.error('Error adding review:', err);
        if (err.message && err.message.includes('duplicate key value violates unique constraint')) {
            return res.status(409).json({ message: 'You have already reviewed this product. You can update your existing review.' });
        }
        res.status(500).json({ message: 'Internal server error during review creation.' });
    }
});

/**
 * GET /products/:productId/reviews
 * جلب جميع المراجعات لمنتج معين (عامة)
 */
router.get('/products/:productId/reviews', [
    param('productId').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const productId = parseInt(req.params.productId);
    try {
        const reviews = await db.getReviewsByProductId(productId);
        res.json(reviews);
    } catch (err) {
        console.error('Error fetching reviews:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * PUT /reviews/:id
 * تحديث مراجعة (لصاحب المراجعة أو المسؤول)
 */
router.put('/reviews/:id', authenticateToken, authorizeRoles('customer', 'admin'), [
    param('id').isInt({ gt: 0 }).withMessage('Review ID must be a positive integer.'),
    body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be an integer between 1 and 5.'),
    body('comment').optional().trim().notEmpty().withMessage('Comment cannot be empty if provided.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const reviewId = parseInt(req.params.id);
    const { rating, comment } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    try {
        const existingReview = await db.getReviewById(reviewId);
        if (!existingReview) {
            return res.status(404).json({ message: 'Review not found.' });
        }
        if (userRole !== 'admin' && existingReview.user_id !== userId) {
            return res.status(403).json({ message: 'Forbidden: You can only update your own reviews.' });
        }
        if (rating === undefined && comment === undefined) {
            return res.status(400).json({ message: 'No fields provided for update.' });
        }
        const updatedReview = await db.updateReview(reviewId, rating, comment);
        if (!updatedReview) {
            return res.status(404).json({ message: 'Review not found for update.' });
        }
        res.json(updatedReview);
    } catch (err) {
        console.error('Error updating review:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * DELETE /reviews/:id
 * حذف مراجعة (لصاحب المراجعة أو المسؤول)
 */
router.delete('/reviews/:id', authenticateToken, authorizeRoles('customer', 'admin'), [
    param('id').isInt({ gt: 0 }).withMessage('Review ID must be a positive integer.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const reviewId = parseInt(req.params.id);
    const userId = req.user.id;
    const userRole = req.user.role;
    try {
        const existingReview = await db.getReviewById(reviewId);
        if (!existingReview) {
            return res.status(404).json({ message: 'Review not found.' });
        }
        if (userRole !== 'admin' && existingReview.user_id !== userId) {
            return res.status(403).json({ message: 'Forbidden: You can only delete your own reviews.' });
        }
        const deletedReview = await db.deleteReview(reviewId);
        if (!deletedReview) {
            return res.status(404).json({ message: 'Review not found for deletion.' });
        }
        res.json({ message: 'Review deleted successfully.', deletedReviewId: deletedReview.id });
    } catch (err) {
        console.error('Error deleting review:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;