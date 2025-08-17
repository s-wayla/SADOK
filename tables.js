// db/tables.js - جداول قاعدة البيانات (مُعدّل وصحيح)
const { pool } = require('./connection');

// === 1. جدول المستخدمين ===
async function createUsersTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role VARCHAR(50) DEFAULT 'customer' NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // التأكد من وجود الأعمدة (في حال تم إنشاء الجدول مسبقًا بدونها)
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role') THEN
          ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'customer' NOT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'created_at') THEN
          ALTER TABLE users ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'updated_at') THEN
          ALTER TABLE users ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        END IF;
      END $$;
    `);

    console.log('✅ جدول "users" تم إنشاؤه أو تحديثه بنجاح.');
  } catch (err) {
    console.error('❌ خطأ في جدول users:', err);
    throw err;
  }
}

// === 2. جدول الفئات ===
async function createCategoriesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ جدول categories جاهز.');
  } catch (err) {
    console.error('❌ خطأ في categories:', err);
    throw err;
  }
}

// === 3. جدول الأقسام الفرعية ===
async function createSubcategoriesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subcategories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ جدول subcategories جاهز.');
  } catch (err) {
    console.error('❌ خطأ في subcategories:', err);
    throw err;
  }
}

// === 4. جدول المنتجات ===
async function createProductsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        image_url VARCHAR(255),
        vendor_id INTEGER NOT NULL REFERENCES users(id),
        category_id INTEGER REFERENCES categories(id),
        subcategory_id INTEGER REFERENCES subcategories(id),
        sku VARCHAR(100),
        weight DECIMAL(8,2),
        dimensions VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ جدول products جاهز.');
  } catch (err) {
    console.error('❌ خطأ في products:', err);
    throw err;
  }
}

// === 5. جدول المراجعات ===
async function createProductReviewsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_reviews (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (product_id, user_id)
      );
    `);
    console.log('✅ جدول product_reviews جاهز.');
  } catch (err) {
    console.error('❌ خطأ في product_reviews:', err);
    throw err;
  }
}

// === 6. جدول السلات ===
async function createCartsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS carts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ جدول carts جاهز.');
  } catch (err) {
    console.error('❌ خطأ في carts:', err);
    throw err;
  }
}

// === 7. جدول عناصر السلة ===
async function createCartItemsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id SERIAL PRIMARY KEY,
        cart_id INTEGER REFERENCES carts(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (cart_id, product_id)
      );
    `);
    console.log('✅ جدول cart_items جاهز.');
  } catch (err) {
    console.error('❌ خطأ في cart_items:', err);
    throw err;
  }
}

// === 8. جدول الطلبات ===
async function createOrdersTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        total_amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending' NOT NULL,
        shipping_address TEXT NOT NULL,
        order_date TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ جدول orders جاهز.');
  } catch (err) {
    console.error('❌ خطأ في orders:', err);
    throw err;
  }
}

// === 9. جدول عناصر الطلب ===
async function createOrderItemsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        vendor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        price_at_order DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ جدول order_items جاهز.');
  } catch (err) {
    console.error('❌ خطأ في order_items:', err);
    throw err;
  }
}

// === 10. جدول البائعين ===
async function createVendorsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendors (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        store_name VARCHAR(255) NOT NULL,
        store_slug VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        logo_url VARCHAR(255),
        cover_image_url VARCHAR(255),
        bank_account_info JSONB,
        commission_rate DECIMAL(5,2) DEFAULT 10.00,
        verification_status VARCHAR(50) DEFAULT 'pending',
        total_sales DECIMAL(12,2) DEFAULT 0,
        country VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // إضافة الحقول الناقصة (إن لم تكن موجودة)
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'country') THEN
          ALTER TABLE vendors ADD COLUMN country VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'commission_rate') THEN
          ALTER TABLE vendors ADD COLUMN commission_rate DECIMAL(5,2) DEFAULT 10.00;
        END IF;
      END $$;
    `);

    console.log('✅ جدول vendors جاهز.');
  } catch (err) {
    console.error('❌ خطأ في vendors:', err);
    throw err;
  }
}

