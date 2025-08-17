// db/vendors.js - دوال البائعين وخطط الاشتراك (مُعدّل بالكامل لدعم نظام اشتراكات ضخم)
const { pool } = require('./connection');
// استيراد الملفات الجديدة
const { saveVendorLocation } = require('./geolocation');
const { saveVendorContract } = require('./vendor-contracts');
const { createVendorWallet, setPayoutMethodForWallet } = require('./wallet');
const generateVendorContract = require('../utils/pdf-generator');
const sendContractEmail = require('../utils/email-service');

// --- دوال البائعين ---
/**
 * إنشاء بائع مع كل البيانات: الموقع، العقد، المحفظة، البريد...
 */
async function createVendorFull(userData) {
  const {
    userId,
    storeName,
    storeSlug,
    description,
    logoUrl,
    coverImageUrl,
    country,
    state,
    city,
    street,
    postalCode,
    lat,
    lng,
    payoutMethod,
    bankAccountName,
    bankName,
    iban,
    paypalEmail,
    walletPayoutMethod,
    walletDetails,
    contractName,
    contractIdNumber,
    signatureImage,
    profileImage,
    email
  } = userData;

  let client;
  let vendorId;
  let contractPath;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // 1) إنشاء البائع
    const vendorRes = await client.query(`
      INSERT INTO vendors (
        user_id, store_name, store_slug, description, logo_url, cover_image_url, country
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id;
    `, [userId, storeName, storeSlug, description, logoUrl, coverImageUrl, country]);

    vendorId = vendorRes.rows[0].id;

    // 2) (مهم) لا تحفظ الموقع هنا — نؤجله لما بعد COMMIT

    // 3) إنشاء محفظة
    await createVendorWallet(vendorId);

    // 4) حفظ وسيلة الدفع في المحفظة
    if (payoutMethod === 'wallet' && walletPayoutMethod) {
      await setPayoutMethodForWallet(vendorId, walletPayoutMethod, {
        method: walletPayoutMethod,
        details: walletDetails,
        bankAccountName,
        bankName,
        iban,
        paypalEmail
      });
    }

    // 5) توليد العقد
    const contractData = {
      fullName: contractName,
      storeName,
      country,
      idNumber: contractIdNumber,
      payoutMethod,
      signatureName: contractName,
    };
    contractPath = await generateVendorContract(contractData);

    // 6) حفظ العقد في قاعدة البيانات
    await saveVendorContract(vendorId, {
      contractPdfPath: contractPath,
      signerName: contractName,
      idNumber: contractIdNumber,
      signatureImage,
      profileImageCopy: profileImage,
      termsVersion: 'v1.0'
    });

    // 7) إرسال العقد بالبريد
    await sendContractEmail(email, contractPath);

    await client.query('COMMIT');

  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('Error in createVendorFull:', err);
    throw err;
  } finally {
    if (client) client.release();
  }

  // ✅ الآن وبعد تأكيد إدراج البائع (COMMIT) نحفظ الموقع
  if (lat && lng) {
    await saveVendorLocation(vendorId, {
      lat,
      lng,
      country,
      state,
      city,
      street,
      postal_code: postalCode
    });
  }

  return {
    success: true,
    vendorId,
    contractPath,
    message: 'تم إنشاء المتجر والعقد بنجاح وإرساله بالبريد.'
  };
}


async function ensureVendorExists(userId, storeName = null) {
  try {
    const res = await pool.query(`
      INSERT INTO vendors (user_id, store_name, store_slug, verification_status)
      VALUES ($1, $2, $3, 'approved')
      ON CONFLICT (user_id) DO NOTHING
      RETURNING *;
    `, [userId, storeName || `Store_${userId}`, `store_${userId}`]);
    return res.rows[0];
  } catch (err) {
    console.error('Error ensuring vendor exists:', err);
    throw err;
  }
}

