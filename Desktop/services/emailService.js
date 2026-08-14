const nodemailer = require('nodemailer');

async function sendInvoiceEmail({
  to,
  subject,
  html,
  pdfBuffer,
  pdfFilename = 'facture.pdf',
  smtpConfig
}) {
  if (!smtpConfig || !smtpConfig.host) {
    throw new Error('Configuration SMTP manquante');
  }

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: parseInt(smtpConfig.port) || 587,
    secure: smtpConfig.secure === 1 || smtpConfig.secure === true || smtpConfig.port === 465,
    auth: smtpConfig.user ? {
      user: smtpConfig.user,
      pass: smtpConfig.pass
    } : undefined
  });

  const mailOptions = {
    from: smtpConfig.from || smtpConfig.user,
    to,
    subject,
    html,
    attachments: pdfBuffer ? [{
      filename: pdfFilename,
      content: pdfBuffer
    }] : []
  };

  const result = await transporter.sendMail(mailOptions);
  return result;
}

module.exports = { sendInvoiceEmail };
