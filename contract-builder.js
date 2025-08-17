// utils/contract-builder.js
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts } = require('pdf-lib');

/**
 * بناء PDF لعقد بائع من صورة قالب + إحداثيات حقول + بيانات + توقيع وصورة شخصية
 * @param {Object} opts
 * @param {{width:number,height:number}} opts.page
 * @param {Object} opts.positions - { name:{x,y}, idNumber:{x,y}, phone:{x,y}, birthDate:{x,y}, profile:{x,y,w,h}, signature:{x,y,w,h} }
 * @param {string} opts.templateImagePath - مسار صورة القالب (PNG/JPG)
 * @param {string} opts.outputPath - مسار حفظ PDF النهائي
 * @param {Object} opts.data - { fullName, idNumber, phone, birthDate }
 * @param {string} opts.signatureDataUrl - data:image/png;base64,...
 * @param {string|null} opts.profileImagePath - مسار محلي لصورة البروفايل (اختياري)
 */
async function buildContractPDF({ page, positions, templateImagePath, outputPath, data, signatureDataUrl, profileImagePath }) {
  const pdfDoc = await PDFDocument.create();
  const page1 = pdfDoc.addPage([page.width, page.height]);

  // خلفية القالب
  const bgBytes = fs.readFileSync(templateImagePath);
  let bgImage;
  if (templateImagePath.toLowerCase().endsWith('.png')) {
    bgImage = await pdfDoc.embedPng(bgBytes);
  } else {
    bgImage = await pdfDoc.embedJpg(bgBytes);
  }
  page1.drawImage(bgImage, { x: 0, y: 0, width: page.width, height: page.height });

  // خط افتراضي (لا يدعم العربية بشكل مثالي — جيد للأرقام واللاتيني كبداية)
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // نصوص
  if (data.fullName) page1.drawText(String(data.fullName), { x: positions.name.x, y: positions.name.y, size: 14, font: helv });
  if (data.idNumber) page1.drawText(String(data.idNumber), { x: positions.idNumber.x, y: positions.idNumber.y, size: 14, font: helv });
  if (data.birthDate) page1.drawText(String(data.birthDate), { x: positions.birthDate.x, y: positions.birthDate.y, size: 14, font: helv });
  if (data.phone) page1.drawText(String(data.phone), { x: positions.phone.x, y: positions.phone.y, size: 14, font: helv });

  // صورة البروفايل (اختياري)
  if (profileImagePath && fs.existsSync(profileImagePath)) {
    const pBytes = fs.readFileSync(profileImagePath);
    const pImg = profileImagePath.toLowerCase().endsWith('.png') ? await pdfDoc.embedPng(pBytes) : await pdfDoc.embedJpg(pBytes);
    page1.drawImage(pImg, { x: positions.profile.x, y: positions.profile.y, width: positions.profile.w, height: positions.profile.h });
  }

  // التوقيع من DataURL
  if (signatureDataUrl && signatureDataUrl.startsWith('data:image/')) {
    const base64 = signatureDataUrl.split(',')[1];
    const sBytes = Buffer.from(base64, 'base64');
    const sImg = signatureDataUrl.includes('png') ? await pdfDoc.embedPng(sBytes) : await pdfDoc.embedJpg(sBytes);
    page1.drawImage(sImg, { x: positions.signature.x, y: positions.signature.y, width: positions.signature.w, height: positions.signature.h });
  }

  const out = await pdfDoc.save();
  fs.writeFileSync(outputPath, out);
  return outputPath;
}

module.exports = { buildContractPDF };
