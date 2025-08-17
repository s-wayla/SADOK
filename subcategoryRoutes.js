const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

/**
 * POST /subcategories
 * إضافة قسم فرعي جديد (للمسؤول فقط)
 */
router.post('/subcategories', authenticateToken, authorizeRoles('admin'), [
    body('name').trim().notEmpty().withMessage('Subcategory name is required.'),
    body('category_id').isInt({ gt: 0 }).withMessage('Category ID must be a positive integer.'),
    body('description').optional().trim(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { name, description, category_id } = req.body;
    try {
        const categoryExists = await db.getCategoryById(category_id);
        if (!categoryExists) {
            return res.status(400).json({ message: 'Invalid category ID.' });
        }
        const existingSubcategory = await db.getSubcategoryByNameAndCategory(name, category_id);
        if (existingSubcategory) {
            return res.status(409).json({ message: 'Subcategory with this name already exists in this category.' });
        }
        const newSubcategory = await db.insertSubcategory(name, description, category_id);
        res.status(201).json(newSubcategory);
    } catch (err) {
        console.error('Error creating subcategory:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * GET /subcategories
 * جلب جميع الأقسام الفرعية (عامة)
 */
router.get('/subcategories', async (req, res) => {
    try {
        const subcategories = await db.getAllSubcategories();
        res.json(subcategories);
    } catch (error) {
        console.error('Error fetching subcategories:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /categories/:categoryId/subcategories
 * جلب الأقسام الفرعية لفئة معينة
 */
router.get('/categories/:categoryId/subcategories', [
    param('categoryId').isInt({ gt: 0 }).withMessage('Category ID must be a positive integer.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { categoryId } = req.params;
    try {
        const subcategories = await db.getSubcategoriesByCategoryId(categoryId);
        res.json(subcategories);
    } catch (error) {
        console.error('Error fetching subcategories:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /subcategories/:id
 * تحديث قسم فرعي (للمسؤول فقط)
 */
router.put('/subcategories/:id', authenticateToken, authorizeRoles('admin'), [
    param('id').isInt({ gt: 0 }).withMessage('Subcategory ID must be a positive integer.'),
    body('name').optional().trim().notEmpty().withMessage('Subcategory name cannot be empty.'),
    body('description').optional().trim(),
    body('category_id').optional().isInt({ gt: 0 }).withMessage('Category ID must be a positive integer.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const subcategoryId = parseInt(req.params.id);
    const { name, description, category_id: categoryId } = req.body;
    try {
        const existingSubcategory = await db.getSubcategoryById(subcategoryId);
        if (!existingSubcategory) {
            return res.status(404).json({ message: 'Subcategory not found.' });
        }
        if (name || categoryId) {
            const checkName = name || existingSubcategory.name;
            const checkCategoryId = categoryId || existingSubcategory.category_id;
            if (name !== existingSubcategory.name || categoryId !== existingSubcategory.category_id) {
                const duplicate = await db.getSubcategoryByNameAndCategory(checkName, checkCategoryId);
                if (duplicate && duplicate.id !== subcategoryId) {
                    return res.status(409).json({ message: 'A subcategory with this name already exists in the selected category.' });
                }
            }
        }
        if (categoryId) {
            const categoryExists = await db.getCategoryById(categoryId);
            if (!categoryExists) {
                return res.status(400).json({ message: 'Invalid category ID.' });
            }
        }
        const updatedSubcategory = await db.updateSubcategory(
            subcategoryId,
            name !== undefined ? name : existingSubcategory.name,
            description !== undefined ? description : existingSubcategory.description,
            categoryId !== undefined ? categoryId : existingSubcategory.category_id
        );
        res.json(updatedSubcategory);
    } catch (err) {
        console.error('Error updating subcategory:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * DELETE /subcategories/:id
 * حذف قسم فرعي (للمسؤول فقط)
 */
router.delete('/subcategories/:id', authenticateToken, authorizeRoles('admin'), [
    param('id').isInt({ gt: 0 }).withMessage('Subcategory ID must be a positive integer.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const subcategoryId = parseInt(req.params.id);
    try {
        const existingSubcategory = await db.getSubcategoryById(subcategoryId);
        if (!existingSubcategory) {
            return res.status(404).json({ message: 'Subcategory not found.' });
        }
        const deletedSubcategory = await db.deleteSubcategory(subcategoryId);
        res.json({
            message: `Subcategory "${deletedSubcategory.name}" with ID ${deletedSubcategory.id} deleted successfully.`,
            deletedSubcategoryId: deletedSubcategory.id
        });
    } catch (err) {
        console.error('Error deleting subcategory:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;