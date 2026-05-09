const nodemailer = require('nodemailer');

function makeTransport(settings) {
  return nodemailer.createTransport({
    host: settings.smtp_host,
    port: settings.smtp_port || 587,
    secure: !!settings.smtp_secure,
    auth: { user: settings.smtp_user, pass: settings.smtp_pass },
  });
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function buildHTML(invoice, settings) {
  const amount = fmt(invoice.amount);
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px">
<div style="background:#4f46e5;padding:24px;border-radius:8px 8px 0 0;text-align:center">
  <h1 style="color:#fff;margin:0;font-size:20px">Invoice ${invoice.invoice_number}</h1>
  <p style="color:#c7d2fe;margin:4px 0 0">${settings.your_company || settings.your_name || ''}</p>
</div>
<div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;padding:30px;border-radius:0 0 8px 8px">
  <p>Hi ${invoice.client_name},</p>
  <p>Please find your invoice attached. Here's a summary:</p>
  <div style="background:#fff;border-radius:8px;border:1px solid #e5e7eb;padding:20px;margin:20px 0">
    <table style="width:100%;border-collapse:collapse">
      <tr style="border-bottom:1px solid #f3f4f6">
        <td style="padding:8px 0;color:#888;font-size:13px">Invoice Number</td>
        <td style="padding:8px 0;text-align:right;font-weight:600">${invoice.invoice_number}</td>
      </tr>
      <tr style="border-bottom:1px solid #f3f4f6">
        <td style="padding:8px 0;color:#888;font-size:13px">Date</td>
        <td style="padding:8px 0;text-align:right">${date}</td>
      </tr>
      ${invoice.description ? `<tr style="border-bottom:1px solid #f3f4f6">
        <td style="padding:8px 0;color:#888;font-size:13px">Description</td>
        <td style="padding:8px 0;text-align:right">${invoice.description}</td>
      </tr>` : ''}
      <tr>
        <td style="padding:12px 0 0;font-size:14px;font-weight:600">Amount Due</td>
        <td style="padding:12px 0 0;text-align:right;font-size:22px;font-weight:700;color:#4f46e5">${amount}</td>
      </tr>
    </table>
  </div>
  <p style="color:#888;font-size:13px">The PDF invoice is attached. Payment is due within 30 days.</p>
  <p>Thank you for your business!</p>
  <p style="color:#555;margin-top:20px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:13px">
    ${settings.your_name ? `<strong>${settings.your_name}</strong><br>` : ''}
    ${settings.your_company ? `${settings.your_company}<br>` : ''}
    ${settings.your_email || ''}
  </p>
</div></body></html>`;
}

async function sendInvoiceEmail(invoice, pdfBuffer, settings) {
  if (!settings?.smtp_host) throw new Error('SMTP not configured. Go to Settings first.');
  const from = `"${settings.your_name || settings.your_company || 'Invoice'}" <${settings.smtp_user}>`;
  const subject = `Invoice ${invoice.invoice_number} from ${settings.your_company || settings.your_name || 'Invoice'}`;
  await makeTransport(settings).sendMail({
    from,
    to: invoice.client_email,
    cc: settings.your_email || undefined,
    subject,
    html: buildHTML(invoice, settings),
    attachments: [{ filename: `${invoice.invoice_number}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
  });
}

async function sendTestEmail(settings) {
  if (!settings?.smtp_host) throw new Error('SMTP not configured.');
  await makeTransport(settings).sendMail({
    from: settings.smtp_user,
    to: settings.your_email || settings.smtp_user,
    subject: 'Invoice Scheduler — Test Email ✓',
    text: 'Your SMTP settings are working correctly! Invoice Scheduler is ready to send invoices.',
  });
}

module.exports = { sendInvoiceEmail, sendTestEmail };
