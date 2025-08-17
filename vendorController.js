const db = require('../vendors');
const { validationResult } = require('express-validator');
// controllers/vendorController.js
const db = require('../db');
const fs = require('fs');
const path = require('path');

async function createVendor(req, res) {
  console.log('🔧 [Backend] req.body:', req.body);

  const {
    userId,                 // من الواجهة إن لم تكن مصادق
    storeName,
    description,
    logoUrl,                // Base64 مسموح (عمود TEXT)
    coverImage,             // Base64 محتمل من الواجهة
    coverImageUrl,          // بديل
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
    signature,              // Base64 — العقد
    email
  } = req.body;

  // لا تكرر تعريف authUserId
  const effectiveUserId = (req.user && req.user.id) ? req.user.id : userId;

  if (!effectiveUserId || !storeName || !country || !lat || !lng || !contractName || !contractIdNumber || !email) {
    return res.status(400).json({ error: 'الرجاء تعبئة جميع الحقول المطلوبة' });
  }

  try {
    // تأكد أنه لا يوجد متجر سابقًا
    const existing = await db.query('SELECT 1 FROM vendors WHERE user_id = $1', [effectiveUserId]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'لديك متجر بالفعل.' });
    }

    // slug
    const storeSlug = storeName.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // أي اسم غلاف وصل
    const finalCoverImageUrl = coverImageUrl || coverImage || null;

    const result = await db.createVendorFull({
      userId: effectiveUserId,
      storeName,
      storeSlug,
      description,
      logoUrl,                          // TEXT
      coverImageUrl: finalCoverImageUrl,// TEXT
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
      signatureImage: signature,        // TEXT
      profileImage: req.file ? req.file.path : null, // اختياري
      email
    });

    res.status(201).json({
      message: 'تم إنشاء المتجر والعقد بنجاح',
      vendorId: result.vendorId,
      contractUrl: result.contractPath.replace('contracts/', '/contracts/')
    });

  } catch (error) {
    console.error('خطأ في إنشاء البائع:', error);
    res.status(500).json({ error: 'فشل في إنشاء البائع', details: error.message });
  }
}

module.exports = { createVendor };