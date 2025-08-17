// db/wallet.js
// نظام محفظة البائع (Store Wallet)
const { pool } = require('./connection');

/**
 * إنشاء محفظة فارغة للبائع (يُستدعى عند إنشاء المتجر)
 * @param {number} vendorId
 */
async function createVendorWallet(vendorId) {
  const query = `
    INSERT INTO vendor_wallets (vendor_id, balance, pending_balance)
    VALUES ($1, 0, 0)
    ON CONFLICT (vendor_id) DO NOTHING
    RETURNING *;
  `;
  const result = await pool.query(query, [vendorId]);
  return result.rows[0];
}

/**
 * جلب محفظة بائع معين
 * @param {number} vendorId
 */
async function getVendorWallet(vendorId) {
  const query = `SELECT * FROM vendor_wallets WHERE vendor_id = $1;`;
  const result = await pool.query(query, [vendorId]);
  return result.rows[0];
}

/**
 * تحديث رصيد المحفظة (بعد بيع أو تحويل)
 * @param {number} vendorId
 * @param {number} newBalance
 * @param {number} newPendingBalance
 */
async function updateWalletBalance(vendorId, newBalance, newPendingBalance) {
  const query = `
    UPDATE vendor_wallets
    SET balance = $1, pending_balance = $2, updated_at = NOW()
    WHERE vendor_id = $3
    RETURNING *;
  `;
  const result = await pool.query(query, [newBalance, newPendingBalance, vendorId]);
  return result.rows[0];
}

/**
 * إضافة أرباح إلى المحفظة (بعد اكتمال طلب)
 * @param {number} vendorId
 * @param {number} amount - صافي الأرباح بعد خصم العمولة
 */
async function creditWallet(vendorId, amount) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const wallet = await client.query(
      'SELECT balance, pending_balance FROM vendor_wallets WHERE vendor_id = $1 FOR UPDATE;',
      [vendorId]
    );

    if (!wallet.rows[0]) {
      await client.query('ROLLBACK');
      throw new Error('Wallet not found for vendor');
    }

    const { balance, pending_balance } = wallet.rows[0];
    const newPendingBalance = parseFloat(pending_balance) + amount;

    await client.query(
      'UPDATE vendor_wallets SET pending_balance = $1 WHERE vendor_id = $2;',
      [newPendingBalance, vendorId]
    );

    await client.query('COMMIT');
    return { vendorId, amount, newPendingBalance };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error crediting wallet:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * تحويل الرصيد من "معلق" إلى "متاح" (بعد تأكيد الشحن)
 * @param {number} vendorId
 * @param {number} amount
 */
async function releaseToAvailable(vendorId, amount) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const wallet = await client.query(
      'SELECT pending_balance, balance FROM vendor_wallets WHERE vendor_id = $1 FOR UPDATE;',
      [vendorId]
    );

    if (!wallet.rows[0]) throw new Error('Wallet not found');

    const { pending_balance, balance } = wallet.rows[0];
    if (parseFloat(pending_balance) < amount) {
      throw new Error('Insufficient pending balance');
    }

    const newPending = parseFloat(pending_balance) - amount;
    const newBalance = parseFloat(balance) + amount;

    await client.query(
      'UPDATE vendor_wallets SET pending_balance = $1, balance = $2 WHERE vendor_id = $3;',
      [newPending, newBalance, vendorId]
    );

    await client.query('COMMIT');
    return { vendorId, released: amount, newBalance };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error releasing balance:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * تحديث وسيلة التحويل الشهري للبائع
 * @param {number} vendorId
 * @param {string} method - مثال: cash, western_union, bank
 * @param {Object} details - بيانات التحويل (بريد، اسم، IBAN...)
 */
async function setPayoutMethodForWallet(vendorId, method, details) {
  const query = `
    UPDATE vendor_wallets
    SET payout_method = $1, payout_details = $2::jsonb, updated_at = NOW()
    WHERE vendor_id = $3
    RETURNING *;
  `;
  const values = [method, JSON.stringify(details), vendorId];
  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * تسجيل تحويل شهري (يدوي من قبل المدير)
 * @param {number} vendorId
 * @param {number} amount
 * @param {string} transactionId
 */
async function recordWalletPayout(vendorId, amount, transactionId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const wallet = await client.query(
      'SELECT balance FROM vendor_wallets WHERE vendor_id = $1 FOR UPDATE;',
      [vendorId]
    );

    if (!wallet.rows[0] || wallet.rows[0].balance < amount) {
      throw new Error('Insufficient balance');
    }

    const newBalance = wallet.rows[0].balance - amount;

    // تحديث المحفظة
    await client.query(
      'UPDATE vendor_wallets SET balance = $1, last_payout_date = NOW() WHERE vendor_id = $2;',
      [newBalance, vendorId]
    );

    // تسجيل الدفعة في جدول payouts
    await client.query(
      `INSERT INTO payouts (vendor_id, amount, method, status, transaction_id, processed_at)
       VALUES ($1, $2, 'wallet', 'completed', $3, NOW());`,
      [vendorId, amount, transactionId]
    );

    await client.query('COMMIT');
    return { success: true, amount, vendorId };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error recording wallet payout:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  createVendorWallet,
  getVendorWallet,
  updateWalletBalance,
  creditWallet,
  releaseToAvailable,
  setPayoutMethodForWallet,
  recordWalletPayout,
};