// controllers/authController.js
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';
const JWT_EXPIRES_IN = '7d';

// توحيد البريد
function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

// إنشاء توكن
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// لإرجاع بيانات آمنة للمستخدم
function toSafeUser(user) {
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

module.exports = {
  // تسجيل عميل
  async registerCustomer(req, res) {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ message: 'الاسم والبريد وكلمة المرور مطلوبة.' });
      }

      const normalizedEmail = normalizeEmail(email);

      const existingUser = await db.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(400).json({ message: 'البريد الإلكتروني مسجل بالفعل.' });
      }

      const user = await db.insertUser(name, normalizedEmail, password, 'customer');
      return res.status(201).json({
        message: 'تم إنشاء حساب العميل بنجاح.',
        user: toSafeUser(user),
      });
    } catch (err) {
      console.error('Error registering customer:', err);
      return res.status(500).json({ message: 'خطأ في الخادم.' });
    }
  },

  // تسجيل بائع
  async registerVendor(req, res) {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ message: 'الاسم والبريد وكلمة المرور مطلوبة.' });
      }

      const normalizedEmail = normalizeEmail(email);

      const existingUser = await db.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(400).json({ message: 'البريد الإلكتروني مسجل بالفعل.' });
      }

      const user = await db.insertUser(name, normalizedEmail, password, 'vendor');
      return res.status(201).json({
        message: 'تم إنشاء حساب البائع بنجاح.',
        user: toSafeUser(user),
      });
    } catch (err) {
      console.error('Error registering vendor:', err);
      return res.status(500).json({ message: 'خطأ في الخادم.' });
    }
  },

  // تسجيل دخول عميل (يسمح أيضًا للأدمن)
  async loginCustomer(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: 'البريد وكلمة المرور مطلوبة.' });
      }

      const normalizedEmail = normalizeEmail(email);
      const user = await db.getUserByEmail(normalizedEmail);

      if (!user) {
        return res.status(400).json({ message: 'بيانات الدخول غير صحيحة.' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'بيانات الدخول غير صحيحة.' });
      }

      if (user.role !== 'customer' && user.role !== 'admin') {
        return res.status(403).json({ message: 'غير مصرح لك باستخدام هذا النموذج.' });
      }

      const token = generateToken(user);
      return res.json({ token, user: toSafeUser(user) });
    } catch (err) {
      console.error('Error logging in customer:', err);
      return res.status(500).json({ message: 'خطأ في الخادم.' });
    }
  },

  // تسجيل دخول بائع (يسمح أيضًا للأدمن)
  async loginVendor(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: 'البريد وكلمة المرور مطلوبة.' });
      }

      const normalizedEmail = normalizeEmail(email);
      const user = await db.getUserByEmail(normalizedEmail);

      if (!user) {
        return res.status(400).json({ message: 'بيانات الدخول غير صحيحة.' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'بيانات الدخول غير صحيحة.' });
      }

      if (user.role !== 'vendor' && user.role !== 'admin') {
        return res.status(403).json({ message: 'غير مصرح لك باستخدام هذا النموذج.' });
      }

      const token = generateToken(user);
      return res.json({ token, user: toSafeUser(user) });
    } catch (err) {
      console.error('Error logging in vendor:', err);
      return res.status(500).json({ message: 'خطأ في الخادم.' });
    }
  },
};
