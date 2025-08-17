// routes/taxRates.js
const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const db = require('../db'); // ⬅️ إضافة ضرورية

// --- جلب جميع نسب الضريبة ---
router.get('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const rates = await db.getAllTaxRates();
    res.json(rates);
  } catch (err) {
    console.error('Error fetching tax rates:', err);
    res.status(500).json({ message: 'فشل في جلب نسب الضريبة.' });
  }
});

// --- جلب ضريبة حسب كود الدولة ---
router.get('/:countryCode', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { countryCode } = req.params;
  if (!countryCode || countryCode.length !== 2) {
    return res.status(400).json({ message: 'يرجى تقديم كود دولة صالح (حرفين).' });
  }
  try {
    const rate = await db.getTaxRateByCountryCode(countryCode.toUpperCase());
    if (!rate) {
      return res.status(404).json({ message: 'لا توجد ضريبة لهذا الكود.' });
    }
    res.json(rate);
  } catch (err) {
    console.error('Error fetching tax rate by country code:', err);
    res.status(500).json({ message: 'فشل في جلب الضريبة.' });
  }
});

// --- إضافة أو تحديث ضريبة ---
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { country, country_code, tax_rate, description } = req.body;

  if (!country || !country_code || tax_rate === undefined) {
    return res.status(400).json({ message: 'جميع الحقول المطلوبة (country, country_code, tax_rate) يجب أن تكون معبأة.' });
  }

  if (country_code.length !== 2) {
    return res.status(400).json({ message: 'كود الدولة يجب أن يكون حرفين.' });
  }

  try {
    const newRate = await db.insertTaxRate(
      country,
      country_code.toUpperCase(),
      parseFloat(tax_rate),
      description
    );
    res.status(201).json(newRate);
  } catch (err) {
    console.error('Error inserting tax rate:', err);
    res.status(500).json({ message: 'فشل في إضافة الضريبة.' });
  }
});

module.exports = router;