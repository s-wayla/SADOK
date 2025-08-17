// db/vendor-contracts.js
// نظام العقود الإلكترونية للبائعين
const { pool } = require('./connection');

/**
 * حفظ عقد موقع من بائع
 * @param {Object} contractData - يحتوي على: vendor_id, contract_pdf_path, signer_name, id_number, signature_image, profile_image_copy, accepted_terms_version
 */
async function saveVendorContract(contractData) {
  const {
    vendor_id,
    contract_pdf_path,
    signer_name,
    id_number,
    signature_image,
    profile_image_copy,
    accepted_terms_version,
  } = contractData;

  const query = `
    INSERT INTO vendor_contracts (
      vendor_id, contract_pdf_path, signer_name, id_number,
      signature_image, profile_image_copy, accepted_terms_version
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;

  const values = [
    vendor_id,
    contract_pdf_path,
    signer_name,
    id_number,
    signature_image,
    profile_image_copy,
    accepted_terms_version,
  ];

  const client = await pool.connect();
  try {
    const result = await client.query(query, values);
    return result.rows[0];
  } catch (err) {
    console.error('Error saving vendor contract:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * جلب عقد بائع معين
 * @param {number} vendorId
 */
async function getContractByVendorId(vendorId) {
  const query = `
    SELECT * FROM vendor_contracts
    WHERE vendor_id = $1;
  `;
  const result = await pool.query(query, [vendorId]);
  return result.rows[0];
}

/**
 * التحقق من توقيع العقد من قبل البائع
 * @param {number} vendorId
 * @returns {boolean}
 */
async function hasSignedContract(vendorId) {
  const query = `
    SELECT EXISTS(
      SELECT 1 FROM vendor_contracts WHERE vendor_id = $1
    );
  `;
  const result = await pool.query(query, [vendorId]);
  return result.rows[0].exists;
}

/**
 * تحديث العقد (مثلاً عند تجديد الشروط)
 * @param {number} vendorId
 * @param {Object} updates - الحقول المطلوب تحديثها
 */
async function updateVendorContract(vendorId, updates) {
  const fields = [];
  const values = [];
  let index = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key} = $${index}`);
      values.push(value);
      index++;
    }
  }

  if (fields.length === 0) return null;

  values.push(vendorId);
  const query = `UPDATE vendor_contracts SET ${fields.join(', ')} WHERE vendor_id = $${index} RETURNING *;`;

  const client = await pool.connect();
  try {
    const result = await client.query(query, values);
    return result.rows[0];
  } catch (err) {
    console.error('Error updating vendor contract:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * جلب جميع العقود (للمسؤول)
 */
async function getAllVendorContracts() {
  const query = `
    SELECT vc.*, v.store_name, u.email
    FROM vendor_contracts vc
    JOIN vendors v ON vc.vendor_id = v.id
    JOIN users u ON v.user_id = u.id
    ORDER BY vc.signed_at DESC;
  `;
  const result = await pool.query(query);
  return result.rows;
}

module.exports = {
  saveVendorContract,
  getContractByVendorId,
  hasSignedContract,
  updateVendorContract,
  getAllVendorContracts,
};