// === 11. جدول صور المنتجات ===
async function createProductImagesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_images (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        image_url VARCHAR(255) NOT NULL,
        is_primary BOOLEAN DEFAULT FALSE,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ جدول product_images جاهز.');
  } catch (err) {
    console.error('❌ خطأ في product_images:', err);
    throw err;
  }
}

// === 12. جدول الكوبونات ===
async function createCouponsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed')),
        value DECIMAL(10,2) NOT NULL,
        min_order_amount DECIMAL(10,2),
        max_discount DECIMAL(10,2),
        usage_limit INTEGER,
        used_count INTEGER DEFAULT 0,
        start_date TIMESTAMPTZ,
        end_date TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ جدول coupons جاهز.');
  } catch (err) {
    console.error('❌ خطأ في coupons:', err);
    throw err;
  }
}

// === 13. جدول عمولات البائعين ===
async function createVendorCommissionsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_commissions (
        id SERIAL PRIMARY KEY,
        order_item_id INTEGER NOT NULL REFERENCES order_items(id),
        vendor_id INTEGER NOT NULL REFERENCES vendors(id),
        product_price DECIMAL(10,2) NOT NULL,
        commission_rate DECIMAL(5,2) NOT NULL,
        commission_amount DECIMAL(10,2) NOT NULL,
        tax_amount DECIMAL(10,2) DEFAULT 0,
        fee_amount DECIMAL(10,2) DEFAULT 0,
        is_fee_waived BOOLEAN DEFAULT FALSE,
        status VARCHAR(50) DEFAULT 'pending',
        paid_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ جدول vendor_commissions جاهز.');
  } catch (err) {
    console.error('❌ خطأ في vendor_commissions:', err);
    throw err;
  }
}

// === 14. جدول دفعات البائعين ===
async function createPayoutsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payouts (
        id SERIAL PRIMARY KEY,
        vendor_id INTEGER NOT NULL REFERENCES vendors(id),
        amount DECIMAL(12,2) NOT NULL,
        method VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        transaction_id VARCHAR(255),
        notes TEXT,
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ جدول payouts جاهز.');
  } catch (err) {
    console.error('❌ خطأ في payouts:', err);
    throw err;
  }
}

// === 15. جدول طلبات الإرجاع ===
async function createReturnsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS returns (
        id SERIAL PRIMARY KEY,
        order_item_id INTEGER NOT NULL REFERENCES order_items(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        reason TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
        refund_amount DECIMAL(10,2),
        images JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ جدول returns جاهز.');
  } catch (err) {
    console.error('❌ خطأ في returns:', err);
    throw err;
  }
}

// === 16. جدول الرسائل ===
async function createMessagesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ جدول messages جاهز.');
  } catch (err) {
    console.error('❌ خطأ في messages:', err);
    throw err;
  }
}

// === 17. جدول الإشعارات ===
async function createNotificationsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50),
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ جدول notifications جاهز.');
  } catch (err) {
    console.error('❌ خطأ في notifications:', err);
    throw err;
  }
}

// === 18. جدول المفضلة ===
async function createWishlistTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wishlist (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        added_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (user_id, product_id)
      );
    `);
    console.log('✅ جدول wishlist جاهز.');
  } catch (err) {
    console.error('❌ خطأ في wishlist:', err);
    throw err;
  }
}

// === 19. جدول الإعدادات ===
async function createSettingsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        site_name VARCHAR(100) DEFAULT 'My Marketplace',
        currency VARCHAR(10) DEFAULT 'SAR',
        language VARCHAR(10) DEFAULT 'ar',
        logo_url VARCHAR(255),
        email VARCHAR(100),
        phone VARCHAR(20),
        address TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await pool.query(`
      INSERT INTO settings (site_name, currency, language)
      SELECT 'My Marketplace', 'SAR', 'ar'
      WHERE NOT EXISTS (SELECT 1 FROM settings);
    `);
    console.log('✅ جدول settings جاهز.');
  } catch (err) {
    console.error('❌ خطأ في settings:', err);
    throw err;
  }
}

// === 20. جدول وسائل الشحن ===
async function createShippingMethodsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shipping_methods (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        cost DECIMAL(8,2) NOT NULL,
        estimated_days VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE
      );
    `);
    console.log('✅ جدول shipping_methods جاهز.');
  } catch (err) {
    console.error('❌ خطأ في shipping_methods:', err);
    throw err;
  }
}

