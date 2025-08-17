// utils/pdf-generator.js
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function generateVendorContract(vendorData) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const { height } = page.getSize();

  let y = height - 50;

  const addText = (text, size = 12, color = rgb(0, 0, 0)) => {
    page.drawText(text, { x: 50, y: y, size, color });
    y -= 20;
  };

  addText('عقد إنشاء متجر', 16);
  addText(`البائع: ${vendorData.fullName}`);
  addText(`اسم المتجر: ${vendorData.storeName}`);
  addText(`الدولة: ${vendorData.country}`);
  addText(`رقم الهوية: ${vendorData.idNumber}`);
  addText(`وسيلة الدفع: ${vendorData.payoutMethod}`);
  addText(' ');
  addText('الشروط والأحكام:');
  addText('1. العمولة: 10% من كل بيع');
  addText('2. التسليم خلال 7 أيام');
  addText('3. المسؤولية على البائع');
  addText(' ');
  addText(`التوقيع: ${vendorData.signatureName}`);
  addText(`تاريخ التوقيع: ${new Date().toLocaleDateString('ar-SA')}`);

  const pdfBytes = await pdfDoc.save();
  const filePath = path.join(__dirname, '../contracts', `contract-${Date.now()}.pdf`);
  const dir = path.join(__dirname, '../contracts');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(filePath, pdfBytes);

  return filePath; // مسار الملف
}

module.exports = generateVendorContract;