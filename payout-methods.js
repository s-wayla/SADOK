// db/payout-methods.js
// إدارة وسائل الدفع (من لوحة التحكم)
const { pool } = require('./connection');

/**
 * إنشاء وسيلة دفع جديدة
 * @param {Object} method - { name, slug, icon_url, description, is_active, fee_type, fee_value, supported_currencies, supported_countries, required_fields }
 */
async function createPayoutMethod(method) {
  const {
    name,
    slug,
    icon_url,
    description,
    is_active,
    fee_type,
    fee_value,
    supported_currencies,
    supported_countries,
    required_fields,
  } = method;

  const query = `
    INSERT INTO payout_methods (
      name, slug, icon_url, description, is_active,
      fee_type, fee_value,
      supported_currencies, supported_countries, required_fields
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *;
  `;

  const values = [
    name,
    slug,
    icon_url,
    description,
    is_active,
    fee_type,
    fee_value,
    JSON.stringify(supported_currencies),
    JSON.stringify(supported_countries),
    JSON.stringify(required_fields),
  ];

  const client = await pool.connect();
  try {
    const result = await client.query(query, values);
    return result.rows[0];
  } catch (err) {
    console.error('Error creating payout method:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * جلب جميع وسائل الدفع (مفعّلة وغير مفعّلة)
 */
async function getAllPayoutMethods() {
  const query = `SELECT * FROM payout_methods ORDER BY name;`;
  const result = await pool.query(query);
  return result.rows;
}

/**
 * جلب وسائل الدفع المفعّلة فقط (تُعرض للبائعين)
 */
async function getActivePayoutMethods() {
  const query = `SELECT * FROM payout_methods WHERE is_active = TRUE ORDER BY name;`;
  const result = await pool.query(query);
  return result.rows;
}

/**
 * جلب وسيلة دفع حسب slug
 * @param {string} slug - مثال: bank_transfer, paypal
 */
async function getPayoutMethodBySlug(slug) {
  const query = `SELECT * FROM payout_methods WHERE slug = $1;`;
  const result = await pool.query(query, [slug]);
  return result.rows[0];
}

/**
 * تحديث وسيلة دفع
 */
async function updatePayoutMethod(slug, updates) {
  const fields = [];
  const values = [];
  let index = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      if (key === 'supported_currencies' || key === 'supported_countries' || key === 'required_fields') {
        fields.push(`${key} = $${index}::jsonb`);
        values.push(JSON.stringify(value));
      } else {
        fields.push(`${key} = $${index}`);
        values.push(value);
      }
      index++;
    }
  }

  if (fields.length === 0) return null;

  values.push(slug);
  const query = `UPDATE payout_methods SET ${fields.join(', ')} WHERE slug = $${index} RETURNING *;`;

  const client = await pool.connect();
  try {
    const result = await client.query(query, values);
    return result.rows[0];
  } catch (err) {
    console.error('Error updating payout method:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * حذف وسيلة دفع (يفضل تعطيلها بدل الحذف)
 * @param {string} slug
 */
async function deletePayoutMethod(slug) {
  const query = `DELETE FROM payout_methods WHERE slug = $1 RETURNING *;`;
  const result = await pool.query(query, [slug]);
  return result.rows[0];
}

/**
 * تفعيل أو تعطيل وسيلة دفع
 */
async function togglePayoutMethod(slug, isActive) {
  const query = `UPDATE payout_methods SET is_active = $1 WHERE slug = $2 RETURNING *;`;
  const result = await pool.query(query, [isActive, slug]);
  return result.rows[0];
}

module.exports = {
  createPayoutMethod,
  getAllPayoutMethods,
  getActivePayoutMethods,
  getPayoutMethodBySlug,
  updatePayoutMethod,
  deletePayoutMethod,
  togglePayoutMethod,
};