// === 21. جدول ربط الكوبونات بالبائعين ===
async function createVendorCouponsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_coupons (
        id SERIAL PRIMARY KEY,
        vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
        coupon_id INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (vendor_id, coupon_id)
      );
    `);
    console.log('✅ جدول vendor_coupons جاهز.');
  } catch (err) {
    console.error('❌ خطأ في vendor_coupons:', err);
    throw err;
  }
}

// === 22. جدول نسب الضريبة ===
async function createTaxRatesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tax_rates (
        id SERIAL PRIMARY KEY,
        country VARCHAR(100) NOT NULL UNIQUE,
        country_code CHAR(2) NOT NULL,
        tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ جدول tax_rates جاهز.');
  } catch (err) {
    console.error('❌ خطأ في tax_rates:', err);
    throw err;
  }
}

// === 23. جدول الميزات ===
async function createFeaturesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS features (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('boolean', 'number', 'text', 'select')),
        description TEXT,
        options JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ جدول features جاهز.');
  } catch (err) {
    console.error('❌ خطأ في features:', err);
    throw err;
  }
}

// === 24. جدول خطط الاشتراك ===
async function createSubscriptionPlansTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        annual_price DECIMAL(10,2),
        sales_fee DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        max_products INT DEFAULT 50,
        max_variants_per_product INT DEFAULT 5,
        custom_domain BOOLEAN DEFAULT FALSE,
        custom_theme BOOLEAN DEFAULT FALSE,
        advanced_reports BOOLEAN DEFAULT FALSE,
        support_level VARCHAR(50) DEFAULT 'محدود',
        staff_accounts INT DEFAULT 1,
        coupons BOOLEAN DEFAULT TRUE,
        api_access BOOLEAN DEFAULT FALSE,
        csv_import_export BOOLEAN DEFAULT FALSE,
        marketing_tools BOOLEAN DEFAULT FALSE,
        color VARCHAR(20) DEFAULT 'blue',
        is_active BOOLEAN DEFAULT TRUE,
        "order" INT DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ جدول subscription_plans جاهز.');
  } catch (err) {
    console.error('❌ خطأ في subscription_plans:', err);
    throw err;
  }
}

// === 25. جدول ربط الميزات بالخطط ===
async function createPlanFeaturesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS plan_features (
        id SERIAL PRIMARY KEY,
        plan_id INTEGER NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
        feature_id INTEGER NOT NULL REFERENCES features(id) ON DELETE CASCADE,
        value TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (plan_id, feature_id)
      );
    `);
    console.log('✅ جدول plan_features جاهز.');
  } catch (err) {
    console.error('❌ خطأ في plan_features:', err);
    throw err;
  }
}

// === 26. جدول اشتراكات البائعين ===
async function createVendorSubscriptionsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_subscriptions (
        id SERIAL PRIMARY KEY,
        vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
        plan_id INTEGER NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
        start_date TIMESTAMPTZ DEFAULT NOW(),
        end_date TIMESTAMPTZ,
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ جدول vendor_subscriptions جاهز.');
  } catch (err) {
    console.error('❌ خطأ في vendor_subscriptions:', err);
    throw err;
  }
}

// === 27. جدول مواقع البائعين (جديد - تم إضافته) ===
async function createVendorLocationsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_locations (
        id SERIAL PRIMARY KEY,
        vendor_id INTEGER UNIQUE NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
        lat DECIMAL(10,8) NOT NULL,
        lng DECIMAL(11,8) NOT NULL,
        country VARCHAR(100),
        state VARCHAR(100),
        city VARCHAR(100),
        street VARCHAR(255),
        postal_code VARCHAR(20),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ جدول vendor_locations جاهز.');
  } catch (err) {
    console.error('❌ خطأ في vendor_locations:', err);
    throw err;
  }
}

// === 28. جدول وسائل الدفع (جديد - تم إضافته) ===
async function createPayoutMethodsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payout_methods (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        icon_url VARCHAR(255),
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        fee_type VARCHAR(20) DEFAULT 'none' CHECK (fee_type IN ('percentage', 'fixed', 'none')),
        fee_value DECIMAL(10,2) DEFAULT 0,
        supported_currencies JSONB DEFAULT '["SAR", "USD", "EUR", "TND"]',
        supported_countries JSONB DEFAULT '["SA", "US", "TN", "EG"]',
        required_fields JSONB NOT NULL DEFAULT '["email"]',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ جدول payout_methods جاهز.');
  } catch (err) {
    console.error('❌ خطأ في payout_methods:', err);
    throw err;
  }
}

