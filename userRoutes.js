const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

/**
 * GET /users
 * جلب جميع المستخدمين (للمسؤول فقط)
 */
router.get('/users', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const users = await db.getAllUsers();
        res.json(users);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * GET /users/:id
 * جلب مستخدم بواسطة ID (للمسؤول أو المستخدم نفسه)
 */
router.get('/users/:id', authenticateToken, async (req, res) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid user ID.' });
    }
    // السماح للمسؤولين أو المستخدمين بجلب بياناتهم الخاصة
    if (req.user.role !== 'admin' && req.user.id !== userId) {
        return res.status(403).json({ message: 'Forbidden: You can only view your own profile unless you are an admin.' });
    }
    try {
        const user = await db.getUserById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        const { password: _, ...userWithoutPassword } = user; // لا ترجع كلمة المرور
        res.json(userWithoutPassword);
    } catch (err) {
        console.error('Error fetching user by ID:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * PUT /users/:id
 * تحديث بيانات المستخدم (للمسؤول أو المستخدم نفسه)
 */
router.put('/users/:id', authenticateToken, [
    param('id').isInt().withMessage('User ID must be an integer.'),
    body('name').optional().trim().isLength({ min: 3 }).withMessage('Name must be at least 3 characters long.'),
    body('email').optional().isEmail().withMessage('Invalid email format.').normalizeEmail(),
    body('password').optional()
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter.')
        .matches(/[0-9]/).withMessage('Password must contain at least one number.')
        .matches(/[^A-Za-z0-9]/).withMessage('Password must contain at least one special character.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const userId = parseInt(req.params.id);
    const { name, email, password } = req.body;
    // السماح للمسؤولين أو المستخدمين بتحديث بياناتهم الخاصة
    if (req.user.role !== 'admin' && req.user.id !== userId) {
        return res.status(403).json({ message: 'Forbidden: You can only update your own profile unless you are an admin.' });
    }
    try {
        const updatedUser = await db.updateUser(userId, name, email, password);
        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found.' });
        }
        const { password: _, ...userWithoutPassword } = updatedUser;
        res.json(userWithoutPassword);
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * PUT /users/:id/role
 * تحديث دور المستخدم (للمسؤول فقط)
 */
router.put('/users/:id/role', authenticateToken, authorizeRoles('admin'), [
    param('id').isInt().withMessage('User ID must be an integer.'),
    body('role').isIn(['customer', 'vendor', 'admin']).withMessage('Invalid role. Role must be "customer", "vendor", or "admin".'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const userId = parseInt(req.params.id);
    const { role } = req.body;
    try {
        const updatedUser = await db.updateUserRole(userId, role);
        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json(updatedUser);
    } catch (err) {
        console.error('Error updating user role:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * DELETE /users/:id
 * حذف مستخدم (للمسؤول فقط)
 */
// DELETE /api/users/:id   (تحويله لأرشفة بدل حذف فعلي)
router.delete(
  '/api/users/:id',
  authenticateToken,
  authorizeRoles('admin'),
  [
    param('id').isInt().withMessage('معرّف مستخدم غير صالح.'),
    body('reason').optional().trim(),
    body('retentionDays').optional().isInt({ min: 7, max: 3650 }).withMessage('retentionDays يجب أن يكون رقمًا بين 7 و 3650.')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = parseInt(req.params.id);
    const { reason = 'account_closure', retentionDays = 90 } = req.body || {};
    try {
      const result = await db.deleteUser(userId, { reason, retentionDays }); // تؤرشف وتعلّم كمحذوف
      if (!result) return res.status(404).json({ message: 'المستخدم غير موجود.' });
      res.json({ message: 'تم أرشفة الحساب وتعليمه كمحذوف. المنتجات تم تعطيلها.', user: result });
    } catch (e) {
      console.error('archive(deleteUser) error:', e);
      res.status(500).json({ message: 'فشل في أرشفة الحساب.' });
    }
  }
);

// POST /api/users/:id/suspend
router.post(
  '/api/users/:id/suspend',
  authenticateToken,
  authorizeRoles('admin'),
  [ param('id').isInt().withMessage('معرّف مستخدم غير صالح.'), body('reason').optional().trim() ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = parseInt(req.params.id);
    const { reason = 'policy_violation' } = req.body;
    try {
      const result = await db.suspendUser(userId, reason);
      if (!result) return res.status(404).json({ message: 'المستخدم غير موجود أو غير نشط.' });
      res.json({ message: 'تم تعليق الحساب وإخفاء المنتجات.', user: result });
    } catch (e) {
      console.error('suspendUser error:', e);
      res.status(500).json({ message: 'فشل في تعليق الحساب.' });
    }
  }
);
// POST /api/users/:id/restore
router.post(
  '/api/users/:id/restore',
  authenticateToken,
  authorizeRoles('admin'),
  [ param('id').isInt().withMessage('معرّف مستخدم غير صالح.') ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = parseInt(req.params.id);
    try {
      const result = await db.restoreUser(userId);
      if (!result) return res.status(404).json({ message: 'المستخدم غير موجود.' });
      res.json({ message: 'تم استرجاع الحساب وإظهار المنتجات.', user: result });
    } catch (e) {
      console.error('restoreUser error:', e);
      res.status(500).json({ message: 'فشل في استرجاع الحساب.' });
    }
  }
);
// POST /api/users/:id/contact
router.post(
  '/api/users/:id/contact',
  authenticateToken, // يجب أن يكون المستخدم معروف (حتى لو موقوف)
  [
    param('id').isInt().withMessage('معرّف مستخدم غير صالح.'),
    body('channel').optional().isIn(['in_app','email','other']).withMessage('قناة تواصل غير صالحة.'),
    body('note').optional().isString().trim()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = parseInt(req.params.id);
    const { channel = 'in_app', note = '' } = req.body || {};
    try {
      // تأكد المستخدم نفسه هو من يتواصل أو Admin
      if (req.user.role !== 'admin' && req.user.id !== userId) {
        return res.status(403).json({ message: 'غير مصرح.' });
      }
      const result = await db.logContact(userId, channel, note);
      res.status(201).json({ message: 'تم تسجيل التواصل.', contact: result });
    } catch (e) {
      console.error('logContact error:', e);
      res.status(500).json({ message: 'فشل في تسجيل التواصل.' });
    }
  }
);
// POST /api/users/archive/sweep
router.post(
  '/api/users/archive/sweep',
  authenticateToken,
  authorizeRoles('admin'),
  async (req, res) => {
    try {
      const out = await db.sweepArchive();
      res.json({ message: 'تم تنفيذ تنظيف الأرشيف.', result: out });
    } catch (e) {
      console.error('sweepArchive error:', e);
      res.status(500).json({ message: 'فشل في تنظيف الأرشيف.' });
    }
  }
);


module.exports = router;