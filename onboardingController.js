// controllers/onboardingController.js
// نقاط: حالة البائع + توقيع/إنشاء العقد من صورة قالب ثابتة
const path = require('path');
const fs = require('fs');
const { pool } = require('../db/connection');
const { buildContractPDF } = require('../utils/contract-builder');
const { PAGE, POS } = require('../utils/contract-positions');
const { saveVendorContract, hasSignedContract } = require('../db/vendor-contracts');

// جلب حالة البائع بعد تسجيل الدخول
// يعيد: hasStore, hasPersonalData, hasContract, vendorId, storeId
async function getVendorStatus(req, res) {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    // احضار البائع عبر user_id
    const vq = await pool.query('SELECT * FROM vendors WHERE user_id = $1 LIMIT 1', [userId]);
    if (vq.rows.length === 0) {
      return res.json({ vendorId: null, storeId: null, hasStore: false, hasPersonalData: false, hasContract: false });
    }
    const vendor = vq.rows[0];
    const vendorId = vendor.id;

    // التحقق من وجود متجر (جدول stores) وإلا نعتبره غير موجود
    let storeId = null;
    try {
      const sq = await pool.query('SELECT id FROM stores WHERE vendor_id = $1 LIMIT 1', [vendorId]);
      if (sq.rows.length > 0) storeId = sq.rows[0].id;
    } catch (_) {
      storeId = vendor.store_id || null;
    }

    const required = ['full_name', 'id_number', 'birth_date', 'phone'];
    const hasPersonalData = required.every(k => {
      const val = vendor[k];
      return val !== null && val !== undefined && String(val).trim() !== '';
    });

    let hasContract = false;
    try { hasContract = await hasSignedContract(vendorId); }
    catch (_) { hasContract = !!vendor.contract_url; }

    return res.json({
      vendorId,
      storeId,
      hasStore: !!storeId,
      hasPersonalData,
      hasContract
    });
  } catch (err) {
    console.error('getVendorStatus error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

// توقيع وإنشاء العقد النهائي
// المدخلات: fullName, phone, idNumber, birthDate?, signatureDataUrl, profileImageUrl?, termsVersion?
async function signContract(req, res) {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const vq = await pool.query('SELECT * FROM vendors WHERE user_id = $1 LIMIT 1', [userId]);
    if (vq.rows.length === 0) return res.status(404).json({ message: 'Vendor not found' });
    const vendor = vq.rows[0];

    const {
      fullName,
      phone,
      idNumber,
      birthDate,
      signatureDataUrl,
      profileImageUrl,
      termsVersion
    } = req.body;

    if (!fullName || !phone || !idNumber) {
      return res.status(400).json({ message: 'الاسم والجوال والهوية مطلوبة' });
    }
    if (!signatureDataUrl) {
      return res.status(400).json({ message: 'التوقيع مطلوب' });
    }

    // مسارات القوالب والإخراج
    const templateImagePath = process.env.CONTRACT_TEMPLATE_IMAGE
      || path.join(__dirname, '..', 'contracts', 'templates', 'S-WAYLA-1.png'); // ضع صورتك هنا
    const outDir = path.join(__dirname, '..', 'contracts', 'signed');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const fileName = `contract_${vendor.id}_${Date.now()}.pdf`;
    const outPath = path.join(outDir, fileName);

    const profilePathLocal = (profileImageUrl && profileImageUrl.startsWith('/'))
      ? path.join(__dirname, '..', profileImageUrl)
      : null;

    // إنشاء PDF من القالب
    await buildContractPDF({
      page: PAGE,
      positions: POS,
      templateImagePath,
      outputPath: outPath,
      data: {
        fullName,
        idNumber,
        phone,
        birthDate: birthDate || (vendor.birth_date ? String(vendor.birth_date) : ''),
      },
      signatureDataUrl,
      profileImagePath: profilePathLocal
    });

    // حفظ في جدول vendor_contracts
    await saveVendorContract({
      vendor_id: vendor.id,
      contract_pdf_path: `/contracts/signed/${fileName}`,
      signer_name: fullName,
      id_number: idNumber,
      signature_image: null,       // اختياري: خزن نسخة
      profile_image_copy: null,    // اختياري: خزن نسخة
      accepted_terms_version: termsVersion || null,
    });

    // تحديث vendors (اختياري)
    try {
      await pool.query(
        'UPDATE vendors SET contract_url = $1, contract_created_at = NOW() WHERE id = $2',
        [`/contracts/signed/${fileName}`, vendor.id]
      );
    } catch (_) {}

    return res.json({ message: 'تم إنشاء العقد بنجاح', contractUrl: `/contracts/signed/${fileName}` });
  } catch (err) {
    console.error('signContract error:', err);
    return res.status(500).json({ message: 'فشل إنشاء العقد', details: err.message });
  }
}

module.exports = { getVendorStatus, signContract };
