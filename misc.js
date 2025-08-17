// db/misc.js - دوال متنوعة: الكوبونات، الرسائل، الإشعارات، المفضلة، الإعدادات

const { pool } = require('./connection');
const bcrypt = require('bcryptjs');

// --- دوال الكوبونات ---
async function applyCoupon(code, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const coupon = await client.query('SELECT * FROM coupons WHERE code = $1 AND is_active = TRUE AND (end_date IS NULL OR end_date > NOW());', [code]);
    if (coupon.rows.length === 0) throw new Error('Coupon not valid.');
    const used = await client.query('SELECT COUNT(*) FROM order_coupons WHERE coupon_id = $1;', [coupon.rows[0].id]);
    if (coupon.rows[0].usage_limit && used.rows[0].count >= coupon.rows[0].usage_limit) {
      throw new Error('Coupon usage limit reached.');
    }
    await client.query('COMMIT');
    return coupon.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getAllCoupons() {
  try {
    const res = await pool.query(`
      SELECT * FROM coupons
      ORDER BY created_at DESC;
    `);
    return res.rows;
  } catch (err) {
    console.error('Error fetching coupons:', err);
    return [];
  }
}

async function getCouponById(id) {
  try {
    const res = await pool.query('SELECT * FROM coupons WHERE id = $1', [id]);
    return res.rows[0];
  } catch (err) {
    console.error('Error fetching coupon by ID:', err);
    throw err;
  }
}

// --- دوال الرسائل والمحادثات ---
async function sendMessage(senderId, receiverId, message) {
  try {
    const result = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [senderId, receiverId, message]
    );
    return result.rows[0];
  } catch (err) {
    console.error('Error sending message:', err);
    throw err;
  }
}

async function getMessages(userId) {
  try {
    const result = await pool.query(
      `SELECT m.*, u.name AS sender_name, u.email AS sender_email
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.receiver_id = $1 OR m.sender_id = $1
       ORDER BY m.created_at ASC`,
      [userId]
    );
    return result.rows;
  } catch (err) {
    console.error('Error fetching messages:', err);
    throw err;
  }
}

async function getConversations(userId) {
  try {
    const result = await pool.query(`
      SELECT DISTINCT 
        u.id AS user_id,
        u.name,
        u.email,
        MAX(m.created_at) AS last_message_time,
        m.message AS last_message
      FROM messages m
      JOIN users u ON (u.id = m.sender_id OR u.id = m.receiver_id)
      WHERE (m.sender_id = $1 OR m.receiver_id = $1)
        AND u.id != $1
      GROUP BY u.id, u.name, u.email, m.message
      ORDER BY last_message_time DESC
    `, [userId]);
    return result.rows;
  } catch (err) {
    console.error('Error fetching conversations:', err);
    throw err;
  }
}

// --- دوال المفضلة ---
async function addToWishlist(userId, productId) {
  const res = await pool.query(`
    INSERT INTO wishlist (user_id, product_id)
    VALUES ($1, $2)
    ON CONFLICT (user_id, product_id) DO NOTHING
    RETURNING *;
  `, [userId, productId]);
  return res.rows[0];
}

// --- دوال الإعدادات ---
async function getSiteSettings() {
  try {
    const res = await pool.query('SELECT * FROM settings WHERE id = $1', [1]);
    return res.rows[0] || {
      site_name: 'My Shop',
      email: 'admin@shop.com',
      phone: '+1234567890',
      currency: 'USD'
    };
  } catch (err) {
    console.error('Error fetching settings:', err);
    return {
      site_name: 'My Shop',
      email: 'admin@shop.com',
      phone: '+1234567890',
      currency: 'USD'
    };
  }
}

async function updateSiteSettings(site_name, email, phone, currency) {
  try {
    await pool.query(`
      UPDATE settings 
      SET site_name = $1, email = $2, phone = $3, currency = $4
      WHERE id = 1
    `, [site_name, email, phone, currency]);
    return await getSiteSettings();
  } catch (err) {
    console.error('Error updating settings:', err);
    throw err;
  }
}

// --- دوال إدخال القيم الافتراضية ---
async function insertTaxRate(country, countryCode, taxRate, description = null, isActive = true) {
  try {
    const res = await pool.query(
      `INSERT INTO tax_rates (country, country_code, tax_rate, description, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [country, countryCode, taxRate, description, isActive]
    );
    return res.rows[0];
  } catch (err) {
    console.error('Error inserting tax rate:', err);
    throw err;
  }
}

async function getAllTaxRates() {
  try {
    const res = await pool.query('SELECT * FROM tax_rates ORDER BY country;');
    return res.rows;
  } catch (err) {
    console.error('Error fetching all tax rates:', err);
    throw err;
  }
}

// --- دوال إضافية ---
async function ensureSubcategoryDescriptionColumn() {
  try {
    await pool.query(`ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS description TEXT;`);
    console.log('تم التأكد من وجود عمود description في subcategories.');
  } catch (error) {
    console.log('قد يكون العمود موجودًا بالفعل:', error.message);
  }
}
async function logContact(userId, channel = 'in_app', note = null) {
  const res = await pool.query(
    `INSERT INTO contact_logs (user_id, channel, note) VALUES ($1, $2, $3) RETURNING id, created_at`,
    [userId, channel, note]
  );
  // حدّث آخر تواصل في الأرشيف (لو كان المستخدم مؤرشفًا)
  await pool.query(`
    UPDATE users_archive
       SET last_contact_at = $2
     WHERE id = $1
  `, [userId, res.rows[0].created_at]);

  return res.rows[0];
}

module.exports = {
  // الكوبونات
  applyCoupon,
  getAllCoupons,
  getCouponById,
  // الرسائل
  sendMessage,
  getMessages,
  getConversations,
  // المفضلة
  addToWishlist,
  // الإعدادات
  getSiteSettings,
  updateSiteSettings,
  // الضريبة
  insertTaxRate,
  getAllTaxRates,
  // إضافات
  ensureSubcategoryDescriptionColumn,
  logContact,
};