async function getAllVendors() {
  try {
    const res = await pool.query(`
      SELECT v.user_id, v.store_name, u.email, v.created_at
      FROM vendors v
      JOIN users u ON v.user_id = u.id
      ORDER BY v.created_at DESC;
    `);
    return res.rows;
  } catch (err) {
    console.error('Error fetching vendors:', err);
    return [];
  }
}

async function getVendorCoupons(vendorId) {
  try {
    const res = await pool.query(`
      SELECT c.*
      FROM coupons c
      JOIN vendor_coupons vc ON c.id = vc.coupon_id
      JOIN vendors v ON vc.vendor_id = v.id
      WHERE v.user_id = $1
      ORDER BY c.created_at DESC
    `, [vendorId]);
    return res.rows;
  } catch (err) {
    console.error('Error fetching vendor coupons:', err);
    return [];
  }
}

async function createCouponForVendor(vendorId, code, type, value, minOrderAmount, usageLimit, startDate, endDate) {
  try {
    if (type === 'percentage' && value > 30) {
      throw new Error('Maximum discount for vendor coupons is 30%.');
    }

    const vendorCheck = await pool.query('SELECT id FROM vendors WHERE user_id = $1', [vendorId]);
    if (vendorCheck.rows.length === 0) {
      throw new Error('Vendor profile not found. Please create your store first.');
    }
    const actualVendorId = vendorCheck.rows[0].id;

    const res = await pool.query(`
      INSERT INTO coupons (code, type, value, min_order_amount, usage_limit, start_date, end_date, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
      RETURNING id;
    `, [code, type, value, minOrderAmount, usageLimit, startDate, endDate]);

    const couponId = res.rows[0].id;

    await pool.query(`
      INSERT INTO vendor_coupons (vendor_id, coupon_id)
      VALUES ($1, $2);
    `, [actualVendorId, couponId]);

    const coupon = await pool.query(`
      SELECT * FROM coupons WHERE id = $1;
    `, [couponId]);

    return coupon.rows[0];
  } catch (err) {
    console.error('Error creating vendor coupon:', err);
    throw err;
  }
}

// --- 1. إدارة الميزات ---
// إضافة ميزة جديدة
async function createFeature(data) {
  const { name, type, description, options } = data;
  const res = await pool.query(`
    INSERT INTO features (name, type, description, options)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `, [name, type, description, options ? JSON.stringify(options) : null]);
  return res.rows[0];
}

// جلب جميع الميزات
async function getAllFeatures() {
  const res = await pool.query(`
    SELECT id, name, type, description, options FROM features
    ORDER BY name;
  `);
  return res.rows;
}

