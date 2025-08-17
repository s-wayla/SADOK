// db/geolocation.js
// إدارة الموقع الجغرافي للبائع (من الخريطة)
const { pool } = require('./connection');

/**
 * حفظ موقع البائع (من الخريطة)
 * ملاحظات:
 * - يمكن تمرير عميل قاعدة البيانات (client) لاستخدامه ضمن نفس الـ transaction:
 *    saveVendorLocation(vendorId, location, client)
 *    أو
 *    saveVendorLocation(vendorId, location, { client })
 * - إذا لم يتم تمرير client، سيتم استخدام pool.connect() داخليًا.
 *
 * @param {number} vendorId
 * @param {Object} location - { lat, lng, country, state, city, street, postal_code }
 * @param {Object|import('pg').PoolClient} [clientOrOptions]
 * @returns {Promise<Object>}
 */
async function saveVendorLocation(vendorId, location, clientOrOptions) {
  const {
    lat,
    lng,
    country,
    state,
    city,
    street,
    postal_code,
  } = location || {};

  // تأكد أن lat/lng أرقام (قد تأتي كسلاسل)
  const latNum = lat !== undefined && lat !== null ? Number(lat) : null;
  const lngNum = lng !== undefined && lng !== null ? Number(lng) : null;

  const query = `
    INSERT INTO vendor_locations (
      vendor_id, lat, lng, country, state, city, street, postal_code
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (vendor_id) DO UPDATE SET
      lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      country = EXCLUDED.country,
      state = EXCLUDED.state,
      city = EXCLUDED.city,
      street = EXCLUDED.street,
      postal_code = EXCLUDED.postal_code,
      updated_at = NOW()
    RETURNING *;
  `;

  const values = [
    vendorId,
    latNum,
    lngNum,
    country || null,
    state || null,
    city || null,
    street || null,
    postal_code || null,
  ];

  // دعم تمرير client بشكل مباشر أو داخل كائن { client }
  const externalClient =
    clientOrOptions &&
    (typeof clientOrOptions.query === 'function'
      ? clientOrOptions
      : clientOrOptions.client && typeof clientOrOptions.client.query === 'function'
      ? clientOrOptions.client
      : null);

  let client;
  let shouldRelease = false;

  try {
    client = externalClient || (await pool.connect());
    shouldRelease = !externalClient;

    const result = await client.query(query, values);
    return result.rows[0];
  } catch (err) {
    console.error('Error saving vendor location:', {
      vendorId,
      err,
    });
    throw err;
  } finally {
    if (shouldRelease && client) client.release();
  }
}

/**
 * جلب موقع بائع معين
 * @param {number} vendorId
 * @returns {Promise<Object|undefined>}
 */
async function getVendorLocation(vendorId) {
  const query = `
    SELECT * FROM vendor_locations
    WHERE vendor_id = $1;
  `;
  const result = await pool.query(query, [vendorId]);
  return result.rows[0];
}

/**
 * جلب جميع البائعين ضمن نطاق معين (مفيد للشحن المحلي)
 * ملاحظة: تم تصحيح الحقل ليكون v.store_name بدل ve.store_name.
 *
 * @param {number} centerLat - خط العرض المركزي
 * @param {number} centerLng - خط الطول المركزي
 * @param {number} [radiusKm=50] - نصف القطر بالكيلومتر
 * @returns {Promise<Array>}
 */
async function getVendorsNearby(centerLat, centerLng, radiusKm = 50) {
  const query = `
    SELECT
      v.id,
      v.store_name,
      ve.lat,
      ve.lng,
      (6371 * acos(
        cos(radians($1)) * cos(radians(ve.lat)) *
        cos(radians(ve.lng) - radians($2)) +
        sin(radians($1)) * sin(radians(ve.lat))
      )) AS distance
    FROM vendors v
    JOIN vendor_locations ve ON v.id = ve.vendor_id
    WHERE ve.lat IS NOT NULL AND ve.lng IS NOT NULL
    HAVING (6371 * acos(
      cos(radians($1)) * cos(radians(ve.lat)) *
      cos(radians(ve.lng) - radians($2)) +
      sin(radians($1)) * sin(radians(ve.lat))
    )) < $3
    ORDER BY distance;
  `;

  const result = await pool.query(query, [Number(centerLat), Number(centerLng), Number(radiusKm)]);
  return result.rows;
}

/**
 * حذف موقع البائع (نادرًا)
 * @param {number} vendorId
 * @returns {Promise<Object|undefined>}
 */
async function deleteVendorLocation(vendorId) {
  const query = `DELETE FROM vendor_locations WHERE vendor_id = $1 RETURNING *;`;
  const result = await pool.query(query, [vendorId]);
  return result.rows[0];
}

module.exports = {
  saveVendorLocation,
  getVendorLocation,
  getVendorsNearby,
  deleteVendorLocation,
};
