// utils/email-service.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendContractEmail(to, contractPath) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: 'تم إنشاء متجرك - العقد الموقع',
    text: 'مرحبًا، تم إنشاء متجرك بنجاح. يُرجى الاطلاع على العقد المرفق.',
    attachments: [
      {
        filename: 'العقد.pdf',
        path: contractPath,
      },
    ],
  };

  await transporter.sendMail(mailOptions);
}

module.exports = sendContractEmail;