// تعديل ميزة
async function updateFeature(id, data) {
  const fields = [];
  const values = [];
  let index = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = $${index}`);
      values.push(key === 'options' ? JSON.stringify(value) : value);
      index++;
    }
  }

  if (fields.length === 0) return null;

  const query = `UPDATE features SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $${index} RETURNING *;`;
  values.push(id);

  const res = await pool.query(query, values);
  return res.rows[0];
}

// حذف ميزة
async function deleteFeature(id) {
  const res = await pool.query(`
    DELETE FROM features WHERE id = $1 RETURNING id, name;
  `, [id]);
  return res.rows[0];
}

// --- 2. إدارة خطط الاشتراك ---
// إضافة خطة اشتراك جديدة (مُعدّلة لدعم جميع الحقول)
async function createSubscriptionPlan(data) {
  const {
    name,
    description,
    price,
    annual_price,
    sales_fee,
    max_products,
    max_variants_per_product,
    custom_domain,
    custom_theme,
    advanced_reports,
    support_level,
    staff_accounts,
    coupons,
    api_access,
    csv_import_export,
    marketing_tools,
    color,
    is_active,
    order
  } = data;

  const res = await pool.query(`
    INSERT INTO subscription_plans (
      name, description, price, annual_price, sales_fee,
      max_products, max_variants_per_product, custom_domain, custom_theme,
      advanced_reports, support_level, staff_accounts, coupons, api_access,
      csv_import_export, marketing_tools, color, is_active, "order"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    RETURNING *;
  `, [
    name, description, price, annual_price, sales_fee,
    max_products, max_variants_per_product, custom_domain, custom_theme,
    advanced_reports, support_level, staff_accounts, coupons, api_access,
    csv_import_export, marketing_tools, color, is_active !== false, order || 1
  ]);

  return res.rows[0];
}

// db/vendors.js
// ... (الكود السابق)

// جلب جميع الخطط مع ميزاتها (مُعدّلة لحل مشكلة GROUP BY)
async function getAllSubscriptionPlans() {
  const res = await pool.query(`
    SELECT
      sp.id,
      sp.name,
      sp.description,
      sp.price,
      sp.annual_price,
      sp.sales_fee,
      sp.max_products,
      sp.max_variants_per_product,
      sp.custom_domain,
      sp.custom_theme,
      sp.advanced_reports,
      sp.support_level,
      sp.staff_accounts,
      sp.coupons,
      sp.api_access,
      sp.csv_import_export,
      sp.marketing_tools,
      sp.color,
      sp.is_active,
      sp."order",
      sp.created_at,
      sp.updated_at,
      COALESCE(json_agg(
        json_build_object(
          'id', f.id,
          'name', f.name,
          'type', f.type,
          'description', f.description,
          'options', f.options,
          'value', pf.value
        ) ORDER BY f.name
      ) FILTER (WHERE f.id IS NOT NULL), '[]') AS additional_features
    FROM subscription_plans sp
    LEFT JOIN plan_features pf ON sp.id = pf.plan_id
    LEFT JOIN features f ON pf.feature_id = f.id
    GROUP BY
      sp.id,
      sp.name,
      sp.description,
      sp.price,
      sp.annual_price,
      sp.sales_fee,
      sp.max_products,
      sp.max_variants_per_product,
      sp.custom_domain,
      sp.custom_theme,
      sp.advanced_reports,
      sp.support_level,
      sp.staff_accounts,
      sp.coupons,
      sp.api_access,
      sp.csv_import_export,
      sp.marketing_tools,
      sp.color,
      sp.is_active,
      sp."order",
      sp.created_at,
      sp.updated_at
    ORDER BY sp."order", sp.price;
  `);
  return res.rows;
}

// ... (باقي الكود)

// تعديل خطة (مُعدّلة لدعم جميع الحقول)
async function updateSubscriptionPlan(id, data) {
  const fields = [];
  const values = [];
  let index = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = $${index}`);
      values.push(value);
      index++;
    }
  }

  if (fields.length === 0) return null;

  const query = `
    UPDATE subscription_plans 
    SET ${fields}, updated_at = CURRENT_TIMESTAMP 
    WHERE id = $${index} 
    RETURNING *;
  `;
  values.push(id);

  const res = await pool.query(query, values);
  return res.rows[0];
}

// حذف خطة (تم تعطيلها بدل الحذف)
async function deleteSubscriptionPlan(id) {
  const res = await pool.query(`
    UPDATE subscription_plans SET is_active = FALSE WHERE id = $1 RETURNING id, name;
  `, [id]);
  return res.rows[0];
}

// ربط ميزة بخطة (مع قيمة) - للخصائص الإضافية النادرة
async function addFeatureToPlan(planId, featureId, value) {
  const res = await pool.query(`
    INSERT INTO plan_features (plan_id, feature_id, value)
    VALUES ($1, $2, $3)
    ON CONFLICT (plan_id, feature_id) DO UPDATE SET value = EXCLUDED.value
    RETURNING *;
  `, [planId, featureId, value]);
  return res.rows[0];
}

// إزالة ميزة من خطة
async function removeFeatureFromPlan(planId, featureId) {
  const res = await pool.query(`
    DELETE FROM plan_features WHERE plan_id = $1 AND feature_id = $2 RETURNING *;
  `, [planId, featureId]);
  return res.rows[0];
}