// === 29. جدول محفظة البائع (جديد - تم إضافته) ===
async function createVendorWalletsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_wallets (
        id SERIAL PRIMARY KEY,
        vendor_id INTEGER UNIQUE NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
        balance DECIMAL(12,2) DEFAULT 0.00,
        pending_balance DECIMAL(12,2) DEFAULT 0.00,
        last_payout_date TIMESTAMPTZ,
        payout_method VARCHAR(100) DEFAULT 'bank_account',
        payout_details JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ جدول vendor_wallets جاهز.');
  } catch (err) {
    console.error('❌ خطأ في vendor_wallets:', err);
    throw err;
  }
}

// === 30. جدول العقود (جديد - تم إضافته) ===
async function createVendorContractsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_contracts (
        id SERIAL PRIMARY KEY,
        vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
        contract_pdf_path VARCHAR(255) NOT NULL,
        signer_name VARCHAR(150) NOT NULL,
        id_number VARCHAR(50) NOT NULL,
        signature_image VARCHAR(255) NOT NULL,
        profile_image_copy VARCHAR(255),
        accepted_terms_version VARCHAR(20) NOT NULL,
        signed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ جدول vendor_contracts جاهز.');
  } catch (err) {
    console.error('❌ خطأ في vendor_contracts:', err);
    throw err;
  }
}

// === 31. جدول جدولة التحويلات (جديد - تم إضافته) ===
async function createPayoutSchedulesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payout_schedules (
        id SERIAL PRIMARY KEY,
        due_date DATE NOT NULL UNIQUE,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
        total_vendors INTEGER DEFAULT 0,
        total_amount DECIMAL(12,2) DEFAULT 0,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ جدول payout_schedules جاهز.');
  } catch (err) {
    console.error('❌ خطأ في payout_schedules:', err);
    throw err;
  }
}

// === 32. جدول التذكيرات (جديد - تم إضافته) ===
async function createRemindersTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reminders (
        id SERIAL PRIMARY KEY,
        title VARCHAR(150) NOT NULL,
        message TEXT NOT NULL,
        trigger_date TIMESTAMPTZ NOT NULL,
        user_type VARCHAR(20) DEFAULT 'admin',
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ جدول reminders جاهز.');
  } catch (err) {
    console.error('❌ خطأ في reminders:', err);
    throw err;
  }
}
async function ensureProductsIsActiveColumn() {
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='products' AND column_name='is_active'
      ) THEN
        ALTER TABLE products ADD COLUMN is_active BOOLEAN;
        UPDATE products SET is_active = TRUE WHERE is_active IS NULL;
        ALTER TABLE products ALTER COLUMN is_active SET DEFAULT TRUE;
        ALTER TABLE products ALTER COLUMN is_active SET NOT NULL;
      END IF;
    END
    $$;
  `);
  console.log('✅ products.is_active ensured.');
}

module.exports = {
  createUsersTable,
  createCategoriesTable,
  createSubcategoriesTable,
  createProductsTable,
  createProductReviewsTable,
  createCartsTable,
  createCartItemsTable,
  createOrdersTable,
  createOrderItemsTable,
  createVendorsTable,
  createProductImagesTable,
  createCouponsTable,
  createVendorCommissionsTable,
  createPayoutsTable,
  createReturnsTable,
  createMessagesTable,
  createNotificationsTable,
  createWishlistTable,
  createSettingsTable,
  createShippingMethodsTable,
  createVendorCouponsTable,
  createTaxRatesTable,
  createFeaturesTable,
  createSubscriptionPlansTable,
  createPlanFeaturesTable,
  createVendorSubscriptionsTable,
  createVendorLocationsTable,
  createPayoutMethodsTable,
  createVendorWalletsTable,
  createVendorContractsTable,
  createPayoutSchedulesTable,
  createRemindersTable,
  ensureProductsIsActiveColumn,
};