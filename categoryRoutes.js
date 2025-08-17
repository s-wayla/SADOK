const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

/**
 * POST /categories
 * إضافة فئة جديدة (للبائع أو المسؤول)
 */
router.post('/categories', authenticateToken, authorizeRoles('vendor', 'admin'), [
    body('name')
        .trim()
        .notEmpty().withMessage('Category name is required.')
        .isLength({ min: 2 }).withMessage('Category name must be at least 2 characters long.'),
    body('description').optional().trim(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { name, description } = req.body;
    try {
        const existingCategory = await db.getCategoryByName(name);
        if (existingCategory) {
            return res.status(409).json({ message: 'Category with this name already exists.' });
        }
        const newCategory = await db.insertCategory(name, description);
        res.status(201).json(newCategory);
    } catch (err) {
        console.error('Error adding category:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * GET /categories
 * جلب جميع الفئات (عامة - لا تتطلب مصادقة)
 */
router.get('/categories', async (req, res) => {
    try {
        const categories = await db.getAllCategories();
        res.json(categories);
    } catch (err) {
        console.error('Error fetching categories:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * GET /categories/:id
 * جلب فئة بواسطة ID (عامة)
 */
router.get('/categories/:id', [
    param('id').isInt().withMessage('Category ID must be an integer.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const categoryId = parseInt(req.params.id);
    try {
        const category = await db.getCategoryById(categoryId);
        if (!category) {
            return res.status(404).json({ message: 'Category not found.' });
        }
        res.json(category);
    } catch (err) {
        console.error('Error fetching category by ID:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * PUT /categories/:id
 * تحديث فئة (للمسؤول فقط)
 */
router.put('/categories/:id', authenticateToken, authorizeRoles('admin'), [
    param('id').isInt().withMessage('Category ID must be an integer.'),
    body('name')
        .optional()
        .trim()
        .notEmpty().withMessage('Category name cannot be empty.')
        .isLength({ min: 2 }).withMessage('Category name must be at least 2 characters long.'),
    body('description').optional().trim(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const categoryId = parseInt(req.params.id);
    const { name, description } = req.body;
    try {
        const updatedCategory = await db.updateCategory(categoryId, name, description);
        if (!updatedCategory) {
            return res.status(404).json({ message: 'Category not found.' });
        }
        res.json(updatedCategory);
    } catch (err) {
        console.error('Error updating category:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * DELETE /categories/:id
 * حذف فئة (للمسؤول فقط)
 */
router.delete('/categories/:id', authenticateToken, authorizeRoles('admin'), [
    param('id').isInt().withMessage('Category ID must be an integer.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const categoryId = parseInt(req.params.id);
    try {
        const deletedCategory = await db.deleteCategory(categoryId);
        if (!deletedCategory) {
            return res.status(404).json({ message: 'Category not found.' });
        }
        res.json({ 
            message: `Category ${deletedCategory.name} with ID ${deletedCategory.id} deleted successfully.` 
        });
    } catch (err) {
        console.error('Error deleting category:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;