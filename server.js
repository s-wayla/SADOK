const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const db = require('./db');
const path = require('path');


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// إعداد قراءة JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// إعداد CORS مع دعم الكوكيز والتوكن
app.use(cors({
  origin: 'http://localhost:5173', // عدلها إذا كان عندك دومين آخر
  credentials: true
}));

// إنشاء الجداول عند بدء التشغيل
db.createTables().catch(err => {
  console.error('فشل في إنشاء الجداول:', err);
  process.exit(1);
});

// --
//----------------------------
// استيراد جميع المسارات
// ------------------------------
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const subcategoryRoutes = require('./routes/subcategoryRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const couponRoutes = require('./routes/couponRoutes');
const messageRoutes = require('./routes/messageRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const shippingRoutes = require('./routes/shippingRoutes');
const payoutRoutes = require('./routes/payoutRoutes');
const returnRoutes = require('./routes/returnRoutes');
const adminStatsRoutes = require('./routes/adminStatsRoutes');
const adminPlansRoutes = require('./routes/adminPlans');
const adminRoutes = require('./routes/adminRoutes');

// ------------------------------
// استخدام المسارات
// ------------------------------
app.use(express.static('public'));
app.use('/api/auth', authRoutes); // 🔹 تسجيل وتسجيل الدخول
app.use(userRoutes);
app.use(vendorRoutes);
app.use(categoryRoutes);
app.use(subcategoryRoutes);
app.use(productRoutes);
app.use(cartRoutes);
app.use(orderRoutes);
app.use(reviewRoutes);
app.use(couponRoutes);
app.use(messageRoutes);
app.use(wishlistRoutes);
app.use(settingsRoutes);
app.use(shippingRoutes);
app.use(payoutRoutes);
app.use(returnRoutes);
app.use('/api/admin/stats', adminStatsRoutes);
app.use('/api/admin/plans', adminPlansRoutes);
app.use('/contracts', express.static('contracts'));
app.use('/uploads', express.static('uploads'));
app.use('/api/admin', adminRoutes);
app.use('/contracts', express.static(path.join(__dirname, 'contracts')));

// ------------------------------
// صفحة ترحيب
// ------------------------------
app.get('/', (req, res) => {
  res.send('مرحبًا بكم في واجهة برمجة تطبيق السوق متعدد البائعين!');
});
// تشغيل مهمة التنظيف اليومي للأرشيف
const { startArchiveSweeper } = require('./jobs/archiveSweeper');
startArchiveSweeper();

// ------------------------------
// تشغيل الخادم
// ------------------------------
app.listen(PORT, () => {
  console.log(`✅ الخادم يعمل على المنفذ ${PORT}`);
  console.log(`🔗 ابدأ باستخدام: http://localhost:${PORT}`);
});
