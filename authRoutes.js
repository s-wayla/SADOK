const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// تسجيل عميل
router.post('/register/customer', authController.registerCustomer);

// تسجيل بائع
router.post('/register/vendor', authController.registerVendor);

// تسجيل دخول عميل (يسمح أيضًا للأدمن)
router.post('/login/customer', authController.loginCustomer);

// تسجيل دخول بائع (يسمح أيضًا للأدمن)
router.post('/login/vendor', authController.loginVendor);

module.exports = router;
