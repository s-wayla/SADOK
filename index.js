// db/index.js - نقطة الدخول الموحدة لقاعدة البيانات
// يتم استيراده في server.js كما لو كان db.js الأصلي

const { pool } = require('./connection');

// --- استيراد الملفات المنفصلة ---
const tables = require('./tables');
const auth = require('./auth');
const products = require('./products');
const cart = require('./cart');
const orders = require('./orders');
const vendors = require('./vendors');
const misc = require('./misc');

// --- استيراد الملفات الجديدة (نظام المحفظة، العقود، الخريطة، الدفع...) ---
const payoutMethods = require('./payout-methods');
const wallet = require('./wallet');
const vendorContracts = require('./vendor-contracts');
const geolocation = require('./geolocation');
const payoutSchedules = require('./payout-schedules');
const reminders = require('./reminders');

// --- دالة إنشاء جميع الجداول ---
async function createTables() {
  try {
    // الجداول الأساسية
    await tables.createUsersTable();
    await tables.createCategoriesTable();
    await tables.createSubcategoriesTable();
    await tables.createProductsTable();
    await tables.createProductImagesTable();
    await tables.createVendorsTable();
    await tables.createCartsTable();
    await tables.createCartItemsTable();
    await tables.createOrdersTable();
    await tables.createOrderItemsTable();
    await tables.createProductReviewsTable();
    await tables.createCouponsTable();
    await tables.createVendorCommissionsTable();
    await tables.createPayoutsTable();
    await tables.createReturnsTable();
    await tables.createMessagesTable();
    await tables.createNotificationsTable();
    await tables.createWishlistTable();
    await tables.createSettingsTable();
    await tables.createShippingMethodsTable();
    await tables.createVendorCouponsTable();
    await tables.createTaxRatesTable();

    // نظام الاشتراكات
    await tables.createFeaturesTable();
    await tables.createSubscriptionPlansTable();
    await tables.createPlanFeaturesTable();
    await tables.createVendorSubscriptionsTable();

    // الجداول الجديدة (يجب أن تُنشأ بعد الجداول الأساسية)
    await tables.createVendorLocationsTable();      // الموقع الجغرافي
    await tables.createPayoutMethodsTable();         // وسائل الدفع
    await tables.createVendorWalletsTable();         // محفظة البائع
    await tables.createVendorContractsTable();       // العقود
    await tables.createPayoutSchedulesTable();       // جدولة التحويلات
    await tables.createRemindersTable();             // التذكيرات

    // الأعمدة الإضافية
    await tables.ensureProductsIsActiveColumn();

    // --- إضافات ما بعد إنشاء الجداول --- //
    await misc.ensureSubcategoryDescriptionColumn();

    console.log('✅ جميع الجداول تم إنشاؤها بنجاح!');
  } catch (error) {
    console.error('❌ خطأ أثناء إنشاء الجداول:', error);
    process.exit(1);
  }
}

