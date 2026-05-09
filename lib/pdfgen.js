const PDFDocument = require('pdfkit');

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function addDays(d, n) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt;
}

function generateInvoicePDF(invoice, settings) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const buffers = [];
    doc.on('data', c => buffers.push(c));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const now = invoice.sent_at ? new Date(invoice.sent_at) : new Date();
    const indigo = '#4f46e5';
    const dark = '#1e1b4b';

    // --- Header left: company ---
    doc.fontSize(22).font('Helvetica-Bold').fillColor(dark)
       .text(settings.your_company || settings.your_name || 'Your Company', 50, 50);

    let headerY = 78;
    if (settings.your_name && settings.your_company) {
      doc.fontSize(10).font('Helvetica').fillColor('#555').text(settings.your_name, 50, headerY);
      headerY += 14;
    }
    if (settings.your_email) {
      doc.fontSize(10).font('Helvetica').fillColor('#555').text(settings.your_email, 50, headerY);
    }

    // --- Header right: INVOICE label ---
    doc.fontSize(28).font('Helvetica-Bold').fillColor(indigo)
       .text('INVOICE', 350, 50, { width: 200, align: 'right' });
    doc.fontSize(10).font('Helvetica').fillColor('#333')
       .text(`Invoice #: ${invoice.invoice_number}`, 350, 90, { width: 200, align: 'right' })
       .text(`Date: ${fmtDate(now)}`, 350, 104, { width: 200, align: 'right' })
       .text(`Due: ${fmtDate(addDays(now, 30))}`, 350, 118, { width: 200, align: 'right' });

    // --- Divider ---
    doc.moveTo(50, 148).lineTo(560, 148).strokeColor('#e5e7eb').lineWidth(1).stroke();

    // --- Bill To ---
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#999').text('BILL TO', 50, 165);
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#111').text(invoice.client_name, 50, 180);
    doc.fontSize(10).font('Helvetica').fillColor('#555').text(invoice.client_email, 50, 196);

    // --- Table ---
    const tTop = 248;
    doc.rect(50, tTop, 510, 30).fill(indigo);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#fff')
       .text('Description', 62, tTop + 10)
       .text('Amount', 450, tTop + 10, { width: 98, align: 'right' });

    const rTop = tTop + 30;
    const rowH = invoice.hours && invoice.rate ? 50 : 36;
    doc.rect(50, rTop, 510, rowH).fill('#f8fafc');
    doc.fontSize(10).font('Helvetica').fillColor('#222')
       .text(invoice.description || 'Professional Services', 62, rTop + 11, { width: 360 })
       .text(fmt(invoice.amount), 450, rTop + 11, { width: 98, align: 'right' });
    if (invoice.hours && invoice.rate) {
      doc.fontSize(8.5).fillColor('#888')
         .text(`${invoice.hours} hrs × ${fmt(invoice.rate)}/hr`, 62, rTop + 30);
    }

    // --- Total bar ---
    const totTop = rTop + rowH + 10;
    doc.rect(360, totTop, 200, 38).fill(dark);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#fff')
       .text('TOTAL DUE', 370, totTop + 12)
       .text(fmt(invoice.amount), 450, totTop + 12, { width: 98, align: 'right' });

    // --- Footer ---
    doc.fontSize(9).font('Helvetica').fillColor('#aaa')
       .text('Thank you for your business! Payment is due within 30 days.', 50, 680, { align: 'center', width: 510 });
    doc.moveTo(50, 696).lineTo(560, 696).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    const footerLine = [settings.your_name, settings.your_company, settings.your_email].filter(Boolean).join('  |  ');
    doc.fontSize(8).fillColor('#bbb').text(footerLine, 50, 703, { align: 'center', width: 510 });

    doc.end();
  });
}

module.exports = { generateInvoicePDF };
