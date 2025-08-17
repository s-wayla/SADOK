// utils/contract-positions.js
// أحجام الصفحة وإحداثيات الحقول الثابتة على صورة القالب
// ⚠️ عدّل هذه القيم لاحقًا بعد أول اختبار حتى تُطابق القالب 100%
module.exports = {
  PAGE: { width: 1080, height: 1528 }, // اضبطها على مقاس صورة القالب بالبيكسل
  POS: {
    name:        { x: 420, y: 930 },
    idNumber:    { x: 420, y: 893 },
    birthDate:   { x: 420, y: 856 },
    phone:       { x: 420, y: 819 },
    profile:     { x: 300, y: 230, w: 160, h: 200 },
    signature:   { x: 520, y: 230, w: 320, h: 200 }
  }
};