// --- تصدير كل شيء ---
const db = {
  pool,
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  createTables,

  // --- المصادقة والمستخدمين ---
  insertUser: auth.insertUser,
  getAllUsers: auth.getAllUsers,
  updateUser: auth.updateUser,
  deleteUser: auth.deleteUser,
  getUserById: auth.getUserById,
  updateUserRole: auth.updateUserRole,
  getUserByEmail: auth.getUserByEmail,
  suspendUser: auth.suspendUser,
  restoreUser: auth.restoreUser,
  sweepArchive: auth.sweepArchive,

  // --- المنتجات ---
  insertProduct: products.insertProduct,
  getAllProducts: products.getAllProducts,
  getProductById: products.getProductById,
  updateProduct: products.updateProduct,
  deleteProduct: products.deleteProduct,
  getProductsByVendorId: products.getProductsByVendorId,
  getVendorProductCount: products.getVendorProductCount,
  addProductImage: products.addProductImage,

  // --- الفئات ---
  insertCategory: products.insertCategory,
  getAllCategories: products.getAllCategories,
  getCategoryById: products.getCategoryById,
  updateCategory: products.updateCategory,
  deleteCategory: products.deleteCategory,
  getCategoryByName: products.getCategoryByName,

  // --- الأقسام الفرعية ---
  insertSubcategory: products.insertSubcategory,
  getAllSubcategories: products.getAllSubcategories,
  updateSubcategory: products.updateSubcategory,
  getSubcategoriesByCategoryId: products.getSubcategoriesByCategoryId,
  getSubcategoryByNameAndCategory: products.getSubcategoryByNameAndCategory,
  getSubcategoryById: products.getSubcategoryById,
  deleteSubcategory: products.deleteSubcategory,

  // --- السلة ---
  getOrCreateCart: cart.getOrCreateCart,
  addProductToCart: cart.addProductToCart,
  updateCartItemQuantity: cart.updateCartItemQuantity,
  removeProductFromCart: cart.removeProductFromCart,
  getCartByUserId: cart.getCartByUserId,
  clearCart: cart.clearCart,

  // --- الطلبات ---
  createOrderFromCart: orders.createOrderFromCart,
  getOrderDetails: orders.getOrderDetails,
  getOrdersByUserId: orders.getOrdersByUserId,
  updateOrderStatus: orders.updateOrderStatus,
  getOrdersByVendorId: orders.getOrdersByVendorId,
  isOrderForVendor: orders.isOrderForVendor,
  getAllOrders: orders.getAllOrders,
  insertShippingMethod: orders.insertShippingMethod,
  requestReturn: orders.requestReturn,
  getAllReturns: orders.getAllReturns,

  // --- المراجعات ---
  insertReview: products.insertReview,
  getReviewsByProductId: products.getReviewsByProductId,
  getReviewById: products.getReviewById,
  updateReview: products.updateReview,
  deleteReview: products.deleteReview,

  // --- البائعين ---
  createVendorFull: vendors.createVendorFull,
  ensureVendorExists: vendors.ensureVendorExists,
  getAllVendors: vendors.getAllVendors,

  // --- الكوبونات ---
  applyCoupon: misc.applyCoupon,
  getAllCoupons: misc.getAllCoupons,
  getCouponById: misc.getCouponById,
  createCouponForVendor: vendors.createCouponForVendor,
  getVendorCoupons: vendors.getVendorCoupons,

  // --- الرسائل ---
  sendMessage: misc.sendMessage,
  getMessages: misc.getMessages,
  getConversations: misc.getConversations,

  // --- المفضلة ---
  addToWishlist: misc.addToWishlist,

  // --- الإعدادات ---
  getSiteSettings: misc.getSiteSettings,
  updateSiteSettings: misc.updateSiteSettings,

  // --- الإرجاع ---
  requestReturn: orders.requestReturn,
  getAllReturns: orders.getAllReturns,

  // --- الشحن ---
  insertShippingMethod: orders.insertShippingMethod,

  // --- الدفعات ---
  getAllPayouts: orders.getAllPayouts,

  // --- الضريبة ---
  insertTaxRate: misc.insertTaxRate,
  getAllTaxRates: misc.getAllTaxRates,

  // --- إضافات ---
  ensureSubcategoryDescriptionColumn: misc.ensureSubcategoryDescriptionColumn,
  logContact: misc.logContact,

  // --- نظام الاشتراكات ---
  createSubscriptionPlan: vendors.createSubscriptionPlan,
  getAllSubscriptionPlans: vendors.getAllSubscriptionPlans,
  updateSubscriptionPlan: vendors.updateSubscriptionPlan,
  deleteSubscriptionPlan: vendors.deleteSubscriptionPlan,
  addFeatureToPlan: vendors.addFeatureToPlan,
  removeFeatureFromPlan: vendors.removeFeatureFromPlan,
  subscribeVendor: vendors.subscribeVendor,
  getVendorSubscription: vendors.getVendorSubscription,
  getAllVendorSubscriptions: vendors.getAllVendorSubscriptions,
  upgradeVendorSubscription: vendors.upgradeVendorSubscription,

  // --- إدارة وسائل الدفع (من لوحة المدير) ---
  createPayoutMethod: payoutMethods.createPayoutMethod,
  getAllPayoutMethods: payoutMethods.getAllPayoutMethods,
  getActivePayoutMethods: payoutMethods.getActivePayoutMethods,
  getPayoutMethodBySlug: payoutMethods.getPayoutMethodBySlug,
  updatePayoutMethod: payoutMethods.updatePayoutMethod,
  deletePayoutMethod: payoutMethods.deletePayoutMethod,
  togglePayoutMethod: payoutMethods.togglePayoutMethod,

  // --- نظام محفظة البائع ---
  createVendorWallet: wallet.createVendorWallet,
  getVendorWallet: wallet.getVendorWallet,
  updateWalletBalance: wallet.updateWalletBalance,
  creditWallet: wallet.creditWallet,
  releaseToAvailable: wallet.releaseToAvailable,
  setPayoutMethodForWallet: wallet.setPayoutMethodForWallet,
  recordWalletPayout: wallet.recordWalletPayout,

  // --- نظام العقود الإلكترونية ---
  saveVendorContract: vendorContracts.saveVendorContract,
  getContractByVendorId: vendorContracts.getContractByVendorId,
  hasSignedContract: vendorContracts.hasSignedContract,
  updateVendorContract: vendorContracts.updateVendorContract,
  getAllVendorContracts: vendorContracts.getAllVendorContracts,

  // --- نظام الموقع الجغرافي (الخريطة) ---
  saveVendorLocation: geolocation.saveVendorLocation,
  getVendorLocation: geolocation.getVendorLocation,
  getVendorsNearby: geolocation.getVendorsNearby,
  deleteVendorLocation: geolocation.deleteVendorLocation,

  // --- نظام جدولة التحويلات ---
  createPayoutSchedule: payoutSchedules.createPayoutSchedule,
  getNextPayoutSchedule: payoutSchedules.getNextPayoutSchedule,
  getAllPayoutSchedules: payoutSchedules.getAllPayoutSchedules,
  completePayoutSchedule: payoutSchedules.completePayoutSchedule,
  isUpcomingPayoutDue: payoutSchedules.isUpcomingPayoutDue,
  getPayoutScheduleByDate: payoutSchedules.getPayoutScheduleByDate,

  // --- نظام التذكيرات ---
  createReminder: reminders.createReminder,
  getActiveReminders: reminders.getActiveReminders,
  getUpcomingReminders: reminders.getUpcomingReminders,
  markReminderAsRead: reminders.markReminderAsRead,
  deleteReminder: reminders.deleteReminder,
  createPayoutReminder: reminders.createPayoutReminder,
  getAllReminders: reminders.getAllReminders,
};

module.exports = db;