// --- 3. إدارة اشتراكات البائعين ---
// اشتراك بائع في خطة
async function subscribeVendor(vendorId, planId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // إلغاء أي اشتراك نشط
    await client.query(`
      UPDATE vendor_subscriptions 
      SET status = 'cancelled' 
      WHERE vendor_id = $1 AND status = 'active';
    `, [vendorId]);

    // إنشاء اشتراك جديد
    const res = await client.query(`
      INSERT INTO vendor_subscriptions (vendor_id, plan_id, start_date, status)
      VALUES ($1, $2, NOW(), 'active')
      RETURNING *;
    `, [vendorId, planId]);

    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// جلب اشتراك البائع الحالي
async function getVendorSubscription(vendorId) {
  const res = await pool.query(`
    SELECT 
      vs.*,
      sp.name AS plan_name,
      sp.price,
      sp.annual_price,
      sp.sales_fee,
      sp.max_products,
      sp.max_variants_per_product,
      sp.custom_domain,
      sp.custom_theme,
      sp.advanced_reports,
      sp.support_level,
      sp.staff_accounts,
      sp.coupons,
      sp.api_access,
      sp.csv_import_export,
      sp.marketing_tools,
      sp.color,
      sp.description AS plan_description
    FROM vendor_subscriptions vs
    JOIN subscription_plans sp ON vs.plan_id = sp.id
    WHERE vs.vendor_id = $1 AND vs.status = 'active';
  `, [vendorId]);

  return res.rows[0] || null;
}

// جلب جميع اشتراكات البائعين
async function getAllVendorSubscriptions() {
  const res = await pool.query(`
    SELECT 
      vs.*,
      v.store_name,
      u.email,
      sp.name AS plan_name,
      sp.price,
      sp.sales_fee
    FROM vendor_subscriptions vs
    JOIN vendors v ON vs.vendor_id = v.id
    JOIN users u ON v.user_id = u.id
    JOIN subscription_plans sp ON vs.plan_id = sp.id
    ORDER BY vs.start_date DESC;
  `);
  return res.rows;
}
// ترقية اشتراك البائع
async function upgradeVendorSubscription(vendorId, planId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // أولًا، جلب الخطة الجديدة والتحقق منها
    const planRes = await client.query('SELECT price FROM subscription_plans WHERE id = $1', [planId]);
    if (planRes.rows.length === 0) {
      throw new Error('الخطة غير موجودة.');
    }

    // ثانيًا، إلغاء الاشتراك الحالي
    const currentSub = await client.query(`
      SELECT id FROM vendor_subscriptions WHERE vendor_id = $1 AND status = 'active';
    `, [vendorId]);

    if (currentSub.rows.length > 0) {
      const currentSubId = currentSub.rows[0].id;
      await client.query(`
        UPDATE vendor_subscriptions
        SET status = 'cancelled', end_date = NOW()
        WHERE id = $1;
      `, [currentSubId]);
    }

    // ثالثًا، إنشاء اشتراك جديد بالخطة الجديدة
    const res = await client.query(`
      INSERT INTO vendor_subscriptions (vendor_id, plan_id, start_date, status)
      VALUES ($1, $2, NOW(), 'active')
      RETURNING *;
    `, [vendorId, planId]);

    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error upgrading vendor subscription:', err);
    throw err;
  } finally {
    client.release();
  }
}
module.exports = {
  createVendorFull, 
  ensureVendorExists,
  getAllVendors,
  getVendorCoupons,
  createCouponForVendor,
  // الميزات
  createFeature,
  getAllFeatures,
  updateFeature,
  deleteFeature,
  // الخطط
  createSubscriptionPlan,
  getAllSubscriptionPlans,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  addFeatureToPlan,
  removeFeatureFromPlan,
  // اشتراكات البائعين
  subscribeVendor,
  getVendorSubscription,
  getAllVendorSubscriptions,
  upgradeVendorSubscription,
};